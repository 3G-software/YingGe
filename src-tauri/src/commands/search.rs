use sqlx::SqlitePool;
use tauri::State;

use crate::db::{models::{Asset, PaginatedAssets}, queries};
use crate::error::AppError;

#[tauri::command]
pub async fn search_keyword(
    library_id: String,
    query: String,
    tag_ids: Option<Vec<String>>,
    file_type: Option<String>,
    page: u32,
    page_size: u32,
    pool: State<'_, SqlitePool>,
) -> Result<PaginatedAssets, AppError> {
    let result = queries::search_keyword(
        &pool,
        &library_id,
        &query,
        tag_ids.as_deref(),
        file_type.as_deref(),
        page,
        page_size,
    )
    .await?;
    Ok(result)
}

#[tauri::command]
pub async fn search_by_tags(
    library_id: String,
    tag_ids: Vec<String>,
    match_all: bool,
    pool: State<'_, SqlitePool>,
) -> Result<Vec<Asset>, AppError> {
    let results = queries::search_by_tags(&pool, &library_id, &tag_ids, match_all).await?;
    Ok(results)
}
