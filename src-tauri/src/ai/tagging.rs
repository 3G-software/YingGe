use base64::Engine;
use std::path::Path;

use crate::ai::provider::{AiProviderManager, AnalysisResult};
use crate::error::AppError;

/// Read an image file and analyze it with the AI provider
pub async fn analyze_image_file(
    path: &Path,
    ai_manager: &AiProviderManager,
) -> Result<AnalysisResult, AppError> {
    tracing::info!("Reading image file: {:?}", path);
    let provider = ai_manager.get_provider().await?;

    let bytes = std::fs::read(path)?;
    tracing::info!("Image file size: {} bytes", bytes.len());

    let base64_str = base64::engine::general_purpose::STANDARD.encode(&bytes);
    tracing::info!("Image encoded to base64, length: {} chars", base64_str.len());

    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("png")
        .to_lowercase();

    let mime_type = match ext.as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "bmp" => "image/bmp",
        _ => "image/png",
    };
    tracing::info!("Image MIME type: {}", mime_type);

    tracing::info!("Sending image to AI provider for analysis...");
    let result = provider.analyze_image(&base64_str, mime_type).await?;
    tracing::info!("AI provider returned analysis result");

    Ok(result)
}
