use sqlx::SqlitePool;
use tauri::State;
use uuid::Uuid;
use base64::Engine;

use crate::db::{
    models::{Asset, AssetDetail, FolderInfo, PaginatedAssets},
    queries,
};
use crate::error::AppError;
use crate::storage::{file_ops, thumbnail};

/// Supported file extensions for import
const SUPPORTED_EXTENSIONS: &[&str] = &[
    "png", "jpg", "jpeg", "gif", "bmp", "webp", "svg", "tiff",
    "mp3", "wav", "ogg", "flac", "aac", "m4a",
    "mp4", "avi", "mov", "webm",
];

/// Check if a file has a supported extension
fn is_supported_file(path: &std::path::Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| SUPPORTED_EXTENSIONS.contains(&ext.to_lowercase().as_str()))
        .unwrap_or(false)
}

/// Collect all files from a path (recursively if directory)
fn collect_files(path: &std::path::Path) -> Vec<std::path::PathBuf> {
    let mut files = Vec::new();

    if path.is_file() {
        if is_supported_file(path) {
            files.push(path.to_path_buf());
        }
    } else if path.is_dir() {
        if let Ok(entries) = std::fs::read_dir(path) {
            for entry in entries.flatten() {
                let entry_path = entry.path();
                files.extend(collect_files(&entry_path));
            }
        }
    }

    files
}

#[tauri::command]
pub async fn import_assets(
    library_id: String,
    file_paths: Vec<String>,
    folder_path: String,
    pool: State<'_, SqlitePool>,
) -> Result<Vec<Asset>, AppError> {
    // Debug logging
    tracing::info!("import_assets called with {} paths", file_paths.len());
    for (i, path) in file_paths.iter().enumerate() {
        tracing::info!("  Path {}: {}", i, path);
    }

    // Get library root path
    let library = queries::get_library(&pool, &library_id).await?;
    let library_root = std::path::PathBuf::from(&library.root_path);

    // Collect all files (including from directories)
    let mut all_files = Vec::new();
    for file_path_str in &file_paths {
        let path = std::path::Path::new(file_path_str);
        let collected = collect_files(path);
        tracing::info!("Collected {} files from path: {}", collected.len(), file_path_str);
        all_files.extend(collected);
    }

    tracing::info!("Total files to import: {}", all_files.len());

    let mut imported = Vec::new();

    for source in &all_files {
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
    // Get asset details before deleting from database
    for id in &ids {
        let asset = queries::get_asset(&pool, id).await?;
        let library = queries::get_library(&pool, &asset.library_id).await?;
        let library_root = std::path::Path::new(&library.root_path);

        // Delete the actual file
        let file_path = library_root.join(&asset.relative_path);
        if file_path.exists() {
            tracing::info!("Deleting file: {:?}", file_path);
            std::fs::remove_file(&file_path)?;
        }

        // Delete the thumbnail if it exists
        if let Some(thumb_rel) = &asset.thumbnail_path {
            let thumb_path = library_root.join(thumb_rel);
            if thumb_path.exists() {
                tracing::info!("Deleting thumbnail: {:?}", thumb_path);
                std::fs::remove_file(&thumb_path)?;
            }
        }
    }

    // Delete from database
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
    let library = queries::get_library(&pool, &library_id).await?;
    let library_root = std::path::PathBuf::from(&library.root_path);

    // Get folders from database (folders with assets)
    let mut db_folders = queries::get_folders(&pool, &library_id).await?;

    // Recursively scan filesystem for all folders
    fn scan_folders(
        base_path: &std::path::Path,
        current_path: &std::path::Path,
        folders: &mut Vec<FolderInfo>,
    ) {
        if let Ok(entries) = std::fs::read_dir(current_path) {
            for entry in entries.flatten() {
                if let Ok(metadata) = entry.metadata() {
                    if metadata.is_dir() {
                        if let Some(name) = entry.file_name().to_str() {
                            // Skip hidden folders (starting with .)
                            if name.starts_with('.') {
                                continue;
                            }

                            let full_path = entry.path();
                            // Get relative path from library root
                            let relative_path = full_path
                                .strip_prefix(base_path)
                                .ok()
                                .and_then(|p| p.to_str())
                                .unwrap_or(name)
                                .to_string();

                            folders.push(FolderInfo {
                                path: relative_path.clone(),
                                name: name.to_string(),
                                asset_count: 0,
                            });

                            // Recursively scan subdirectories
                            scan_folders(base_path, &full_path, folders);
                        }
                    }
                }
            }
        }
    }

    let mut fs_folders = Vec::new();
    scan_folders(&library_root, &library_root, &mut fs_folders);

    // Merge with db_folders, avoiding duplicates
    for fs_folder in fs_folders {
        if !db_folders.iter().any(|f| f.path == fs_folder.path) {
            db_folders.push(fs_folder);
        }
    }

    // Sort by path
    db_folders.sort_by(|a, b| a.path.cmp(&b.path));

    Ok(db_folders)
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

/// Get thumbnail as base64 encoded data URL
#[tauri::command]
pub async fn get_thumbnail_data(
    id: String,
    pool: State<'_, SqlitePool>,
) -> Result<Option<String>, AppError> {
    let asset = queries::get_asset(&pool, &id).await?;
    if let Some(thumb_rel) = &asset.thumbnail_path {
        let library = queries::get_library(&pool, &asset.library_id).await?;
        let full_path = std::path::Path::new(&library.root_path).join(thumb_rel);

        // Read the file
        let data = std::fs::read(&full_path)?;

        // Encode as base64
        let base64_data = base64::engine::general_purpose::STANDARD.encode(&data);

        // Determine MIME type based on file extension
        let mime_type = match full_path.extension().and_then(|s| s.to_str()) {
            Some("png") => "image/png",
            Some("jpg") | Some("jpeg") => "image/jpeg",
            Some("gif") => "image/gif",
            Some("webp") => "image/webp",
            _ => "image/png", // default
        };

        Ok(Some(format!("data:{};base64,{}", mime_type, base64_data)))
    } else {
        Ok(None)
    }
}

/// Create a new folder
#[tauri::command]
pub async fn create_folder(
    library_id: String,
    folder_name: String,
    parent_path: String,
    pool: State<'_, SqlitePool>,
) -> Result<(), AppError> {
    // Validate folder name
    if folder_name.is_empty() || folder_name.contains('/') || folder_name.contains('\\') {
        return Err(AppError::InvalidInput("Invalid folder name".to_string()));
    }

    // Get library to access root path
    let library = queries::get_library(&pool, &library_id).await?;
    let library_root = std::path::Path::new(&library.root_path);

    // Build the full folder path
    let folder_path = if parent_path == "/" {
        library_root.join(&folder_name)
    } else {
        library_root.join(&parent_path).join(&folder_name)
    };

    // Check if folder already exists
    if folder_path.exists() {
        return Err(AppError::InvalidInput("Folder already exists".to_string()));
    }

    // Create the folder
    std::fs::create_dir_all(&folder_path)?;

    Ok(())
}

/// Rename a folder
#[tauri::command]
pub async fn rename_folder(
    library_id: String,
    old_path: String,
    new_name: String,
    pool: State<'_, SqlitePool>,
) -> Result<(), AppError> {
    // Validate new name
    if new_name.is_empty() || new_name.contains('/') || new_name.contains('\\') {
        return Err(AppError::InvalidInput("Invalid folder name".to_string()));
    }

    // Get library to access root path
    let library = queries::get_library(&pool, &library_id).await?;
    let library_root = std::path::Path::new(&library.root_path);

    let old_folder_path = library_root.join(&old_path);
    let new_folder_path = library_root.join(&new_name);

    // Check if old folder exists
    if !old_folder_path.exists() {
        return Err(AppError::InvalidInput("Folder does not exist".to_string()));
    }

    // Check if new folder already exists
    if new_folder_path.exists() {
        return Err(AppError::InvalidInput("A folder with this name already exists".to_string()));
    }

    // Rename the folder
    std::fs::rename(&old_folder_path, &new_folder_path)?;

    // Update all assets in the database that reference this folder
    queries::update_folder_path(&pool, &library_id, &old_path, &new_name).await?;

    Ok(())
}
