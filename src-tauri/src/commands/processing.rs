use sqlx::SqlitePool;
use tauri::State;
use uuid::Uuid;

use crate::db::{models::Asset, queries};
use crate::error::AppError;
use crate::processing::{background, compress, descriptor, spritesheet};

#[tauri::command]
pub async fn remove_background(
    asset_id: String,
    target_color: [u8; 3],
    tolerance: u8,
    pool: State<'_, SqlitePool>,
) -> Result<Asset, AppError> {
    let asset = queries::get_asset(&pool, &asset_id).await?;
    let library = queries::get_library(&pool, &asset.library_id).await?;
    let source_path = std::path::Path::new(&library.root_path).join(&asset.relative_path);

    let result_img = background::remove_background_color_key(&source_path, target_color, tolerance)?;

    // Save as new asset
    let new_id = Uuid::new_v4().to_string();
    let output_name = format!("{}_nobg.png", asset.file_name.rsplit('.').last().unwrap_or(&asset.file_name));
    let output_dir = std::path::Path::new(&library.root_path).join("assets");
    std::fs::create_dir_all(&output_dir)?;
    let output_path = output_dir.join(format!("{}.png", new_id));
    result_img.save(&output_path)?;

    let relative_path = format!("assets/{}.png", new_id);

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
        id: new_id,
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
        description: format!("Background removed from {}", asset.file_name),
        ai_description: String::new(),
        thumbnail_path: thumb_path,
        folder_path: asset.folder_path.clone(),
        created_at: String::new(),
        updated_at: String::new(),
        imported_at: String::new(),
    };

    let saved = queries::insert_asset(&pool, &new_asset).await?;
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

    // Save sprite sheet
    let new_id = Uuid::new_v4().to_string();
    let output_dir = library_root.join("assets");
    std::fs::create_dir_all(&output_dir)?;
    let output_path = output_dir.join(format!("{}.png", new_id));
    sheet_img.save(&output_path)?;

    let relative_path = format!("assets/{}.png", new_id);

    // Generate descriptor
    let img_filename = format!("{}.png", output_name);
    let descriptor_content = match descriptor_format.as_str() {
        "xml_unity" => descriptor::generate_unity_xml_descriptor(&info, &img_filename),
        "plist_cocos2d" => descriptor::generate_cocos2d_plist_descriptor(&info, &img_filename),
        _ => descriptor::generate_json_descriptor(&info, &img_filename),
    };

    // Save descriptor file alongside
    let desc_ext = match descriptor_format.as_str() {
        "xml_unity" => "xml",
        "plist_cocos2d" => "plist",
        _ => "json",
    };
    let desc_path = output_dir.join(format!("{}.{}", output_name, desc_ext));
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
        thumbnail_path: thumb_path,
        folder_path: first_asset.folder_path.clone(),
        created_at: String::new(),
        updated_at: String::new(),
        imported_at: String::new(),
    };

    let saved = queries::insert_asset(&pool, &new_asset).await?;

    Ok(SpritesheetResult {
        image_asset: saved,
        descriptor_content,
    })
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

    let output_dir = library_root.join("assets");
    std::fs::create_dir_all(&output_dir)?;

    let base_name = asset
        .file_name
        .rsplit('.')
        .last()
        .unwrap_or(&asset.file_name);

    let mut results = Vec::new();

    for (i, sub_img) in sub_images.iter().enumerate() {
        let new_id = Uuid::new_v4().to_string();
        let output_path = output_dir.join(format!("{}.png", new_id));
        sub_img.save(&output_path)?;

        let relative_path = format!("assets/{}.png", new_id);
        let file_name = format!("{}_{}.png", base_name, i);

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

    // Save to the same folder as the original asset
    let output_dir = if asset.folder_path.is_empty() || asset.folder_path == "/" {
        library_root.join("assets")
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

    let relative_path = if asset.folder_path.is_empty() || asset.folder_path == "/" {
        format!("assets/{}.{}", new_id, output_ext)
    } else {
        format!("{}/{}.{}", asset.folder_path, new_id, output_ext)
    };
    let compressed_size = output_bytes.len() as i64;
    let compression_ratio = if original_size > 0 {
        (1.0 - (compressed_size as f64 / original_size as f64)) * 100.0
    } else {
        0.0
    };

    // Generate output filename with localized suffix
    let base_name = if let Some(dot_pos) = asset.file_name.rfind('.') {
        &asset.file_name[..dot_pos]
    } else {
        &asset.file_name
    };
    let output_name = format!("{}{}.{}", base_name, suffix, output_ext);

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
