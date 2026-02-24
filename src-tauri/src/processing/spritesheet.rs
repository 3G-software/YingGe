use image::{DynamicImage, GenericImageView, RgbaImage};
use image::imageops::FilterType;
use std::path::Path;

use crate::error::AppError;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SpriteFrame {
    pub name: String,
    pub x: u32,
    pub y: u32,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SpritesheetInfo {
    pub width: u32,
    pub height: u32,
    pub frames: Vec<SpriteFrame>,
}

/// Merge multiple images into a sprite sheet grid.
/// If cell_width and cell_height are provided, all images will be resized to that size.
/// Returns the merged image and sprite sheet metadata.
pub fn merge_spritesheet_with_size(
    image_paths: &[(String, &Path)], // (name, path)
    columns: u32,
    rows: u32,
    cell_width: u32,
    cell_height: u32,
    padding: u32,
) -> Result<(DynamicImage, SpritesheetInfo), AppError> {
    if image_paths.is_empty() {
        return Err(AppError::InvalidInput("No images provided".to_string()));
    }

    // Load all images and resize them to cell size
    let images: Vec<(String, DynamicImage)> = image_paths
        .iter()
        .map(|(name, path)| {
            let img = image::open(path)?;
            // Resize image to cell size
            let resized = img.resize_exact(cell_width, cell_height, FilterType::Lanczos3);
            Ok((name.clone(), resized))
        })
        .collect::<Result<Vec<_>, AppError>>()?;

    let cols = columns.max(1);
    let actual_rows = rows.max(1);

    let sheet_width = cols * cell_width + (cols - 1) * padding;
    let sheet_height = actual_rows * cell_height + (actual_rows - 1) * padding;

    let mut sheet = RgbaImage::new(sheet_width, sheet_height);
    let mut frames = Vec::new();

    for (i, (name, img)) in images.iter().enumerate() {
        let col = (i as u32) % cols;
        let row = (i as u32) / cols;

        // Skip if exceeds grid
        if row >= actual_rows {
            break;
        }

        let x = col * (cell_width + padding);
        let y = row * (cell_height + padding);

        let rgba = img.to_rgba8();
        for (px, py, pixel) in rgba.enumerate_pixels() {
            if x + px < sheet_width && y + py < sheet_height {
                sheet.put_pixel(x + px, y + py, *pixel);
            }
        }

        frames.push(SpriteFrame {
            name: name.clone(),
            x,
            y,
            width: cell_width,
            height: cell_height,
        });
    }

    let info = SpritesheetInfo {
        width: sheet_width,
        height: sheet_height,
        frames,
    };

    Ok((DynamicImage::ImageRgba8(sheet), info))
}

/// Merge multiple images into a sprite sheet grid (auto-detect cell size).
/// Returns the merged image and sprite sheet metadata.
pub fn merge_spritesheet(
    image_paths: &[(String, &Path)], // (name, path)
    columns: u32,
    padding: u32,
) -> Result<(DynamicImage, SpritesheetInfo), AppError> {
    if image_paths.is_empty() {
        return Err(AppError::InvalidInput("No images provided".to_string()));
    }

    // Load all images and find max cell size
    let images: Vec<(String, DynamicImage)> = image_paths
        .iter()
        .map(|(name, path)| {
            let img = image::open(path)?;
            Ok((name.clone(), img))
        })
        .collect::<Result<Vec<_>, AppError>>()?;

    let max_width = images.iter().map(|(_, img)| img.width()).max().unwrap_or(0);
    let max_height = images.iter().map(|(_, img)| img.height()).max().unwrap_or(0);

    let cols = columns.max(1);
    let rows = ((images.len() as u32) + cols - 1) / cols;

    let sheet_width = cols * (max_width + padding) - padding;
    let sheet_height = rows * (max_height + padding) - padding;

    let mut sheet = RgbaImage::new(sheet_width, sheet_height);
    let mut frames = Vec::new();

    for (i, (name, img)) in images.iter().enumerate() {
        let col = (i as u32) % cols;
        let row = (i as u32) / cols;
        let x = col * (max_width + padding);
        let y = row * (max_height + padding);

        let rgba = img.to_rgba8();
        for (px, py, pixel) in rgba.enumerate_pixels() {
            if x + px < sheet_width && y + py < sheet_height {
                sheet.put_pixel(x + px, y + py, *pixel);
            }
        }

        frames.push(SpriteFrame {
            name: name.clone(),
            x,
            y,
            width: img.width(),
            height: img.height(),
        });
    }

    let info = SpritesheetInfo {
        width: sheet_width,
        height: sheet_height,
        frames,
    };

    Ok((DynamicImage::ImageRgba8(sheet), info))
}

/// Split an image by grid into multiple sub-images.
/// Returns a list of sub-images.
pub fn split_image_grid(
    source: &Path,
    rows: u32,
    cols: u32,
) -> Result<Vec<DynamicImage>, AppError> {
    let img = image::open(source)?;
    let (width, height) = img.dimensions();

    let cell_width = width / cols;
    let cell_height = height / rows;

    let mut results = Vec::new();

    for row in 0..rows {
        for col in 0..cols {
            let x = col * cell_width;
            let y = row * cell_height;
            let sub = img.crop_imm(x, y, cell_width, cell_height);
            results.push(sub);
        }
    }

    Ok(results)
}

/// Resize an image to specified dimensions
pub fn resize_image(
    source: &Path,
    width: u32,
    height: u32,
    maintain_aspect: bool,
) -> Result<DynamicImage, AppError> {
    let img = image::open(source)?;

    let resized = if maintain_aspect {
        img.resize(width, height, FilterType::Lanczos3)
    } else {
        img.resize_exact(width, height, FilterType::Lanczos3)
    };

    Ok(resized)
}
