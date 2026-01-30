use image::{DynamicImage, GenericImageView, Rgba, RgbaImage};
use std::path::Path;

use crate::error::AppError;

/// Remove background using color-key method.
/// Pixels matching the target color (within tolerance) become transparent.
pub fn remove_background_color_key(
    source: &Path,
    target_color: [u8; 3],
    tolerance: u8,
) -> Result<DynamicImage, AppError> {
    let img = image::open(source)?;
    let (width, height) = img.dimensions();
    let rgba = img.to_rgba8();

    let mut output = RgbaImage::new(width, height);

    for (x, y, pixel) in rgba.enumerate_pixels() {
        let diff_r = (pixel[0] as i16 - target_color[0] as i16).unsigned_abs() as u8;
        let diff_g = (pixel[1] as i16 - target_color[1] as i16).unsigned_abs() as u8;
        let diff_b = (pixel[2] as i16 - target_color[2] as i16).unsigned_abs() as u8;

        if diff_r <= tolerance && diff_g <= tolerance && diff_b <= tolerance {
            output.put_pixel(x, y, Rgba([0, 0, 0, 0]));
        } else {
            output.put_pixel(x, y, *pixel);
        }
    }

    Ok(DynamicImage::ImageRgba8(output))
}
