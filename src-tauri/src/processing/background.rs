use image::{DynamicImage, GenericImageView, Rgba, RgbaImage, Luma, GrayImage};
use std::path::Path;
use std::collections::VecDeque;

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

/// Smart background removal using edge detection and flood fill
/// Automatically detects the main subject and makes the background transparent
pub fn remove_background_smart(source: &Path) -> Result<DynamicImage, AppError> {
    let img = image::open(source)?;
    let (width, height) = img.dimensions();
    let rgba = img.to_rgba8();

    // Convert to grayscale for processing
    let gray = image::imageops::grayscale(&img);

    // Apply Sobel edge detection with stronger response
    let edges = detect_edges_enhanced(&gray);

    // Create a mask by flood filling from the borders
    let mask = create_background_mask_simple(&edges, &gray, width, height);

    // Apply mask to create transparent background
    let mut output = RgbaImage::new(width, height);
    for (x, y, pixel) in rgba.enumerate_pixels() {
        if mask.get_pixel(x, y)[0] > 128 {
            // This is foreground (subject), keep it
            output.put_pixel(x, y, *pixel);
        } else {
            // This is background, make it transparent
            output.put_pixel(x, y, Rgba([0, 0, 0, 0]));
        }
    }

    Ok(DynamicImage::ImageRgba8(output))
}

/// Enhanced Sobel edge detection with stronger response
fn detect_edges_enhanced(gray: &GrayImage) -> GrayImage {
    let (width, height) = gray.dimensions();
    let mut edges = GrayImage::new(width, height);

    // Sobel kernels
    let sobel_x = [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]];
    let sobel_y = [[-1, -2, -1], [0, 0, 0], [1, 2, 1]];

    for y in 1..height - 1 {
        for x in 1..width - 1 {
            let mut gx = 0i32;
            let mut gy = 0i32;

            for ky in 0..3 {
                for kx in 0..3 {
                    let pixel_val = gray.get_pixel(x + kx - 1, y + ky - 1)[0] as i32;
                    gx += pixel_val * sobel_x[ky as usize][kx as usize];
                    gy += pixel_val * sobel_y[ky as usize][kx as usize];
                }
            }

            let magnitude = ((gx * gx + gy * gy) as f64).sqrt();
            // Amplify edge response
            let edge_value = (magnitude * 1.5).min(255.0) as u8;
            edges.put_pixel(x, y, Luma([edge_value]));
        }
    }

    edges
}

/// Simplified background mask creation with aggressive flood fill
fn create_background_mask_simple(edges: &GrayImage, gray: &GrayImage, width: u32, height: u32) -> GrayImage {
    let mut mask = GrayImage::from_pixel(width, height, Luma([255u8])); // Start with all foreground
    let mut visited = vec![vec![false; width as usize]; height as usize];
    let mut queue = VecDeque::new();

    // More aggressive edge threshold
    let edge_threshold = 15u8;

    // Calculate border statistics
    let (border_avg, border_std) = calculate_border_stats(gray, width, height);
    let color_threshold = (border_std as f32 * 2.0).max(30.0) as u8;

    // Start flood fill from all border pixels
    for x in 0..width {
        // Top border
        if is_background_pixel(edges, gray, x, 0, edge_threshold, border_avg, color_threshold) {
            queue.push_back((x, 0));
            visited[0][x as usize] = true;
        }
        // Bottom border
        if is_background_pixel(edges, gray, x, height - 1, edge_threshold, border_avg, color_threshold) {
            queue.push_back((x, height - 1));
            visited[(height - 1) as usize][x as usize] = true;
        }
    }

    for y in 1..height - 1 {
        // Left border
        if is_background_pixel(edges, gray, 0, y, edge_threshold, border_avg, color_threshold) {
            queue.push_back((0, y));
            visited[y as usize][0] = true;
        }
        // Right border
        if is_background_pixel(edges, gray, width - 1, y, edge_threshold, border_avg, color_threshold) {
            queue.push_back((width - 1, y));
            visited[y as usize][(width - 1) as usize] = true;
        }
    }

    // Flood fill to mark background
    while let Some((x, y)) = queue.pop_front() {
        mask.put_pixel(x, y, Luma([0u8]));

        // Check 8-connected neighbors for more aggressive fill
        let neighbors = [
            (x.wrapping_sub(1), y),
            (x + 1, y),
            (x, y.wrapping_sub(1)),
            (x, y + 1),
            (x.wrapping_sub(1), y.wrapping_sub(1)),
            (x + 1, y.wrapping_sub(1)),
            (x.wrapping_sub(1), y + 1),
            (x + 1, y + 1),
        ];

        for (nx, ny) in neighbors {
            if nx < width && ny < height {
                let nx_usize = nx as usize;
                let ny_usize = ny as usize;

                if !visited[ny_usize][nx_usize]
                    && is_background_pixel(edges, gray, nx, ny, edge_threshold, border_avg, color_threshold) {
                    visited[ny_usize][nx_usize] = true;
                    queue.push_back((nx, ny));
                }
            }
        }
    }

    // Clean up small noise regions
    remove_small_foreground_regions(&mut mask, width, height, 50);

    mask
}

/// Calculate border color statistics
fn calculate_border_stats(gray: &GrayImage, width: u32, height: u32) -> (u8, u8) {
    let mut values = Vec::new();

    // Sample border pixels
    for x in 0..width {
        values.push(gray.get_pixel(x, 0)[0]);
        values.push(gray.get_pixel(x, height - 1)[0]);
    }
    for y in 1..height - 1 {
        values.push(gray.get_pixel(0, y)[0]);
        values.push(gray.get_pixel(width - 1, y)[0]);
    }

    let sum: u64 = values.iter().map(|&v| v as u64).sum();
    let avg = (sum / values.len() as u64) as u8;

    let variance: f64 = values.iter()
        .map(|&v| {
            let diff = v as f64 - avg as f64;
            diff * diff
        })
        .sum::<f64>() / values.len() as f64;

    let std = variance.sqrt() as u8;

    (avg, std)
}

/// Check if pixel is background
fn is_background_pixel(
    edges: &GrayImage,
    gray: &GrayImage,
    x: u32,
    y: u32,
    edge_threshold: u8,
    border_avg: u8,
    color_threshold: u8,
) -> bool {
    let edge_value = edges.get_pixel(x, y)[0];
    let pixel_color = gray.get_pixel(x, y)[0];

    // More lenient criteria: either low edge OR similar color
    edge_value < edge_threshold
        || (pixel_color as i16 - border_avg as i16).unsigned_abs() < color_threshold as u16
}

/// Remove small isolated foreground regions
fn remove_small_foreground_regions(mask: &mut GrayImage, width: u32, height: u32, min_size: usize) {
    let mut visited = vec![vec![false; width as usize]; height as usize];

    for y in 0..height {
        for x in 0..width {
            if !visited[y as usize][x as usize] && mask.get_pixel(x, y)[0] > 128 {
                let region_size = measure_region_size(mask, &mut visited, x, y, width, height);
                if region_size < min_size {
                    fill_region(mask, x, y, width, height, Luma([0u8]));
                }
            }
        }
    }
}

/// Measure the size of a connected region
fn measure_region_size(
    mask: &GrayImage,
    visited: &mut Vec<Vec<bool>>,
    start_x: u32,
    start_y: u32,
    width: u32,
    height: u32,
) -> usize {
    let mut queue = VecDeque::new();
    let mut size = 0;

    queue.push_back((start_x, start_y));
    visited[start_y as usize][start_x as usize] = true;

    while let Some((x, y)) = queue.pop_front() {
        size += 1;

        let neighbors = [
            (x.wrapping_sub(1), y),
            (x + 1, y),
            (x, y.wrapping_sub(1)),
            (x, y + 1),
        ];

        for (nx, ny) in neighbors {
            if nx < width && ny < height {
                let nx_usize = nx as usize;
                let ny_usize = ny as usize;

                if !visited[ny_usize][nx_usize] && mask.get_pixel(nx, ny)[0] > 128 {
                    visited[ny_usize][nx_usize] = true;
                    queue.push_back((nx, ny));
                }
            }
        }
    }

    size
}

/// Fill a connected region with a specific color
fn fill_region(
    mask: &mut GrayImage,
    start_x: u32,
    start_y: u32,
    width: u32,
    height: u32,
    color: Luma<u8>,
) {
    let mut queue = VecDeque::new();
    let mut visited = vec![vec![false; width as usize]; height as usize];

    queue.push_back((start_x, start_y));
    visited[start_y as usize][start_x as usize] = true;

    while let Some((x, y)) = queue.pop_front() {
        mask.put_pixel(x, y, color);

        let neighbors = [
            (x.wrapping_sub(1), y),
            (x + 1, y),
            (x, y.wrapping_sub(1)),
            (x, y + 1),
        ];

        for (nx, ny) in neighbors {
            if nx < width && ny < height {
                let nx_usize = nx as usize;
                let ny_usize = ny as usize;

                if !visited[ny_usize][nx_usize] && mask.get_pixel(nx, ny)[0] > 128 {
                    visited[ny_usize][nx_usize] = true;
                    queue.push_back((nx, ny));
                }
            }
        }
    }
}
