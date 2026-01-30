use crate::ai::provider::AiProviderManager;
use crate::error::AppError;

/// Embed text and return the vector as bytes (f32 array serialized)
pub async fn embed_text_to_bytes(
    text: &str,
    ai_manager: &AiProviderManager,
) -> Result<Vec<u8>, AppError> {
    let provider = ai_manager.get_provider().await?;
    let vector = provider.embed_text(text).await?;
    Ok(f32_vec_to_bytes(&vector))
}

/// Convert f32 vector to bytes for storage
pub fn f32_vec_to_bytes(vec: &[f32]) -> Vec<u8> {
    vec.iter().flat_map(|f| f.to_le_bytes()).collect()
}

/// Convert bytes back to f32 vector
pub fn bytes_to_f32_vec(bytes: &[u8]) -> Vec<f32> {
    bytes
        .chunks_exact(4)
        .map(|chunk| {
            let arr: [u8; 4] = chunk.try_into().unwrap();
            f32::from_le_bytes(arr)
        })
        .collect()
}

/// Compute cosine similarity between two vectors
pub fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    if a.len() != b.len() || a.is_empty() {
        return 0.0;
    }

    let mut dot = 0.0f32;
    let mut norm_a = 0.0f32;
    let mut norm_b = 0.0f32;

    for i in 0..a.len() {
        dot += a[i] * b[i];
        norm_a += a[i] * a[i];
        norm_b += b[i] * b[i];
    }

    let denom = norm_a.sqrt() * norm_b.sqrt();
    if denom == 0.0 {
        0.0
    } else {
        dot / denom
    }
}
