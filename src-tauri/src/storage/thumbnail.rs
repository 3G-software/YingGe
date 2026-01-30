use image::imageops::FilterType;
use std::path::Path;

const THUMBNAIL_SIZE: u32 = 256;

/// Generate a thumbnail for an image file.
/// Returns the relative path from the library root.
pub fn generate_thumbnail(
    source: &Path,
    library_root: &Path,
    asset_id: &str,
) -> Result<String, image::ImageError> {
    let img = image::open(source)?;
    let thumb = img.resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, FilterType::Lanczos3);

    let thumb_dir = library_root.join(".thumbnails");
    std::fs::create_dir_all(&thumb_dir).map_err(|e| {
        image::ImageError::IoError(e)
    })?;

    let thumb_path = thumb_dir.join(format!("{}.png", asset_id));
    thumb.save(&thumb_path)?;

    let relative = thumb_path
        .strip_prefix(library_root)
        .unwrap_or(&thumb_path);
    Ok(relative.to_string_lossy().to_string())
}
