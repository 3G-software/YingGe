use sqlx::SqlitePool;
use tauri::State;

use crate::db::{
    models::{Tag, TagWithCount},
    queries,
};
use crate::error::AppError;

#[tauri::command]
pub async fn create_tag(
    library_id: String,
    name: String,
    color: Option<String>,
    category: Option<String>,
    pool: State<'_, SqlitePool>,
) -> Result<Tag, AppError> {
    let tag = queries::create_tag(
        &pool,
        &library_id,
        &name,
        &color.unwrap_or_else(|| "#808080".to_string()),
        &category.unwrap_or_default(),
        false,
    )
    .await?;
    Ok(tag)
}

#[tauri::command]
pub async fn list_tags(
    library_id: String,
    category: Option<String>,
    pool: State<'_, SqlitePool>,
) -> Result<Vec<TagWithCount>, AppError> {
    let tags = queries::list_tags(&pool, &library_id, category.as_deref()).await?;
    Ok(tags)
}

#[tauri::command]
pub async fn rename_tag(
    id: String,
    new_name: String,
    pool: State<'_, SqlitePool>,
) -> Result<(), AppError> {
    queries::rename_tag(&pool, &id, &new_name).await?;
    Ok(())
}

#[tauri::command]
pub async fn delete_tag(id: String, pool: State<'_, SqlitePool>) -> Result<(), AppError> {
    queries::delete_tag(&pool, &id).await?;
    Ok(())
}

#[tauri::command]
pub async fn assign_tags(
    asset_id: String,
    tag_ids: Vec<String>,
    pool: State<'_, SqlitePool>,
) -> Result<(), AppError> {
    queries::assign_tags(&pool, &asset_id, &tag_ids).await?;
    Ok(())
}

#[tauri::command]
pub async fn remove_tags(
    asset_id: String,
    tag_ids: Vec<String>,
    pool: State<'_, SqlitePool>,
) -> Result<(), AppError> {
    queries::remove_tags(&pool, &asset_id, &tag_ids).await?;
    Ok(())
}

#[tauri::command]
pub async fn get_asset_tags(
    asset_id: String,
    pool: State<'_, SqlitePool>,
) -> Result<Vec<Tag>, AppError> {
    let tags = queries::get_asset_tags(&pool, &asset_id).await?;
    Ok(tags)
}
