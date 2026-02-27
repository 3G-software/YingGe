use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use std::io::{Read, Write};
use std::path::Path;
use tauri::{AppHandle, Manager, State};
use uuid::Uuid;
use zip::{write::SimpleFileOptions, ZipArchive, ZipWriter};

use crate::db::{models::{Asset, Library}, queries};
use crate::error::AppError;

/// Exported library data structure
#[derive(Serialize, Deserialize)]
pub struct ExportedLibrary {
    pub library: LibraryExport,
    pub assets: Vec<AssetExport>,
    pub tags: Vec<TagExport>,
    pub asset_tags: Vec<AssetTagExport>,
}

#[derive(Serialize, Deserialize)]
pub struct LibraryExport {
    pub name: String,
}

#[derive(Serialize, Deserialize)]
pub struct AssetExport {
    pub id: String,
    pub file_name: String,
    pub original_name: String,
    pub relative_path: String,
    pub file_type: String,
    pub mime_type: String,
    pub width: Option<i32>,
    pub height: Option<i32>,
    pub description: String,
    pub ai_description: String,
    pub folder_path: String,
}

#[derive(Serialize, Deserialize)]
pub struct TagExport {
    pub id: String,
    pub name: String,
    pub color: String,
    pub category: String,
    pub is_ai: bool,
}

#[derive(Serialize, Deserialize)]
pub struct AssetTagExport {
    pub asset_id: String,
    pub tag_id: String,
}

/// Result of checking for duplicates during import
#[derive(Serialize)]
pub struct ImportCheckResult {
    pub has_duplicates: bool,
    pub duplicate_assets: Vec<DuplicateAsset>,
    pub library_name: String,
    pub total_assets: usize,
}

#[derive(Serialize)]
pub struct DuplicateAsset {
    pub file_name: String,
    pub relative_path: String,
}

/// Export a single library to a zip file
#[tauri::command]
pub async fn export_library(
    library_id: String,
    output_path: String,
    pool: State<'_, SqlitePool>,
) -> Result<String, AppError> {
    let library = queries::get_library(&pool, &library_id).await?;
    let library_root = Path::new(&library.root_path);

    // Get all assets for this library
    let assets_result = queries::get_assets(&pool, &library_id, None, None, 1, 100000, "imported_at", "desc").await?;
    let assets = assets_result.assets;

    // Get all tags for this library
    let tags = queries::list_tags(&pool, &library_id, None).await?;

    // Get asset-tag relationships
    let mut asset_tags = Vec::new();
    for asset in &assets {
        let asset_tag_list = queries::get_asset_tags(&pool, &asset.id).await?;
        for tag in asset_tag_list {
            asset_tags.push(AssetTagExport {
                asset_id: asset.id.clone(),
                tag_id: tag.id.clone(),
            });
        }
    }

    // Create export data
    let export_data = ExportedLibrary {
        library: LibraryExport {
            name: library.name.clone(),
        },
        assets: assets.iter().map(|a| AssetExport {
            id: a.id.clone(),
            file_name: a.file_name.clone(),
            original_name: a.original_name.clone(),
            relative_path: a.relative_path.clone(),
            file_type: a.file_type.clone(),
            mime_type: a.mime_type.clone(),
            width: a.width,
            height: a.height,
            description: a.description.clone(),
            ai_description: a.ai_description.clone(),
            folder_path: a.folder_path.clone(),
        }).collect(),
        tags: tags.iter().map(|t| TagExport {
            id: t.id.clone(),
            name: t.name.clone(),
            color: t.color.clone(),
            category: t.category.clone(),
            is_ai: t.is_ai,
        }).collect(),
        asset_tags,
    };

    // Create zip file
    let file = std::fs::File::create(&output_path)?;
    let mut zip = ZipWriter::new(file);
    let options = SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);

    // Write metadata.json
    let metadata_json = serde_json::to_string_pretty(&export_data)?;
    zip.start_file("metadata.json", options)?;
    zip.write_all(metadata_json.as_bytes())?;

    // Write all asset files
    for asset in &assets {
        let file_path = library_root.join(&asset.relative_path);
        if file_path.exists() {
            let mut file_data = Vec::new();
            let mut f = std::fs::File::open(&file_path)?;
            f.read_to_end(&mut file_data)?;

            let zip_path = format!("files/{}", asset.relative_path);
            zip.start_file(&zip_path, options)?;
            zip.write_all(&file_data)?;
        }
    }

    zip.finish()?;

    Ok(output_path)
}

/// Export all libraries to a single zip file
#[tauri::command]
pub async fn export_all_libraries(
    output_path: String,
    pool: State<'_, SqlitePool>,
) -> Result<String, AppError> {
    let libraries = queries::list_libraries(&pool).await?;

    let file = std::fs::File::create(&output_path)?;
    let mut zip = ZipWriter::new(file);
    let options = SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);

    let mut all_exports = Vec::new();

    for library in &libraries {
        let library_root = Path::new(&library.root_path);

        // Get all assets for this library
        let assets_result = queries::get_assets(&pool, &library.id, None, None, 1, 100000, "imported_at", "desc").await?;
        let assets = assets_result.assets;

        // Get all tags for this library
        let tags = queries::list_tags(&pool, &library.id, None).await?;

        // Get asset-tag relationships
        let mut asset_tags = Vec::new();
        for asset in &assets {
            let asset_tag_list = queries::get_asset_tags(&pool, &asset.id).await?;
            for tag in asset_tag_list {
                asset_tags.push(AssetTagExport {
                    asset_id: asset.id.clone(),
                    tag_id: tag.id.clone(),
                });
            }
        }

        let export_data = ExportedLibrary {
            library: LibraryExport {
                name: library.name.clone(),
            },
            assets: assets.iter().map(|a| AssetExport {
                id: a.id.clone(),
                file_name: a.file_name.clone(),
                original_name: a.original_name.clone(),
                relative_path: a.relative_path.clone(),
                file_type: a.file_type.clone(),
                mime_type: a.mime_type.clone(),
                width: a.width,
                height: a.height,
                description: a.description.clone(),
                ai_description: a.ai_description.clone(),
                folder_path: a.folder_path.clone(),
            }).collect(),
            tags: tags.iter().map(|t| TagExport {
                id: t.id.clone(),
                name: t.name.clone(),
                color: t.color.clone(),
                category: t.category.clone(),
                is_ai: t.is_ai,
            }).collect(),
            asset_tags,
        };

        all_exports.push(export_data);

        // Write asset files under library folder
        for asset in &assets {
            let file_path = library_root.join(&asset.relative_path);
            if file_path.exists() {
                let mut file_data = Vec::new();
                let mut f = std::fs::File::open(&file_path)?;
                f.read_to_end(&mut file_data)?;

                let zip_path = format!("{}/files/{}", library.name, asset.relative_path);
                zip.start_file(&zip_path, options)?;
                zip.write_all(&file_data)?;
            }
        }
    }

    // Write combined metadata
    let metadata_json = serde_json::to_string_pretty(&all_exports)?;
    zip.start_file("metadata.json", options)?;
    zip.write_all(metadata_json.as_bytes())?;

    zip.finish()?;

    Ok(output_path)
}

/// Check for duplicates before importing
#[tauri::command]
pub async fn check_import_library(
    zip_path: String,
    target_library_id: Option<String>,
    pool: State<'_, SqlitePool>,
) -> Result<ImportCheckResult, AppError> {
    let file = std::fs::File::open(&zip_path)?;
    let mut archive = ZipArchive::new(file)
        .map_err(|e| AppError::InvalidInput(format!("Invalid zip file: {}", e)))?;

    // Read metadata
    let mut metadata_content = String::new();
    {
        let mut metadata_file = archive.by_name("metadata.json")
            .map_err(|e| AppError::InvalidInput(format!("Missing metadata.json: {}", e)))?;
        metadata_file.read_to_string(&mut metadata_content)?;
    }

    // Try to parse as single library first
    let export_data: ExportedLibrary = if let Ok(single) = serde_json::from_str::<ExportedLibrary>(&metadata_content) {
        single
    } else {
        // Try to parse as array of libraries (from export_all_libraries)
        let multiple: Vec<ExportedLibrary> = serde_json::from_str(&metadata_content)
            .map_err(|e| AppError::InvalidInput(format!("Invalid metadata format: {}", e)))?;

        if multiple.is_empty() {
            return Err(AppError::InvalidInput("No libraries found in export".to_string()));
        }

        // For now, only check the first library
        // TODO: Support importing multiple libraries
        multiple.into_iter().next().unwrap()
    };

    let mut duplicate_assets = Vec::new();

    if let Some(lib_id) = &target_library_id {
        // Check against existing library
        let existing_assets = queries::get_assets(&pool, lib_id, None, None, 1, 100000, "imported_at", "desc").await?;

        for asset in &export_data.assets {
            if existing_assets.assets.iter().any(|a| a.relative_path == asset.relative_path) {
                duplicate_assets.push(DuplicateAsset {
                    file_name: asset.file_name.clone(),
                    relative_path: asset.relative_path.clone(),
                });
            }
        }
    }

    Ok(ImportCheckResult {
        has_duplicates: !duplicate_assets.is_empty(),
        duplicate_assets,
        library_name: export_data.library.name.clone(),
        total_assets: export_data.assets.len(),
    })
}

/// Import a library from a zip file
#[tauri::command]
pub async fn import_library(
    zip_path: String,
    target_path: String,
    merge_mode: String, // "replace" or "skip"
    pool: State<'_, SqlitePool>,
) -> Result<Library, AppError> {
    tracing::info!("Starting import from {} to {} with merge mode: {}", zip_path, target_path, merge_mode);

    let file = std::fs::File::open(&zip_path)?;
    let mut archive = ZipArchive::new(file)
        .map_err(|e| AppError::InvalidInput(format!("Invalid zip file: {}", e)))?;

    // Read metadata
    let mut metadata_content = String::new();
    {
        let mut metadata_file = archive.by_name("metadata.json")
            .map_err(|e| AppError::InvalidInput(format!("Missing metadata.json: {}", e)))?;
        metadata_file.read_to_string(&mut metadata_content)?;
    }

    // Try to parse as single library first
    let (export_data, is_multi_library): (ExportedLibrary, bool) = if let Ok(single) = serde_json::from_str::<ExportedLibrary>(&metadata_content) {
        (single, false)
    } else {
        // Try to parse as array of libraries (from export_all_libraries)
        let multiple: Vec<ExportedLibrary> = serde_json::from_str(&metadata_content)
            .map_err(|e| AppError::InvalidInput(format!("Invalid metadata format: {}", e)))?;

        if multiple.is_empty() {
            return Err(AppError::InvalidInput("No libraries found in export".to_string()));
        }

        // For now, only import the first library
        // TODO: Support importing multiple libraries
        (multiple.into_iter().next().unwrap(), true)
    };

    tracing::info!("Importing library: {}, {} assets, {} tags",
        export_data.library.name, export_data.assets.len(), export_data.tags.len());

    // For multi-library exports, the library lives in a subdirectory named after the library
    let effective_target_path = if is_multi_library {
        format!("{}/{}", target_path.trim_end_matches('/'), export_data.library.name)
    } else {
        target_path.clone()
    };

    let target_root = Path::new(&effective_target_path);
    std::fs::create_dir_all(target_root)?;

    // Check if library with same name exists
    let existing_libraries = queries::list_libraries(&pool).await?;
    let existing_library = existing_libraries.iter().find(|l| l.name == export_data.library.name);

    let library = if let Some(existing) = existing_library {
        // Update existing library's root path to the new target path
        tracing::info!("Updating existing library {} root path from {} to {}",
            existing.name, existing.root_path, effective_target_path);

        // Update the library's root_path in the database
        sqlx::query("UPDATE libraries SET root_path = ? WHERE id = ?")
            .bind(&effective_target_path)
            .bind(&existing.id)
            .execute(pool.inner())
            .await?;

        // Return updated library
        queries::get_library(&pool, &existing.id).await?
    } else {
        // Create new library
        queries::create_library(&pool, &export_data.library.name, &effective_target_path).await?
    };

    let library_root = Path::new(&library.root_path);

    // Get existing assets for duplicate checking
    let existing_assets = queries::get_assets(&pool, &library.id, None, None, 1, 100000, "imported_at", "desc").await?;

    // Create ID mapping for tags (old ID -> new ID)
    let mut tag_id_map = std::collections::HashMap::new();

    // Import tags first
    for tag_export in &export_data.tags {
        // Check if tag with same name exists
        let existing_tags = queries::list_tags(&pool, &library.id, None).await?;
        let existing_tag = existing_tags.iter().find(|t| t.name == tag_export.name);

        let new_tag_id = if let Some(existing) = existing_tag {
            existing.id.clone()
        } else {
            let created_tag = queries::create_tag(
                &pool,
                &library.id,
                &tag_export.name,
                &tag_export.color,
                &tag_export.category,
                tag_export.is_ai,
            ).await?;
            created_tag.id
        };

        tag_id_map.insert(tag_export.id.clone(), new_tag_id);
    }

    // Create ID mapping for assets (old ID -> new ID)
    let mut asset_id_map: std::collections::HashMap<String, String> = std::collections::HashMap::new();

    // Extract and import assets
    let mut imported_count = 0;
    let mut skipped_count = 0;
    for asset_export in &export_data.assets {
        let is_duplicate = existing_assets.assets.iter().any(|a| a.relative_path == asset_export.relative_path);

        if is_duplicate && merge_mode == "skip" {
            // Skip this asset
            skipped_count += 1;
            continue;
        }

        // Extract file from zip - read data first, then drop zip_file before await
        let zip_file_path = if is_multi_library {
            format!("{}/files/{}", export_data.library.name, asset_export.relative_path)
        } else {
            format!("files/{}", asset_export.relative_path)
        };
        let file_data_opt = {
            if let Ok(mut zip_file) = archive.by_name(&zip_file_path) {
                let mut file_data = Vec::new();
                zip_file.read_to_end(&mut file_data).ok();
                Some(file_data)
            } else {
                tracing::warn!("File not found in archive: {}", zip_file_path);
                None
            }
        };

        if let Some(file_data) = file_data_opt {
            let output_path = library_root.join(&asset_export.relative_path);

            // Create parent directories
            if let Some(parent) = output_path.parent() {
                std::fs::create_dir_all(parent)?;
            }

            // Write file
            std::fs::write(&output_path, &file_data)?;
            tracing::debug!("Extracted file to: {:?}", output_path);

            let file_size = file_data.len() as i64;
            let file_hash = crate::storage::file_ops::compute_file_hash(&output_path)?;

            if is_duplicate && merge_mode == "replace" {
                // Find and update existing asset
                if let Some(existing) = existing_assets.assets.iter().find(|a| a.relative_path == asset_export.relative_path) {
                    let updated_asset = Asset {
                        id: existing.id.clone(),
                        library_id: library.id.clone(),
                        file_name: asset_export.file_name.clone(),
                        original_name: asset_export.original_name.clone(),
                        relative_path: asset_export.relative_path.clone(),
                        file_type: asset_export.file_type.clone(),
                        mime_type: asset_export.mime_type.clone(),
                        file_size,
                        file_hash,
                        width: asset_export.width,
                        height: asset_export.height,
                        duration_ms: None,
                        description: asset_export.description.clone(),
                        ai_description: asset_export.ai_description.clone(),
                        ai_description_en: String::new(),
                        ai_description_zh: String::new(),
                        thumbnail_path: existing.thumbnail_path.clone(),
                        folder_path: asset_export.folder_path.clone(),
                        created_at: existing.created_at.clone(),
                        updated_at: String::new(),
                        imported_at: existing.imported_at.clone(),
                    };
                    queries::update_asset(&pool, &updated_asset).await?;
                    asset_id_map.insert(asset_export.id.clone(), existing.id.clone());
                }
            } else {
                // Create new asset
                let new_id = Uuid::new_v4().to_string();

                // Generate thumbnail
                let thumb_path = crate::storage::thumbnail::generate_thumbnail(
                    &output_path,
                    library_root,
                    &new_id,
                ).ok();

                let new_asset = Asset {
                    id: new_id.clone(),
                    library_id: library.id.clone(),
                    file_name: asset_export.file_name.clone(),
                    original_name: asset_export.original_name.clone(),
                    relative_path: asset_export.relative_path.clone(),
                    file_type: asset_export.file_type.clone(),
                    mime_type: asset_export.mime_type.clone(),
                    file_size,
                    file_hash,
                    width: asset_export.width,
                    height: asset_export.height,
                    duration_ms: None,
                    description: asset_export.description.clone(),
                    ai_description: asset_export.ai_description.clone(),
                    ai_description_en: String::new(),
                    ai_description_zh: String::new(),
                    thumbnail_path: thumb_path,
                    folder_path: asset_export.folder_path.clone(),
                    created_at: String::new(),
                    updated_at: String::new(),
                    imported_at: String::new(),
                };

                queries::insert_asset(&pool, &new_asset).await?;
                asset_id_map.insert(asset_export.id.clone(), new_id);
                imported_count += 1;
            }
        }
    }

    tracing::info!("Import complete: {} assets imported, {} skipped", imported_count, skipped_count);

    // Import asset-tag relationships
    for asset_tag in &export_data.asset_tags {
        if let (Some(new_asset_id), Some(new_tag_id)) = (
            asset_id_map.get(&asset_tag.asset_id),
            tag_id_map.get(&asset_tag.tag_id),
        ) {
            let tag_ids = vec![new_tag_id.clone()];
            let _ = queries::assign_tags(&pool, new_asset_id, &tag_ids).await;
        }
    }

    Ok(library)
}

/// Reset the application - delete all data
#[tauri::command]
pub async fn reset_application(
    app: AppHandle,
    pool: State<'_, SqlitePool>,
) -> Result<(), AppError> {
    // Get all libraries
    let libraries = queries::list_libraries(&pool).await?;

    // Delete all libraries and their files
    for library in libraries {
        // Delete library files
        let library_path = Path::new(&library.root_path);
        if library_path.exists() {
            std::fs::remove_dir_all(library_path).ok();
        }
    }

    // Clear all database tables
    sqlx::query("DELETE FROM asset_tags").execute(pool.inner()).await?;
    sqlx::query("DELETE FROM tags").execute(pool.inner()).await?;
    sqlx::query("DELETE FROM embeddings").execute(pool.inner()).await?;
    sqlx::query("DELETE FROM spritesheet_metadata").execute(pool.inner()).await?;
    sqlx::query("DELETE FROM assets").execute(pool.inner()).await?;
    sqlx::query("DELETE FROM libraries").execute(pool.inner()).await?;
    sqlx::query("DELETE FROM ai_config").execute(pool.inner()).await?;
    sqlx::query("DELETE FROM plugins").execute(pool.inner()).await?;

    // Clear thumbnails directory
    let app_data_dir = app.path().app_data_dir()
        .map_err(|e| AppError::Io(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())))?;
    let thumbnails_dir = app_data_dir.join("thumbnails");
    if thumbnails_dir.exists() {
        std::fs::remove_dir_all(&thumbnails_dir).ok();
    }

    Ok(())
}
