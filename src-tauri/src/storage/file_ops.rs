use sha2::{Digest, Sha256};
use std::path::Path;

/// Compute SHA-256 hash of a file
pub fn compute_file_hash(path: &Path) -> Result<String, std::io::Error> {
    let bytes = std::fs::read(path)?;
    let hash = Sha256::digest(&bytes);
    Ok(format!("{:x}", hash))
}

/// Determine the file type category from MIME type
pub fn file_type_from_mime(mime: &str) -> &'static str {
    if mime.starts_with("image/") {
        "image"
    } else if mime.starts_with("audio/") {
        "audio"
    } else if mime.starts_with("video/") {
        "video"
    } else {
        "other"
    }
}

/// Guess MIME type from file extension
pub fn guess_mime_type(path: &Path) -> String {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    match ext.as_str() {
        // Images
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "bmp" => "image/bmp",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        "ico" => "image/x-icon",
        "tiff" | "tif" => "image/tiff",
        "psd" => "image/vnd.adobe.photoshop",
        // Audio
        "mp3" => "audio/mpeg",
        "wav" => "audio/wav",
        "ogg" => "audio/ogg",
        "flac" => "audio/flac",
        "aac" => "audio/aac",
        "m4a" => "audio/mp4",
        "wma" => "audio/x-ms-wma",
        // Video
        "mp4" => "video/mp4",
        "avi" => "video/x-msvideo",
        "mov" => "video/quicktime",
        "webm" => "video/webm",
        // Other
        "json" => "application/json",
        "xml" => "application/xml",
        _ => "application/octet-stream",
    }
    .to_string()
}

/// Copy a file to the library directory, preserving the original extension.
/// Returns the relative path within the library.
pub fn copy_to_library(
    source: &Path,
    library_root: &Path,
    folder_path: &str,
    file_id: &str,
) -> Result<String, std::io::Error> {
    let ext = source
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("");

    let relative_dir = folder_path.trim_start_matches('/');
    let target_dir = if relative_dir.is_empty() {
        library_root.to_path_buf()
    } else {
        library_root.join(relative_dir)
    };

    std::fs::create_dir_all(&target_dir)?;

    let file_name = if ext.is_empty() {
        file_id.to_string()
    } else {
        format!("{}.{}", file_id, ext)
    };

    let target_path = target_dir.join(&file_name);
    std::fs::copy(source, &target_path)?;

    // Return relative path from library root
    let relative = target_path
        .strip_prefix(library_root)
        .unwrap_or(&target_path);
    Ok(relative.to_string_lossy().to_string())
}

/// Get image dimensions
pub fn get_image_dimensions(path: &Path) -> Option<(u32, u32)> {
    image::image_dimensions(path).ok()
}

/// Get file size in bytes
pub fn get_file_size(path: &Path) -> Result<u64, std::io::Error> {
    Ok(std::fs::metadata(path)?.len())
}
