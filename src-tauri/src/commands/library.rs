use sqlx::SqlitePool;
use tauri::State;

use crate::db::{models::Library, queries};
use crate::error::AppError;

/// Expand ~ to home directory
fn expand_path(path: &str) -> String {
    if path.starts_with("~/") {
        if let Some(home) = dirs::home_dir() {
            return home.join(&path[2..]).to_string_lossy().to_string();
        }
    } else if path == "~" {
        if let Some(home) = dirs::home_dir() {
            return home.to_string_lossy().to_string();
        }
    }
    path.to_string()
}

#[tauri::command]
pub async fn create_library(
    name: String,
    root_path: String,
    pool: State<'_, SqlitePool>,
) -> Result<Library, AppError> {
    // Expand ~ to home directory
    let expanded_path = expand_path(&root_path);

    // Create the library directory with the library name
    let base_path = std::path::Path::new(&expanded_path);
    let lib_path = base_path.join(&name);

    std::fs::create_dir_all(&lib_path)?;
    std::fs::create_dir_all(lib_path.join(".thumbnails"))?;

    let library = queries::create_library(&pool, &name, &lib_path.to_string_lossy().to_string()).await?;
    Ok(library)
}

#[tauri::command]
pub async fn list_libraries(pool: State<'_, SqlitePool>) -> Result<Vec<Library>, AppError> {
    let libraries = queries::list_libraries(&pool).await?;
    Ok(libraries)
}

#[tauri::command]
pub async fn get_library(id: String, pool: State<'_, SqlitePool>) -> Result<Library, AppError> {
    let library = queries::get_library(&pool, &id).await?;
    Ok(library)
}

#[tauri::command]
pub async fn delete_library(id: String, pool: State<'_, SqlitePool>) -> Result<(), AppError> {
    queries::delete_library(&pool, &id).await?;
    Ok(())
}
