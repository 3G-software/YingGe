use std::path::Path;

use crate::ai::provider::{AiProviderManager, AnalysisResult};
use crate::error::AppError;
use crate::processing::compress;

/// Read an image file and analyze it with the AI provider
/// The image is compressed before sending to reduce API costs and improve speed
pub async fn analyze_image_file(
    path: &Path,
    ai_manager: &AiProviderManager,
) -> Result<AnalysisResult, AppError> {
    tracing::info!("Reading image file: {:?}", path);
    let provider = ai_manager.get_provider().await?;

    // Get original file size for logging
    let original_size = std::fs::metadata(path)?.len();
    tracing::info!("Original image file size: {} bytes", original_size);

    // Compress image for AI analysis (resize and convert to JPEG)
    let (base64_str, mime_type) = compress::compress_for_ai(path)?;

    // Calculate compressed size (base64 is ~4/3 of original binary size)
    let compressed_size = (base64_str.len() * 3) / 4;
    tracing::info!(
        "Image compressed for AI: {} bytes -> {} bytes ({:.1}% reduction)",
        original_size,
        compressed_size,
        (1.0 - (compressed_size as f64 / original_size as f64)) * 100.0
    );

    tracing::info!("Sending compressed image to AI provider for analysis...");
    let result = provider.analyze_image(&base64_str, mime_type).await?;
    tracing::info!("AI provider returned analysis result");

    Ok(result)
}
