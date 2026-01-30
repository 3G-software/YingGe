use sqlx::SqlitePool;
use tauri::State;

use crate::db::{models::Library, queries};
use crate::error::AppError;

#[tauri::command]
pub async fn create_library(
    name: String,
    root_path: String,
    pool: State<'_, SqlitePool>,
) -> Result<Library, AppError> {
    // Create the library directory
    let lib_path = std::path::Path::new(&root_path);
    std::fs::create_dir_all(lib_path)?;
    std::fs::create_dir_all(lib_path.join("assets"))?;
    std::fs::create_dir_all(lib_path.join(".thumbnails"))?;

    let library = queries::create_library(&pool, &name, &root_path).await?;
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
