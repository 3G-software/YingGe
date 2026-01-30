use sqlx::SqlitePool;
use tauri::State;
use uuid::Uuid;

use crate::db::{
    models::{Asset, AssetDetail, FolderInfo, PaginatedAssets},
    queries,
};
use crate::error::AppError;
use crate::storage::{file_ops, thumbnail};

#[tauri::command]
pub async fn import_assets(
    library_id: String,
    file_paths: Vec<String>,
    folder_path: String,
    pool: State<'_, SqlitePool>,
) -> Result<Vec<Asset>, AppError> {
    // Get library root path
    let library = queries::get_library(&pool, &library_id).await?;
    let library_root = std::path::PathBuf::from(&library.root_path);

    let mut imported = Vec::new();

    for file_path_str in &file_paths {
        let source = std::path::Path::new(file_path_str);
        if !source.exists() {
            continue;
        }

        let asset_id = Uuid::new_v4().to_string();
        let original_name = source
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown")
            .to_string();

        let mime_type = file_ops::guess_mime_type(source);
        let file_type = file_ops::file_type_from_mime(&mime_type).to_string();
        let file_size = file_ops::get_file_size(source)? as i64;
        let file_hash = file_ops::compute_file_hash(source)?;

        // Get image dimensions if applicable
        let (width, height) = if file_type == "image" {
            file_ops::get_image_dimensions(source)
                .map(|(w, h)| (Some(w as i32), Some(h as i32)))
                .unwrap_or((None, None))
        } else {
            (None, None)
        };

        // Copy file to library
        let relative_path =
            file_ops::copy_to_library(source, &library_root, &folder_path, &asset_id)?;

        // Generate thumbnail for images
        let thumbnail_path = if file_type == "image" {
            thumbnail::generate_thumbnail(source, &library_root, &asset_id).ok()
        } else {
            None
        };

        let folder = if folder_path.is_empty() {
            "/".to_string()
        } else if !folder_path.starts_with('/') {
            format!("/{}", folder_path)
        } else {
            folder_path.clone()
        };

        let asset = Asset {
            id: asset_id,
            library_id: library_id.clone(),
            file_name: original_name.clone(),
            original_name,
            relative_path,
            file_type,
            mime_type,
            file_size,
            file_hash,
            width,
            height,
            duration_ms: None,
            description: String::new(),
            ai_description: String::new(),
            thumbnail_path,
            folder_path: folder,
            created_at: String::new(),
            updated_at: String::new(),
            imported_at: String::new(),
        };

        let saved = queries::insert_asset(&pool, &asset).await?;
        imported.push(saved);
    }

    Ok(imported)
}

#[tauri::command]
pub async fn get_assets(
    library_id: String,
    folder_path: Option<String>,
    file_type: Option<String>,
    page: u32,
    page_size: u32,
    sort_by: String,
    sort_order: String,
    pool: State<'_, SqlitePool>,
) -> Result<PaginatedAssets, AppError> {
    let result = queries::get_assets(
        &pool,
        &library_id,
        folder_path.as_deref(),
        file_type.as_deref(),
        page,
        page_size,
        &sort_by,
        &sort_order,
    )
    .await?;
    Ok(result)
}

#[tauri::command]
pub async fn get_asset_detail(
    id: String,
    pool: State<'_, SqlitePool>,
) -> Result<AssetDetail, AppError> {
    let asset = queries::get_asset(&pool, &id).await?;
    let tags = queries::get_asset_tags(&pool, &id).await?;
    Ok(AssetDetail { asset, tags })
}

#[tauri::command]
pub async fn rename_asset(
    id: String,
    new_name: String,
    pool: State<'_, SqlitePool>,
) -> Result<(), AppError> {
    queries::rename_asset(&pool, &id, &new_name).await?;
    Ok(())
}

#[tauri::command]
pub async fn update_description(
    id: String,
    description: String,
    pool: State<'_, SqlitePool>,
) -> Result<(), AppError> {
    queries::update_asset_description(&pool, &id, &description).await?;
    Ok(())
}

#[tauri::command]
pub async fn delete_assets(
    ids: Vec<String>,
    pool: State<'_, SqlitePool>,
) -> Result<(), AppError> {
    queries::delete_assets(&pool, &ids).await?;
    Ok(())
}

#[tauri::command]
pub async fn move_assets(
    ids: Vec<String>,
    target_folder: String,
    pool: State<'_, SqlitePool>,
) -> Result<(), AppError> {
    queries::move_assets(&pool, &ids, &target_folder).await?;
    Ok(())
}

#[tauri::command]
pub async fn get_folders(
    library_id: String,
    pool: State<'_, SqlitePool>,
) -> Result<Vec<FolderInfo>, AppError> {
    let folders = queries::get_folders(&pool, &library_id).await?;
    Ok(folders)
}

/// Get the absolute filesystem path for an asset file (for frontend to display)
#[tauri::command]
pub async fn get_asset_file_path(
    id: String,
    pool: State<'_, SqlitePool>,
) -> Result<String, AppError> {
    let asset = queries::get_asset(&pool, &id).await?;
    let library = queries::get_library(&pool, &asset.library_id).await?;
    let full_path = std::path::Path::new(&library.root_path).join(&asset.relative_path);
    Ok(full_path.to_string_lossy().to_string())
}

/// Get the absolute filesystem path for a thumbnail
#[tauri::command]
pub async fn get_thumbnail_path(
    id: String,
    pool: State<'_, SqlitePool>,
) -> Result<Option<String>, AppError> {
    let asset = queries::get_asset(&pool, &id).await?;
    if let Some(thumb_rel) = &asset.thumbnail_path {
        let library = queries::get_library(&pool, &asset.library_id).await?;
        let full_path = std::path::Path::new(&library.root_path).join(thumb_rel);
        Ok(Some(full_path.to_string_lossy().to_string()))
    } else {
        Ok(None)
    }
}
