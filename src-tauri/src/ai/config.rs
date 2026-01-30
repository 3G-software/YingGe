use std::sync::Arc;

use sqlx::SqlitePool;

use crate::ai::provider::{AiProviderManager, OpenAiCompatibleProvider};
use crate::db::queries;
use crate::error::AppError;

/// Load the active AI config from DB and set up the provider
pub async fn load_ai_provider(
    pool: &SqlitePool,
    manager: &AiProviderManager,
) -> Result<(), AppError> {
    if let Some(config) = queries::get_active_ai_config(pool).await? {
        let provider = Arc::new(OpenAiCompatibleProvider::new(
            config.api_endpoint,
            config.api_key,
            config.model_id,
            config.embedding_model,
        ));
        manager.set_provider(provider).await;
    }
    Ok(())
}
