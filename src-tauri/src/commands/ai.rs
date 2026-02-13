use sqlx::SqlitePool;
use std::sync::Arc;
use tauri::State;

use crate::ai::{
    embedding::{bytes_to_f32_vec, cosine_similarity, embed_text_to_bytes},
    provider::{AiProvider, AiProviderManager, OpenAiCompatibleProvider},
    tagging::analyze_image_file,
};
use crate::db::{models::*, queries};
use crate::error::AppError;

#[derive(serde::Serialize, serde::Deserialize)]
pub struct AiTagResult {
    pub tags: Vec<Tag>,
    pub description: String,
    pub suggested_name: Option<String>,
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct ScoredAsset {
    pub asset: Asset,
    pub score: f32,
}

#[derive(serde::Deserialize)]
pub struct AiConfigInput {
    pub provider_name: String,
    pub api_endpoint: String,
    pub api_key: String,
    pub model_id: String,
    pub embedding_model: String,
}

#[tauri::command]
pub async fn ai_tag_asset(
    asset_id: String,
    pool: State<'_, SqlitePool>,
    ai_manager: State<'_, AiProviderManager>,
) -> Result<AiTagResult, AppError> {
    tracing::info!("=== AI Tagging Started for asset: {} ===", asset_id);

    let asset = queries::get_asset(&pool, &asset_id).await?;
    tracing::info!("Asset info: file_name={}, file_type={}", asset.file_name, asset.file_type);

    if asset.file_type != "image" {
        tracing::warn!("AI tagging skipped: asset is not an image");
        return Err(AppError::InvalidInput(
            "AI tagging is currently only supported for images".to_string(),
        ));
    }

    let library = queries::get_library(&pool, &asset.library_id).await?;
    let file_path = std::path::Path::new(&library.root_path).join(&asset.relative_path);
    tracing::info!("Image file path: {:?}", file_path);

    tracing::info!("Calling AI vision model to analyze image...");
    let analysis = analyze_image_file(&file_path, &ai_manager).await?;
    tracing::info!("AI analysis completed:");
    tracing::info!("  Description: {}", analysis.description);
    tracing::info!("  Suggested tags: {:?}", analysis.tags.iter().map(|t| &t.name).collect::<Vec<_>>());
    if let Some(ref name) = analysis.suggested_name {
        tracing::info!("  Suggested name: {}", name);
    }

    // Update asset description
    tracing::info!("Updating asset description...");
    queries::update_asset_description(&pool, &asset_id, &analysis.description).await?;

    // Create/assign tags
    let mut assigned_tags = Vec::new();
    tracing::info!("Creating and assigning {} tags...", analysis.tags.len());
    for suggested in &analysis.tags {
        let tag = queries::get_or_create_tag(&pool, &asset.library_id, &suggested.name, true)
            .await?;
        tracing::info!("  Tag created/found: {} (id: {})", tag.name, tag.id);
        queries::assign_tags(&pool, &asset_id, &[tag.id.clone()]).await?;
        assigned_tags.push(tag);
    }

    // Generate and store embedding for semantic search
    tracing::info!("Generating embedding for semantic search...");
    if let Ok(embedding_bytes) =
        embed_text_to_bytes(&analysis.description, &ai_manager).await
    {
        queries::save_embedding(&pool, &asset_id, "default", &embedding_bytes).await?;
        tracing::info!("Embedding saved successfully");
    } else {
        tracing::warn!("Failed to generate embedding");
    }

    tracing::info!("=== AI Tagging Completed for asset: {} ===", asset_id);

    Ok(AiTagResult {
        tags: assigned_tags,
        description: analysis.description,
        suggested_name: analysis.suggested_name,
    })
}

#[tauri::command]
pub async fn ai_semantic_search(
    library_id: String,
    query: String,
    top_k: u32,
    pool: State<'_, SqlitePool>,
    ai_manager: State<'_, AiProviderManager>,
) -> Result<Vec<ScoredAsset>, AppError> {
    // Embed the query
    let query_embedding = {
        let provider = ai_manager.get_provider().await?;
        provider.embed_text(&query).await?
    };

    // Load all embeddings for this library
    let all_embeddings = queries::get_all_embeddings(&pool, &library_id, "default").await?;

    // Compute similarities
    let mut scored: Vec<(String, f32)> = all_embeddings
        .iter()
        .map(|(asset_id, vec_bytes)| {
            let embedding = bytes_to_f32_vec(vec_bytes);
            let score = cosine_similarity(&query_embedding, &embedding);
            (asset_id.clone(), score)
        })
        .collect();

    // Sort by score descending
    scored.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
    scored.truncate(top_k as usize);

    // Fetch asset details
    let mut results = Vec::new();
    for (asset_id, score) in scored {
        if let Ok(asset) = queries::get_asset(&pool, &asset_id).await {
            results.push(ScoredAsset { asset, score });
        }
    }

    Ok(results)
}

#[tauri::command]
pub async fn save_ai_config(
    config: AiConfigInput,
    pool: State<'_, SqlitePool>,
    ai_manager: State<'_, AiProviderManager>,
) -> Result<(), AppError> {
    let id = uuid::Uuid::new_v4().to_string();
    let ai_config = AiConfig {
        id,
        provider_name: config.provider_name,
        api_endpoint: config.api_endpoint.clone(),
        api_key: config.api_key.clone(),
        model_id: config.model_id.clone(),
        embedding_model: config.embedding_model.clone(),
        is_active: true,
        created_at: String::new(),
    };

    // Deactivate all existing configs first
    sqlx::query("UPDATE ai_config SET is_active = 0")
        .execute(pool.inner())
        .await?;

    queries::save_ai_config(&pool, &ai_config).await?;

    // Update runtime provider
    let provider = Arc::new(OpenAiCompatibleProvider::new(
        config.api_endpoint,
        config.api_key,
        config.model_id,
        config.embedding_model,
    ));
    ai_manager.set_provider(provider).await;

    Ok(())
}

#[tauri::command]
pub async fn get_ai_config(
    pool: State<'_, SqlitePool>,
) -> Result<Option<AiConfig>, AppError> {
    let config = queries::get_active_ai_config(&pool).await?;
    Ok(config)
}

#[tauri::command]
pub async fn test_ai_connection(config: AiConfigInput) -> Result<bool, AppError> {
    let provider = OpenAiCompatibleProvider::new(
        config.api_endpoint,
        config.api_key,
        config.model_id,
        config.embedding_model,
    );
    provider.test_connection().await
}
