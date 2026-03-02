use image::{DynamicImage, GenericImageView};
use std::path::Path;

use crate::error::AppError;

/// Crop an image to the specified region
pub fn crop_image(
    source_path: &Path,
    x: u32,
    y: u32,
    width: u32,
    height: u32,
) -> Result<DynamicImage, AppError> {
    let img = image::open(source_path)?;

    let (img_width, img_height) = img.dimensions();

    // Validate crop region
    if x >= img_width || y >= img_height {
        return Err(AppError::InvalidInput(
            "Crop region is outside image bounds".to_string(),
        ));
    }

    // Adjust width and height if they exceed image bounds
    let actual_width = width.min(img_width - x);
    let actual_height = height.min(img_height - y);

    if actual_width == 0 || actual_height == 0 {
        return Err(AppError::InvalidInput(
            "Crop region has zero width or height".to_string(),
        ));
    }

    // Perform the crop
    let cropped = img.crop_imm(x, y, actual_width, actual_height);

    Ok(cropped)
}
