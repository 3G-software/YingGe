use image::{DynamicImage, ImageFormat, ImageReader};
use std::io::Cursor;
use std::path::Path;

use crate::error::AppError;

/// Compress an image by resizing and/or reducing quality
/// Returns the compressed image bytes and the format used
pub fn compress_image(
    path: &Path,
    max_width: Option<u32>,
    max_height: Option<u32>,
    quality: u8, // 1-100, only affects JPEG
) -> Result<DynamicImage, AppError> {
    let img = ImageReader::open(path)?.decode()?;

    let (orig_w, orig_h) = (img.width(), img.height());
    let max_w = max_width.unwrap_or(orig_w);
    let max_h = max_height.unwrap_or(orig_h);

    // Calculate new dimensions while maintaining aspect ratio
    let (new_w, new_h) = if orig_w > max_w || orig_h > max_h {
        let ratio_w = max_w as f64 / orig_w as f64;
        let ratio_h = max_h as f64 / orig_h as f64;
        let ratio = ratio_w.min(ratio_h);
        (
            (orig_w as f64 * ratio) as u32,
            (orig_h as f64 * ratio) as u32,
        )
    } else {
        (orig_w, orig_h)
    };

    // Resize if needed
    let resized = if new_w != orig_w || new_h != orig_h {
        img.resize(new_w, new_h, image::imageops::FilterType::Lanczos3)
    } else {
        img
    };

    Ok(resized)
}

/// Compress image to JPEG bytes with specified quality
pub fn compress_to_jpeg_bytes(
    img: &DynamicImage,
    quality: u8,
) -> Result<Vec<u8>, AppError> {
    let mut bytes = Vec::new();
    let mut cursor = Cursor::new(&mut bytes);

    // Convert to RGB if necessary (JPEG doesn't support alpha)
    let rgb_img = img.to_rgb8();

    let encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut cursor, quality);
    rgb_img.write_with_encoder(encoder)?;

    Ok(bytes)
}

/// Compress image to PNG bytes
pub fn compress_to_png_bytes(img: &DynamicImage) -> Result<Vec<u8>, AppError> {
    let mut bytes = Vec::new();
    let mut cursor = Cursor::new(&mut bytes);

    img.write_to(&mut cursor, ImageFormat::Png)?;

    Ok(bytes)
}

/// Compress image for AI analysis (resize to reasonable size for API)
/// Returns base64 encoded JPEG and mime type
pub fn compress_for_ai(path: &Path) -> Result<(String, &'static str), AppError> {
    // For AI analysis, we don't need full resolution
    // Most vision models work well with images around 1024-2048px
    let img = compress_image(path, Some(1536), Some(1536), 85)?;

    // Use JPEG for smaller file size (AI doesn't need alpha channel)
    let bytes = compress_to_jpeg_bytes(&img, 85)?;

    let base64_str = base64::Engine::encode(
        &base64::engine::general_purpose::STANDARD,
        &bytes,
    );

    Ok((base64_str, "image/jpeg"))
}
