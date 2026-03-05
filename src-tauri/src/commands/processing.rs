use sqlx::SqlitePool;
use tauri::State;
use uuid::Uuid;

use crate::db::{models::Asset, queries};
use crate::error::AppError;
use crate::processing::{background, compress, crop, descriptor, spritesheet};

#[tauri::command]
pub async fn remove_background(
    asset_id: String,
    suffix: String, // localized suffix like "_nobg" or "_去背景"
    pool: State<'_, SqlitePool>,
) -> Result<Asset, AppError> {
    let asset = queries::get_asset(&pool, &asset_id).await?;
    let library = queries::get_library(&pool, &asset.library_id).await?;
    let source_path = std::path::Path::new(&library.root_path).join(&asset.relative_path);

    let result_img = background::remove_background_smart(&source_path)?;

    // Save as new asset in same folder as original
    let new_id = Uuid::new_v4().to_string();
    let base_name = asset.file_name.rsplit('.').nth(1).unwrap_or(&asset.file_name);
    let output_name = format!("{}{}.png", base_name, suffix);
    let library_root = std::path::Path::new(&library.root_path);

    // Save to same folder as original, or library root if no folder
    let output_dir = if asset.folder_path.is_empty() || asset.folder_path == "/" {
        library_root.to_path_buf()
    } else {
        library_root.join(&asset.folder_path)
    };
    std::fs::create_dir_all(&output_dir)?;

    let output_path = output_dir.join(&output_name);
    result_img.save(&output_path)?;

    let relative_path = if asset.folder_path.is_empty() || asset.folder_path == "/" {
        output_name.clone()
    } else {
        format!("{}/{}", asset.folder_path, output_name)
    };

    let thumb_path = crate::storage::thumbnail::generate_thumbnail(
        &output_path,
        std::path::Path::new(&library.root_path),
        &new_id,
    )
    .ok();

    let (w, h) = (result_img.width() as i32, result_img.height() as i32);
    let file_size = std::fs::metadata(&output_path)?.len() as i64;
    let file_hash = crate::storage::file_ops::compute_file_hash(&output_path)?;

    let new_asset = Asset {
        id: new_id.clone(),
        library_id: asset.library_id.clone(),
        file_name: output_name,
        original_name: asset.original_name.clone(),
        relative_path,
        file_type: "image".to_string(),
        mime_type: "image/png".to_string(),
        file_size,
        file_hash,
        width: Some(w),
        height: Some(h),
        duration_ms: None,
        description: asset.description.clone(),
        ai_description: asset.ai_description.clone(),
        ai_description_en: asset.ai_description_en.clone(),
        ai_description_zh: asset.ai_description_zh.clone(),
        thumbnail_path: thumb_path,
        folder_path: asset.folder_path.clone(),
        created_at: String::new(),
        updated_at: String::new(),
        imported_at: String::new(),
    };

    let saved = queries::insert_asset(&pool, &new_asset).await?;

    // Copy tags from original asset
    let original_tags = queries::get_asset_tags(&pool, &asset_id).await?;
    if !original_tags.is_empty() {
        let tag_ids: Vec<String> = original_tags.iter().map(|t| t.id.clone()).collect();
        queries::assign_tags(&pool, &new_id, &tag_ids).await?;
    }

    Ok(saved)
}

#[derive(serde::Serialize)]
pub struct SpritesheetResult {
    pub image_asset: Asset,
    pub descriptor_content: String,
}

#[tauri::command]
pub async fn merge_spritesheet(
    asset_ids: Vec<String>,
    columns: u32,
    padding: u32,
    output_name: String,
    descriptor_format: String,
    pool: State<'_, SqlitePool>,
) -> Result<SpritesheetResult, AppError> {
    if asset_ids.is_empty() {
        return Err(AppError::InvalidInput("No assets selected".to_string()));
    }

    // Load asset info and paths
    let first_asset = queries::get_asset(&pool, &asset_ids[0]).await?;
    let library = queries::get_library(&pool, &first_asset.library_id).await?;
    let library_root = std::path::Path::new(&library.root_path);

    let mut image_paths = Vec::new();
    for id in &asset_ids {
        let asset = queries::get_asset(&pool, id).await?;
        let path = library_root.join(&asset.relative_path);
        image_paths.push((asset.file_name.clone(), path));
    }

    let paths_ref: Vec<(String, &std::path::Path)> = image_paths
        .iter()
        .map(|(name, path)| (name.clone(), path.as_path()))
        .collect();

    let (sheet_img, info) = spritesheet::merge_spritesheet(&paths_ref, columns, padding)?;

    // Save sprite sheet to library root
    let new_id = Uuid::new_v4().to_string();
    let img_filename = format!("{}.png", output_name);
    let output_path = library_root.join(&img_filename);
    sheet_img.save(&output_path)?;

    let relative_path = img_filename.clone();

    // Generate descriptor
    let descriptor_content = match descriptor_format.as_str() {
        "xml_unity" => descriptor::generate_unity_xml_descriptor(&info, &img_filename),
        "plist_cocos2d" => descriptor::generate_cocos2d_plist_descriptor(&info, &img_filename),
        _ => descriptor::generate_json_descriptor(&info, &img_filename),
    };

    // Save descriptor file alongside in library root
    let desc_ext = match descriptor_format.as_str() {
        "xml_unity" => "xml",
        "plist_cocos2d" => "plist",
        _ => "json",
    };
    let desc_path = library_root.join(format!("{}.{}", output_name, desc_ext));
    std::fs::write(&desc_path, &descriptor_content)?;

    let thumb_path =
        crate::storage::thumbnail::generate_thumbnail(&output_path, library_root, &new_id).ok();

    let file_size = std::fs::metadata(&output_path)?.len() as i64;
    let file_hash = crate::storage::file_ops::compute_file_hash(&output_path)?;

    let new_asset = Asset {
        id: new_id,
        library_id: first_asset.library_id.clone(),
        file_name: format!("{}.png", output_name),
        original_name: format!("{}.png", output_name),
        relative_path,
        file_type: "image".to_string(),
        mime_type: "image/png".to_string(),
        file_size,
        file_hash,
        width: Some(info.width as i32),
        height: Some(info.height as i32),
        duration_ms: None,
        description: format!("Sprite sheet with {} frames", info.frames.len()),
        ai_description: String::new(),
        ai_description_en: String::new(),
        ai_description_zh: String::new(),
        thumbnail_path: thumb_path,
        folder_path: first_asset.folder_path.clone(),
        created_at: String::new(),
        updated_at: String::new(),
        imported_at: String::new(),
    };

    let saved = queries::insert_asset(&pool, &new_asset).await?;

    // Save spritesheet metadata to database
    let sprite_info_json = serde_json::to_string(&info.frames)?;
    sqlx::query(
        "INSERT INTO spritesheet_metadata (asset_id, sprite_info, sheet_width, sheet_height) VALUES (?, ?, ?, ?)"
    )
    .bind(&saved.id)
    .bind(&sprite_info_json)
    .bind(info.width as i64)
    .bind(info.height as i64)
    .execute(pool.inner())
    .await?;

    Ok(SpritesheetResult {
        image_asset: saved,
        descriptor_content,
    })
}

#[tauri::command]
pub async fn get_spritesheet_descriptor(
    asset_id: String,
    pool: State<'_, SqlitePool>,
) -> Result<Option<String>, AppError> {
    // Check if this asset has spritesheet metadata in database
    let exists = sqlx::query_scalar::<_, i64>("SELECT 1 FROM spritesheet_metadata WHERE asset_id = ?")
        .bind(&asset_id)
        .fetch_optional(pool.inner())
        .await?
        .is_some();

    if exists {
        // Return a placeholder to indicate descriptor exists
        // The actual content will be generated on demand with format
        Ok(Some(String::from("exists")))
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub async fn get_spritesheet_descriptor_with_format(
    asset_id: String,
    format: String,
    pool: State<'_, SqlitePool>,
) -> Result<Option<String>, AppError> {
    // Check if this asset has spritesheet metadata
    let row = sqlx::query_as::<_, (String, i64, i64)>(
        "SELECT sprite_info, sheet_width, sheet_height FROM spritesheet_metadata WHERE asset_id = ?"
    )
    .bind(&asset_id)
    .fetch_optional(pool.inner())
    .await?;

    if let Some((sprite_info_json, sheet_width, sheet_height)) = row {
        // Parse sprite info
        let frames: Vec<spritesheet::SpriteFrame> = serde_json::from_str(&sprite_info_json)?;

        // Reconstruct SpritesheetInfo
        let info = spritesheet::SpritesheetInfo {
            width: sheet_width as u32,
            height: sheet_height as u32,
            frames,
        };

        // Get asset filename
        let asset = queries::get_asset(&pool, &asset_id).await?;
        let img_filename = &asset.file_name;

        // Generate descriptor based on format
        let descriptor_content = match format.as_str() {
            "xml_unity" => descriptor::generate_unity_xml_descriptor(&info, img_filename),
            "xml_cocos" | "plist_cocos2d" => descriptor::generate_cocos2d_plist_descriptor(&info, img_filename),
            _ => descriptor::generate_json_descriptor(&info, img_filename),
        };

        return Ok(Some(descriptor_content));
    }

    Ok(None)
}

#[tauri::command]
pub async fn split_image(
    asset_id: String,
    rows: u32,
    cols: u32,
    pool: State<'_, SqlitePool>,
) -> Result<Vec<Asset>, AppError> {
    let asset = queries::get_asset(&pool, &asset_id).await?;
    let library = queries::get_library(&pool, &asset.library_id).await?;
    let library_root = std::path::Path::new(&library.root_path);
    let source_path = library_root.join(&asset.relative_path);

    let sub_images = spritesheet::split_image_grid(&source_path, rows, cols)?;

    // Save to same folder as original, or library root if no folder
    let output_dir = if asset.folder_path.is_empty() || asset.folder_path == "/" {
        library_root.to_path_buf()
    } else {
        library_root.join(&asset.folder_path)
    };
    std::fs::create_dir_all(&output_dir)?;

    let base_name = asset
        .file_name
        .rsplit('.')
        .nth(1)
        .unwrap_or(&asset.file_name);

    let mut results = Vec::new();

    for (i, sub_img) in sub_images.iter().enumerate() {
        let new_id = Uuid::new_v4().to_string();
        let file_name = format!("{}_{}.png", base_name, i);
        let output_path = output_dir.join(&file_name);
        sub_img.save(&output_path)?;

        let relative_path = if asset.folder_path.is_empty() || asset.folder_path == "/" {
            file_name.clone()
        } else {
            format!("{}/{}", asset.folder_path, file_name)
        };

        let thumb_path =
            crate::storage::thumbnail::generate_thumbnail(&output_path, library_root, &new_id)
                .ok();

        let file_size = std::fs::metadata(&output_path)?.len() as i64;
        let file_hash = crate::storage::file_ops::compute_file_hash(&output_path)?;

        let new_asset = Asset {
            id: new_id,
            library_id: asset.library_id.clone(),
            file_name,
            original_name: asset.original_name.clone(),
            relative_path,
            file_type: "image".to_string(),
            mime_type: "image/png".to_string(),
            file_size,
            file_hash,
            width: Some(sub_img.width() as i32),
            height: Some(sub_img.height() as i32),
            duration_ms: None,
            description: format!("Split from {} (part {})", asset.file_name, i + 1),
            ai_description: String::new(),
            ai_description_en: String::new(),
            ai_description_zh: String::new(),
            thumbnail_path: thumb_path,
            folder_path: asset.folder_path.clone(),
            created_at: String::new(),
            updated_at: String::new(),
            imported_at: String::new(),
        };

        let saved = queries::insert_asset(&pool, &new_asset).await?;
        results.push(saved);
    }

    Ok(results)
}

#[derive(serde::Serialize)]
pub struct CompressResult {
    pub asset: Asset,
    pub original_size: i64,
    pub compressed_size: i64,
    pub compression_ratio: f64,
}

#[tauri::command]
pub async fn compress_image(
    asset_id: String,
    max_width: Option<u32>,
    max_height: Option<u32>,
    quality: u8,
    output_format: String, // "jpeg" or "png"
    suffix: String,        // localized suffix like "_compressed" or "_压缩"
    pool: State<'_, SqlitePool>,
) -> Result<CompressResult, AppError> {
    tracing::info!("=== Compress Image Started ===");
    tracing::info!("asset_id: {}, quality: {}, format: {}, suffix: {}", asset_id, quality, output_format, suffix);

    let asset = queries::get_asset(&pool, &asset_id).await?;
    tracing::info!("Asset found: {} ({})", asset.file_name, asset.relative_path);

    let library = queries::get_library(&pool, &asset.library_id).await?;
    let library_root = std::path::Path::new(&library.root_path);
    let source_path = library_root.join(&asset.relative_path);
    tracing::info!("Source path: {:?}", source_path);

    if !source_path.exists() {
        tracing::error!("Source file does not exist: {:?}", source_path);
        return Err(AppError::NotFound(format!("Source file not found: {:?}", source_path)));
    }

    let original_size = asset.file_size;

    // Compress the image
    tracing::info!("Compressing image...");
    let compressed_img = compress::compress_image(&source_path, max_width, max_height, quality)?;
    tracing::info!("Image compressed, dimensions: {}x{}", compressed_img.width(), compressed_img.height());

    // Save as new asset
    let new_id = Uuid::new_v4().to_string();

    // Save to the same folder as the original asset, or library root if no folder
    let output_dir = if asset.folder_path.is_empty() || asset.folder_path == "/" {
        library_root.to_path_buf()
    } else {
        library_root.join(&asset.folder_path)
    };
    tracing::info!("Output directory: {:?}", output_dir);

    if let Err(e) = std::fs::create_dir_all(&output_dir) {
        tracing::error!("Failed to create output directory {:?}: {}", output_dir, e);
        return Err(AppError::Io(e));
    }
    tracing::info!("Output directory created/verified");

    let (output_ext, mime_type, output_bytes) = if output_format == "jpeg" || output_format == "jpg" {
        let bytes = compress::compress_to_jpeg_bytes(&compressed_img, quality)?;
        ("jpg", "image/jpeg", bytes)
    } else {
        let bytes = compress::compress_to_png_bytes(&compressed_img)?;
        ("png", "image/png", bytes)
    };

    let output_path = output_dir.join(format!("{}.{}", new_id, output_ext));
    tracing::info!("Writing compressed image to: {:?}", output_path);

    if let Err(e) = std::fs::write(&output_path, &output_bytes) {
        tracing::error!("Failed to write compressed image to {:?}: {}", output_path, e);
        return Err(AppError::Io(e));
    }
    tracing::info!("Compressed image written successfully, size: {} bytes", output_bytes.len());

    // Generate output filename with localized suffix
    let base_name = if let Some(dot_pos) = asset.file_name.rfind('.') {
        &asset.file_name[..dot_pos]
    } else {
        &asset.file_name
    };
    let output_name = format!("{}{}.{}", base_name, suffix, output_ext);

    let relative_path = if asset.folder_path.is_empty() || asset.folder_path == "/" {
        output_name.clone()
    } else {
        format!("{}/{}", asset.folder_path, output_name)
    };
    let compressed_size = output_bytes.len() as i64;
    let compression_ratio = if original_size > 0 {
        (1.0 - (compressed_size as f64 / original_size as f64)) * 100.0
    } else {
        0.0
    };

    let thumb_path =
        crate::storage::thumbnail::generate_thumbnail(&output_path, library_root, &new_id).ok();

    let file_hash = crate::storage::file_ops::compute_file_hash(&output_path)?;

    let new_asset = Asset {
        id: new_id.clone(),
        library_id: asset.library_id.clone(),
        file_name: output_name,
        original_name: asset.original_name.clone(),
        relative_path,
        file_type: "image".to_string(),
        mime_type: mime_type.to_string(),
        file_size: compressed_size,
        file_hash,
        width: Some(compressed_img.width() as i32),
        height: Some(compressed_img.height() as i32),
        duration_ms: None,
        description: asset.description.clone(),
        ai_description: asset.ai_description.clone(),
        ai_description_en: asset.ai_description_en.clone(),
        ai_description_zh: asset.ai_description_zh.clone(),
        thumbnail_path: thumb_path,
        folder_path: asset.folder_path.clone(),
        created_at: String::new(),
        updated_at: String::new(),
        imported_at: String::new(),
    };

    let saved = queries::insert_asset(&pool, &new_asset).await?;

    // Copy tags from original asset
    let original_tags = queries::get_asset_tags(&pool, &asset_id).await?;
    if !original_tags.is_empty() {
        let tag_ids: Vec<String> = original_tags.iter().map(|t| t.id.clone()).collect();
        queries::assign_tags(&pool, &new_id, &tag_ids).await?;
    }

    Ok(CompressResult {
        asset: saved,
        original_size,
        compressed_size,
        compression_ratio,
    })
}

/// Merge multiple images into a sprite sheet with specified cell size
#[tauri::command]
pub async fn merge_spritesheet_with_size(
    asset_ids: Vec<String>,
    columns: u32,
    rows: u32,
    cell_width: u32,
    cell_height: u32,
    padding: u32,
    output_name: String,
    enable_compression: bool,
    pool: State<'_, SqlitePool>,
) -> Result<Asset, AppError> {
    if asset_ids.is_empty() {
        return Err(AppError::InvalidInput("No assets selected".to_string()));
    }

    tracing::info!("Merging {} images into spritesheet: {}x{} cells of {}x{}, compression: {}",
        asset_ids.len(), columns, rows, cell_width, cell_height, enable_compression);

    // Load asset info and paths
    let first_asset = queries::get_asset(&pool, &asset_ids[0]).await?;
    let library = queries::get_library(&pool, &first_asset.library_id).await?;
    let library_root = std::path::Path::new(&library.root_path);

    let mut image_paths = Vec::new();
    for id in &asset_ids {
        let asset = queries::get_asset(&pool, id).await?;
        let path = library_root.join(&asset.relative_path);
        image_paths.push((asset.file_name.clone(), path));
    }

    let paths_ref: Vec<(String, &std::path::Path)> = image_paths
        .iter()
        .map(|(name, path)| (name.clone(), path.as_path()))
        .collect();

    let (mut sheet_img, info) = spritesheet::merge_spritesheet_with_size(
        &paths_ref, columns, rows, cell_width, cell_height, padding
    )?;

    // Apply compression if enabled
    if enable_compression {
        tracing::info!("Applying compression to spritesheet");
        sheet_img = compress::compress_image_dynamic(&sheet_img, None, None, 85)?;
    }

    // Save sprite sheet to library root
    let new_id = Uuid::new_v4().to_string();
    let file_name = format!("{}.png", output_name);
    let output_path = library_root.join(&file_name);
    sheet_img.save(&output_path)?;

    let relative_path = file_name.clone();

    let thumb_path =
        crate::storage::thumbnail::generate_thumbnail(&output_path, library_root, &new_id).ok();

    let file_size = std::fs::metadata(&output_path)?.len() as i64;
    let file_hash = crate::storage::file_ops::compute_file_hash(&output_path)?;

    let new_asset = Asset {
        id: new_id,
        library_id: first_asset.library_id.clone(),
        file_name: format!("{}.png", output_name),
        original_name: format!("{}.png", output_name),
        relative_path,
        file_type: "image".to_string(),
        mime_type: "image/png".to_string(),
        file_size,
        file_hash,
        width: Some(info.width as i32),
        height: Some(info.height as i32),
        duration_ms: None,
        description: format!("Sprite sheet: {}x{} grid, {} frames{}",
            columns, rows, info.frames.len(),
            if enable_compression { " (compressed)" } else { "" }
        ),
        ai_description: String::new(),
        ai_description_en: String::new(),
        ai_description_zh: String::new(),
        thumbnail_path: thumb_path,
        folder_path: first_asset.folder_path.clone(),
        created_at: String::new(),
        updated_at: String::new(),
        imported_at: String::new(),
    };

    let saved = queries::insert_asset(&pool, &new_asset).await?;
    tracing::info!("Spritesheet created: {}", saved.file_name);

    Ok(saved)
}

/// Resize an image to specified dimensions
#[tauri::command]
pub async fn resize_image(
    asset_id: String,
    width: u32,
    height: u32,
    maintain_aspect: bool,
    suffix: String,
    pool: State<'_, SqlitePool>,
) -> Result<Asset, AppError> {
    tracing::info!("Resizing image {} to {}x{}, maintain_aspect: {}",
        asset_id, width, height, maintain_aspect);

    let asset = queries::get_asset(&pool, &asset_id).await?;
    let library = queries::get_library(&pool, &asset.library_id).await?;
    let library_root = std::path::Path::new(&library.root_path);
    let source_path = library_root.join(&asset.relative_path);

    let resized_img = spritesheet::resize_image(&source_path, width, height, maintain_aspect)?;

    // Generate output filename with suffix
    let base_name = if let Some(dot_pos) = asset.file_name.rfind('.') {
        &asset.file_name[..dot_pos]
    } else {
        &asset.file_name
    };
    let output_name = format!("{}{}.png", base_name, suffix);

    // Save as new asset to same folder as original, or library root if no folder
    let new_id = Uuid::new_v4().to_string();
    let output_dir = if asset.folder_path.is_empty() || asset.folder_path == "/" {
        library_root.to_path_buf()
    } else {
        library_root.join(&asset.folder_path)
    };
    std::fs::create_dir_all(&output_dir)?;

    let output_path = output_dir.join(&output_name);
    resized_img.save(&output_path)?;

    let relative_path = if asset.folder_path.is_empty() || asset.folder_path == "/" {
        output_name.clone()
    } else {
        format!("{}/{}", asset.folder_path, output_name)
    };

    let thumb_path =
        crate::storage::thumbnail::generate_thumbnail(&output_path, library_root, &new_id).ok();

    let file_size = std::fs::metadata(&output_path)?.len() as i64;
    let file_hash = crate::storage::file_ops::compute_file_hash(&output_path)?;

    let new_asset = Asset {
        id: new_id.clone(),
        library_id: asset.library_id.clone(),
        file_name: output_name,
        original_name: asset.original_name.clone(),
        relative_path,
        file_type: "image".to_string(),
        mime_type: "image/png".to_string(),
        file_size,
        file_hash,
        width: Some(resized_img.width() as i32),
        height: Some(resized_img.height() as i32),
        duration_ms: None,
        description: asset.description.clone(),
        ai_description: asset.ai_description.clone(),
        ai_description_en: asset.ai_description_en.clone(),
        ai_description_zh: asset.ai_description_zh.clone(),
        thumbnail_path: thumb_path,
        folder_path: asset.folder_path.clone(),
        created_at: String::new(),
        updated_at: String::new(),
        imported_at: String::new(),
    };

    let saved = queries::insert_asset(&pool, &new_asset).await?;

    // Copy tags from original asset
    let original_tags = queries::get_asset_tags(&pool, &asset_id).await?;
    if !original_tags.is_empty() {
        let tag_ids: Vec<String> = original_tags.iter().map(|t| t.id.clone()).collect();
        queries::assign_tags(&pool, &new_id, &tag_ids).await?;
    }

    tracing::info!("Image resized: {} -> {}x{}", saved.file_name, resized_img.width(), resized_img.height());

    Ok(saved)
}

/// Save edited image - replaces the original image
#[tauri::command]
pub async fn save_edited_image(
    asset_id: String,
    image_data: String, // base64 encoded PNG (with or without data URL prefix)
    pool: State<'_, SqlitePool>,
) -> Result<Asset, AppError> {
    use base64::Engine;

    let asset = queries::get_asset(&pool, &asset_id).await?;
    let library = queries::get_library(&pool, &asset.library_id).await?;
    let library_root = std::path::Path::new(&library.root_path);

    // Handle both formats: "data:image/png;base64,..." and raw base64
    let base64_data = if image_data.contains(',') {
        image_data.split(',').nth(1).unwrap_or(&image_data)
    } else {
        &image_data
    };

    // Decode base64 image data
    let image_bytes = base64::engine::general_purpose::STANDARD
        .decode(base64_data)
        .map_err(|e| AppError::InvalidInput(format!("Invalid base64 data: {}", e)))?;

    // Load image to get dimensions
    let img = image::load_from_memory(&image_bytes)?;

    // Get the original file path
    let output_path = library_root.join(&asset.relative_path);

    // Ensure the directory exists
    if let Some(parent) = output_path.parent() {
        std::fs::create_dir_all(parent)?;
    }

    // Overwrite the original file
    std::fs::write(&output_path, &image_bytes)?;

    // Regenerate thumbnail
    let thumb_path =
        crate::storage::thumbnail::generate_thumbnail(&output_path, library_root, &asset_id).ok();

    let file_size = image_bytes.len() as i64;
    let file_hash = crate::storage::file_ops::compute_file_hash(&output_path)?;

    // Update the existing asset record
    let updated_asset = Asset {
        id: asset.id.clone(),
        library_id: asset.library_id.clone(),
        file_name: asset.file_name.clone(),
        original_name: asset.original_name.clone(),
        relative_path: asset.relative_path.clone(),
        file_type: asset.file_type.clone(),
        mime_type: "image/png".to_string(),
        file_size,
        file_hash,
        width: Some(img.width() as i32),
        height: Some(img.height() as i32),
        duration_ms: None,
        description: asset.description.clone(),
        ai_description: asset.ai_description.clone(),
        ai_description_en: asset.ai_description_en.clone(),
        ai_description_zh: asset.ai_description_zh.clone(),
        thumbnail_path: thumb_path,
        folder_path: asset.folder_path.clone(),
        created_at: asset.created_at.clone(),
        updated_at: String::new(), // Will be set by database
        imported_at: asset.imported_at.clone(),
    };

    // Update the asset in database
    let saved = queries::update_asset(&pool, &updated_asset).await?;

    tracing::info!("Image edited and saved (replaced original): {} ({}x{})",
        saved.file_name, img.width(), img.height());

    Ok(saved)
}

/// Crop an image to the specified region and replace the original
#[tauri::command]
pub async fn crop_image(
    asset_id: String,
    x: u32,
    y: u32,
    width: u32,
    height: u32,
    pool: State<'_, SqlitePool>,
) -> Result<Asset, AppError> {
    tracing::info!("Cropping image {} to region: x={}, y={}, w={}, h={}",
        asset_id, x, y, width, height);

    let asset = queries::get_asset(&pool, &asset_id).await?;
    let library = queries::get_library(&pool, &asset.library_id).await?;
    let library_root = std::path::Path::new(&library.root_path);
    let source_path = library_root.join(&asset.relative_path);

    // Perform the crop
    let cropped_img = crop::crop_image(&source_path, x, y, width, height)?;

    // Get the original file path
    let output_path = library_root.join(&asset.relative_path);

    // Ensure the directory exists
    if let Some(parent) = output_path.parent() {
        std::fs::create_dir_all(parent)?;
    }

    // Overwrite the original file with cropped image
    cropped_img.save(&output_path)?;

    // Regenerate thumbnail
    let thumb_path =
        crate::storage::thumbnail::generate_thumbnail(&output_path, library_root, &asset_id).ok();

    let file_size = std::fs::metadata(&output_path)?.len() as i64;
    let file_hash = crate::storage::file_ops::compute_file_hash(&output_path)?;

    // Update the existing asset record
    let updated_asset = Asset {
        id: asset.id.clone(),
        library_id: asset.library_id.clone(),
        file_name: asset.file_name.clone(),
        original_name: asset.original_name.clone(),
        relative_path: asset.relative_path.clone(),
        file_type: asset.file_type.clone(),
        mime_type: "image/png".to_string(),
        file_size,
        file_hash,
        width: Some(cropped_img.width() as i32),
        height: Some(cropped_img.height() as i32),
        duration_ms: None,
        description: asset.description.clone(),
        ai_description: asset.ai_description.clone(),
        ai_description_en: asset.ai_description_en.clone(),
        ai_description_zh: asset.ai_description_zh.clone(),
        thumbnail_path: thumb_path,
        folder_path: asset.folder_path.clone(),
        created_at: asset.created_at.clone(),
        updated_at: String::new(), // Will be set by database
        imported_at: asset.imported_at.clone(),
    };

    // Update the asset in database
    let saved = queries::update_asset(&pool, &updated_asset).await?;

    tracing::info!("Image cropped and saved (replaced original): {} -> {}x{}",
        saved.file_name, cropped_img.width(), cropped_img.height());

    Ok(saved)
}

/// Save asset as a different format
#[tauri::command]
pub async fn save_as(
    asset_id: String,
    output_path: String,
    format: String, // "png", "jpeg", "ico", "icns"
    quality: Option<u8>, // For JPEG quality (1-100)
    pool: State<'_, SqlitePool>,
) -> Result<(), AppError> {
    tracing::info!("Saving asset {} as {} to: {}", asset_id, format, output_path);

    let asset = queries::get_asset(&pool, &asset_id).await?;
    let library = queries::get_library(&pool, &asset.library_id).await?;
    let library_root = std::path::Path::new(&library.root_path);
    let source_path = library_root.join(&asset.relative_path);

    // Load the image
    let img = image::open(&source_path)
        .map_err(|e| AppError::InvalidInput(format!("Failed to open image: {}", e)))?;

    let output_path_buf = std::path::PathBuf::from(&output_path);

    // Ensure output directory exists
    if let Some(parent) = output_path_buf.parent() {
        std::fs::create_dir_all(parent)?;
    }

    match format.to_lowercase().as_str() {
        "png" => {
            img.save_with_format(&output_path_buf, image::ImageFormat::Png)
                .map_err(|e| AppError::InvalidInput(format!("Failed to save PNG: {}", e)))?;
        }
        "jpeg" | "jpg" => {
            let rgb_img = img.to_rgb8();
            let quality = quality.unwrap_or(90).clamp(1, 100);
            let mut encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(
                std::fs::File::create(&output_path_buf)?,
                quality,
            );
            encoder.encode(
                rgb_img.as_raw(),
                rgb_img.width(),
                rgb_img.height(),
                image::ExtendedColorType::Rgb8,
            ).map_err(|e| AppError::InvalidInput(format!("Failed to save JPEG: {}", e)))?;
        }
        "ico" => {
            // ICO format: convert to RGBA and save
            let rgba_img = img.to_rgba8();
            let ico_data = create_ico_data(&rgba_img)?;
            std::fs::write(&output_path_buf, ico_data)?;
        }
        "icns" => {
            // ICNS format: macOS icon format
            let rgba_img = img.to_rgba8();
            let icns_data = create_icns_data(&rgba_img)?;
            std::fs::write(&output_path_buf, icns_data)?;
        }
        _ => {
            return Err(AppError::InvalidInput(format!("Unsupported format: {}", format)));
        }
    }

    tracing::info!("Image saved successfully to: {}", output_path);
    Ok(())
}

// Helper function to create ICO data
fn create_ico_data(img: &image::RgbaImage) -> Result<Vec<u8>, AppError> {
    let width = img.width();
    let height = img.height();

    // ICO file structure
    let mut ico_data = Vec::new();

    // ICONDIR header
    ico_data.extend_from_slice(&[0, 0]); // Reserved
    ico_data.extend_from_slice(&[1, 0]); // Type: 1 for ICO
    ico_data.extend_from_slice(&[1, 0]); // Number of images: 1

    // ICONDIRENTRY
    ico_data.push(if width <= 255 { width as u8 } else { 0 }); // Width (0 means 256)
    ico_data.push(if height <= 255 { height as u8 } else { 0 }); // Height (0 means 256)
    ico_data.push(0); // Color palette (0 for true color)
    ico_data.push(0); // Reserved
    ico_data.extend_from_slice(&[1, 0]); // Color planes
    ico_data.extend_from_slice(&[32, 0]); // Bits per pixel (32 for RGBA)

    // Convert image to PNG for embedding in ICO
    let mut png_data = Vec::new();
    {
        let mut cursor = std::io::Cursor::new(&mut png_data);
        img.write_to(&mut cursor, image::ImageFormat::Png)
            .map_err(|e| AppError::InvalidInput(format!("Failed to encode PNG: {}", e)))?;
    }

    let image_size = png_data.len() as u32;
    let image_offset = 22u32; // Size of ICONDIR + ICONDIRENTRY

    ico_data.extend_from_slice(&image_size.to_le_bytes());
    ico_data.extend_from_slice(&image_offset.to_le_bytes());

    // Append PNG data
    ico_data.extend_from_slice(&png_data);

    Ok(ico_data)
}

// Helper function to create ICNS data
fn create_icns_data(img: &image::RgbaImage) -> Result<Vec<u8>, AppError> {
    let width = img.width();
    let height = img.height();

    // ICNS file structure
    let mut icns_data = Vec::new();

    // ICNS header
    icns_data.extend_from_slice(b"icns"); // Magic number

    // Determine icon type based on size
    let icon_type = match (width, height) {
        (16, 16) => b"icp4",
        (32, 32) => b"icp5",
        (64, 64) => b"icp6",
        (128, 128) => b"ic07",
        (256, 256) => b"ic08",
        (512, 512) => b"ic09",
        (1024, 1024) => b"ic10",
        _ => {
            // For non-standard sizes, resize to nearest standard size
            let target_size = if width <= 16 { 16 }
                else if width <= 32 { 32 }
                else if width <= 64 { 64 }
                else if width <= 128 { 128 }
                else if width <= 256 { 256 }
                else if width <= 512 { 512 }
                else { 1024 };

            let resized = image::imageops::resize(
                img,
                target_size,
                target_size,
                image::imageops::FilterType::Lanczos3,
            );

            return create_icns_data(&resized);
        }
    };

    // Convert to PNG
    let mut png_data = Vec::new();
    {
        let mut cursor = std::io::Cursor::new(&mut png_data);
        img.write_to(&mut cursor, image::ImageFormat::Png)
            .map_err(|e| AppError::InvalidInput(format!("Failed to encode PNG: {}", e)))?;
    }

    // Icon element
    let element_size = (8 + png_data.len()) as u32;

    // Placeholder for file size (will update later)
    let file_size_pos = icns_data.len();
    icns_data.extend_from_slice(&[0, 0, 0, 0]);

    // Icon element header
    icns_data.extend_from_slice(icon_type);
    icns_data.extend_from_slice(&element_size.to_be_bytes());

    // PNG data
    icns_data.extend_from_slice(&png_data);

    // Update file size in header
    let file_size = icns_data.len() as u32;
    icns_data[file_size_pos..file_size_pos + 4].copy_from_slice(&file_size.to_be_bytes());

    Ok(icns_data)
}
