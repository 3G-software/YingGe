use sqlx::SqlitePool;
use uuid::Uuid;

use super::models::*;

// --- Library queries ---

pub async fn create_library(
    pool: &SqlitePool,
    name: &str,
    root_path: &str,
) -> Result<Library, sqlx::Error> {
    let id = Uuid::new_v4().to_string();
    sqlx::query_as::<_, Library>(
        "INSERT INTO libraries (id, name, root_path) VALUES (?, ?, ?) RETURNING *",
    )
    .bind(&id)
    .bind(name)
    .bind(root_path)
    .fetch_one(pool)
    .await
}

pub async fn list_libraries(pool: &SqlitePool) -> Result<Vec<Library>, sqlx::Error> {
    sqlx::query_as::<_, Library>("SELECT * FROM libraries ORDER BY updated_at DESC")
        .fetch_all(pool)
        .await
}

pub async fn get_library(pool: &SqlitePool, id: &str) -> Result<Library, sqlx::Error> {
    sqlx::query_as::<_, Library>("SELECT * FROM libraries WHERE id = ?")
        .bind(id)
        .fetch_one(pool)
        .await
}

pub async fn delete_library(pool: &SqlitePool, id: &str) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM libraries WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

// --- Asset queries ---

pub async fn insert_asset(pool: &SqlitePool, asset: &Asset) -> Result<Asset, sqlx::Error> {
    sqlx::query_as::<_, Asset>(
        "INSERT INTO assets (id, library_id, file_name, original_name, relative_path, file_type, mime_type, file_size, file_hash, width, height, duration_ms, description, ai_description, thumbnail_path, folder_path)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         RETURNING *"
    )
    .bind(&asset.id)
    .bind(&asset.library_id)
    .bind(&asset.file_name)
    .bind(&asset.original_name)
    .bind(&asset.relative_path)
    .bind(&asset.file_type)
    .bind(&asset.mime_type)
    .bind(asset.file_size)
    .bind(&asset.file_hash)
    .bind(asset.width)
    .bind(asset.height)
    .bind(asset.duration_ms)
    .bind(&asset.description)
    .bind(&asset.ai_description)
    .bind(&asset.thumbnail_path)
    .bind(&asset.folder_path)
    .fetch_one(pool)
    .await
}

pub async fn get_assets(
    pool: &SqlitePool,
    library_id: &str,
    folder_path: Option<&str>,
    file_type: Option<&str>,
    page: u32,
    page_size: u32,
    sort_by: &str,
    sort_order: &str,
) -> Result<PaginatedAssets, sqlx::Error> {
    let offset = (page.saturating_sub(1)) * page_size;

    let order_column = match sort_by {
        "name" => "file_name",
        "size" => "file_size",
        "date" => "imported_at",
        _ => "imported_at",
    };
    let order_dir = if sort_order == "asc" { "ASC" } else { "DESC" };

    // Build dynamic query
    let mut conditions = vec!["library_id = ?".to_string()];
    if folder_path.is_some() {
        conditions.push("folder_path = ?".to_string());
    }
    if file_type.is_some() {
        conditions.push("file_type = ?".to_string());
    }

    let where_clause = conditions.join(" AND ");

    let count_sql = format!("SELECT COUNT(*) as count FROM assets WHERE {}", where_clause);
    let query_sql = format!(
        "SELECT * FROM assets WHERE {} ORDER BY {} {} LIMIT ? OFFSET ?",
        where_clause, order_column, order_dir
    );

    // Count query
    let mut count_query = sqlx::query_scalar::<_, i64>(&count_sql).bind(library_id);
    if let Some(fp) = folder_path {
        count_query = count_query.bind(fp);
    }
    if let Some(ft) = file_type {
        count_query = count_query.bind(ft);
    }
    let total = count_query.fetch_one(pool).await?;

    // Data query
    let mut data_query = sqlx::query_as::<_, Asset>(&query_sql).bind(library_id);
    if let Some(fp) = folder_path {
        data_query = data_query.bind(fp);
    }
    if let Some(ft) = file_type {
        data_query = data_query.bind(ft);
    }
    data_query = data_query.bind(page_size).bind(offset);
    let assets = data_query.fetch_all(pool).await?;

    Ok(PaginatedAssets {
        assets,
        total,
        page,
        page_size,
    })
}

pub async fn get_asset(pool: &SqlitePool, id: &str) -> Result<Asset, sqlx::Error> {
    sqlx::query_as::<_, Asset>("SELECT * FROM assets WHERE id = ?")
        .bind(id)
        .fetch_one(pool)
        .await
}

pub async fn rename_asset(
    pool: &SqlitePool,
    id: &str,
    new_name: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE assets SET file_name = ?, updated_at = datetime('now') WHERE id = ?")
        .bind(new_name)
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn update_asset_description(
    pool: &SqlitePool,
    id: &str,
    description: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE assets SET description = ?, updated_at = datetime('now') WHERE id = ?")
        .bind(description)
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn delete_assets(pool: &SqlitePool, ids: &[String]) -> Result<(), sqlx::Error> {
    for id in ids {
        sqlx::query("DELETE FROM assets WHERE id = ?")
            .bind(id)
            .execute(pool)
            .await?;
    }
    Ok(())
}

pub async fn move_assets(
    pool: &SqlitePool,
    ids: &[String],
    target_folder: &str,
) -> Result<(), sqlx::Error> {
    for id in ids {
        sqlx::query(
            "UPDATE assets SET folder_path = ?, updated_at = datetime('now') WHERE id = ?",
        )
        .bind(target_folder)
        .bind(id)
        .execute(pool)
        .await?;
    }
    Ok(())
}

pub async fn get_folders(
    pool: &SqlitePool,
    library_id: &str,
) -> Result<Vec<FolderInfo>, sqlx::Error> {
    let rows = sqlx::query_as::<_, (String, i64)>(
        "SELECT folder_path, COUNT(*) as asset_count FROM assets WHERE library_id = ? GROUP BY folder_path ORDER BY folder_path",
    )
    .bind(library_id)
    .fetch_all(pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|(path, count)| {
            let name = path
                .rsplit('/')
                .find(|s| !s.is_empty())
                .unwrap_or("/")
                .to_string();
            FolderInfo {
                path: path.clone(),
                name,
                asset_count: count,
            }
        })
        .collect())
}

pub async fn create_folder(
    pool: &SqlitePool,
    library_id: &str,
    path: &str,
) -> Result<(), sqlx::Error> {
    // Folders are virtual — they exist implicitly via folder_path on assets.
    // We insert a sentinel record or just validate the path format.
    // For now, folders are created implicitly when assets are moved into them.
    let _ = (pool, library_id, path);
    Ok(())
}

// --- Tag queries ---

pub async fn create_tag(
    pool: &SqlitePool,
    library_id: &str,
    name: &str,
    color: &str,
    category: &str,
    is_ai: bool,
) -> Result<Tag, sqlx::Error> {
    let id = Uuid::new_v4().to_string();
    sqlx::query_as::<_, Tag>(
        "INSERT INTO tags (id, library_id, name, color, category, is_ai) VALUES (?, ?, ?, ?, ?, ?) RETURNING *",
    )
    .bind(&id)
    .bind(library_id)
    .bind(name)
    .bind(color)
    .bind(category)
    .bind(is_ai)
    .fetch_one(pool)
    .await
}

pub async fn get_or_create_tag(
    pool: &SqlitePool,
    library_id: &str,
    name: &str,
    is_ai: bool,
) -> Result<Tag, sqlx::Error> {
    // Try to find existing
    let existing = sqlx::query_as::<_, Tag>(
        "SELECT * FROM tags WHERE library_id = ? AND name = ?",
    )
    .bind(library_id)
    .bind(name)
    .fetch_optional(pool)
    .await?;

    if let Some(tag) = existing {
        return Ok(tag);
    }

    create_tag(pool, library_id, name, "#808080", "", is_ai).await
}

pub async fn list_tags(
    pool: &SqlitePool,
    library_id: &str,
    category: Option<&str>,
) -> Result<Vec<TagWithCount>, sqlx::Error> {
    let sql = if category.is_some() {
        "SELECT t.*, COALESCE(c.cnt, 0) as asset_count
         FROM tags t
         LEFT JOIN (SELECT tag_id, COUNT(*) as cnt FROM asset_tags GROUP BY tag_id) c ON c.tag_id = t.id
         WHERE t.library_id = ? AND t.category = ?
         ORDER BY t.name"
    } else {
        "SELECT t.*, COALESCE(c.cnt, 0) as asset_count
         FROM tags t
         LEFT JOIN (SELECT tag_id, COUNT(*) as cnt FROM asset_tags GROUP BY tag_id) c ON c.tag_id = t.id
         WHERE t.library_id = ?
         ORDER BY t.name"
    };

    // Manual mapping since TagWithCount doesn't derive FromRow easily with the join
    let rows = if let Some(cat) = category {
        sqlx::query_as::<_, (String, String, String, String, String, bool, String, i64)>(sql)
            .bind(library_id)
            .bind(cat)
            .fetch_all(pool)
            .await?
    } else {
        sqlx::query_as::<_, (String, String, String, String, String, bool, String, i64)>(sql)
            .bind(library_id)
            .fetch_all(pool)
            .await?
    };

    Ok(rows
        .into_iter()
        .map(
            |(id, library_id, name, color, category, is_ai, created_at, asset_count)| {
                TagWithCount {
                    id,
                    library_id,
                    name,
                    color,
                    category,
                    is_ai,
                    created_at,
                    asset_count,
                }
            },
        )
        .collect())
}

pub async fn rename_tag(pool: &SqlitePool, id: &str, new_name: &str) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE tags SET name = ? WHERE id = ?")
        .bind(new_name)
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn delete_tag(pool: &SqlitePool, id: &str) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM tags WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn assign_tags(
    pool: &SqlitePool,
    asset_id: &str,
    tag_ids: &[String],
) -> Result<(), sqlx::Error> {
    for tag_id in tag_ids {
        sqlx::query(
            "INSERT OR IGNORE INTO asset_tags (asset_id, tag_id) VALUES (?, ?)",
        )
        .bind(asset_id)
        .bind(tag_id)
        .execute(pool)
        .await?;
    }
    Ok(())
}

pub async fn remove_tags(
    pool: &SqlitePool,
    asset_id: &str,
    tag_ids: &[String],
) -> Result<(), sqlx::Error> {
    for tag_id in tag_ids {
        sqlx::query("DELETE FROM asset_tags WHERE asset_id = ? AND tag_id = ?")
            .bind(asset_id)
            .bind(tag_id)
            .execute(pool)
            .await?;
    }
    Ok(())
}

pub async fn get_asset_tags(pool: &SqlitePool, asset_id: &str) -> Result<Vec<Tag>, sqlx::Error> {
    sqlx::query_as::<_, Tag>(
        "SELECT t.* FROM tags t INNER JOIN asset_tags at ON t.id = at.tag_id WHERE at.asset_id = ? ORDER BY t.name",
    )
    .bind(asset_id)
    .fetch_all(pool)
    .await
}

// --- Search queries ---

pub async fn search_keyword(
    pool: &SqlitePool,
    library_id: &str,
    query: &str,
    tag_ids: Option<&[String]>,
    file_type: Option<&str>,
    page: u32,
    page_size: u32,
) -> Result<PaginatedAssets, sqlx::Error> {
    let offset = (page.saturating_sub(1)) * page_size;

    // Use FTS5 for text search
    let fts_query = format!("\"{}\"", query.replace('"', "\"\""));

    let base_sql = if let Some(tags) = tag_ids {
        if tags.is_empty() {
            format!(
                "SELECT a.* FROM assets a
                 INNER JOIN assets_fts f ON a.rowid = f.rowid
                 WHERE a.library_id = ? AND assets_fts MATCH ?{}",
                if file_type.is_some() {
                    " AND a.file_type = ?"
                } else {
                    ""
                }
            )
        } else {
            let placeholders: Vec<&str> = tags.iter().map(|_| "?").collect();
            format!(
                "SELECT DISTINCT a.* FROM assets a
                 INNER JOIN assets_fts f ON a.rowid = f.rowid
                 INNER JOIN asset_tags at ON a.id = at.asset_id
                 WHERE a.library_id = ? AND assets_fts MATCH ? AND at.tag_id IN ({}){}",
                placeholders.join(","),
                if file_type.is_some() {
                    " AND a.file_type = ?"
                } else {
                    ""
                }
            )
        }
    } else {
        format!(
            "SELECT a.* FROM assets a
             INNER JOIN assets_fts f ON a.rowid = f.rowid
             WHERE a.library_id = ? AND assets_fts MATCH ?{}",
            if file_type.is_some() {
                " AND a.file_type = ?"
            } else {
                ""
            }
        )
    };

    let count_sql = format!(
        "SELECT COUNT(*) FROM ({}) sub",
        base_sql
    );
    let data_sql = format!(
        "{} ORDER BY a.imported_at DESC LIMIT ? OFFSET ?",
        base_sql
    );

    // For simplicity in this initial version, handle the common case (no tag filter)
    let total: i64;
    let assets: Vec<Asset>;

    if tag_ids.is_none() || tag_ids.map(|t| t.is_empty()).unwrap_or(true) {
        if let Some(ft) = file_type {
            total = sqlx::query_scalar(&count_sql)
                .bind(library_id)
                .bind(&fts_query)
                .bind(ft)
                .fetch_one(pool)
                .await?;
            assets = sqlx::query_as::<_, Asset>(&data_sql)
                .bind(library_id)
                .bind(&fts_query)
                .bind(ft)
                .bind(page_size)
                .bind(offset)
                .fetch_all(pool)
                .await?;
        } else {
            total = sqlx::query_scalar(&count_sql)
                .bind(library_id)
                .bind(&fts_query)
                .fetch_one(pool)
                .await?;
            assets = sqlx::query_as::<_, Asset>(&data_sql)
                .bind(library_id)
                .bind(&fts_query)
                .bind(page_size)
                .bind(offset)
                .fetch_all(pool)
                .await?;
        }
    } else {
        // Fallback for tag-filtered search - simplified
        total = 0;
        assets = vec![];
    }

    Ok(PaginatedAssets {
        assets,
        total,
        page,
        page_size,
    })
}

pub async fn search_by_tags(
    pool: &SqlitePool,
    library_id: &str,
    tag_ids: &[String],
    match_all: bool,
) -> Result<Vec<Asset>, sqlx::Error> {
    if tag_ids.is_empty() {
        return Ok(vec![]);
    }

    let placeholders: Vec<String> = tag_ids.iter().map(|_| "?".to_string()).collect();
    let ph = placeholders.join(",");

    let sql = if match_all {
        format!(
            "SELECT a.* FROM assets a
             INNER JOIN asset_tags at ON a.id = at.asset_id
             WHERE a.library_id = ? AND at.tag_id IN ({})
             GROUP BY a.id
             HAVING COUNT(DISTINCT at.tag_id) = ?",
            ph
        )
    } else {
        format!(
            "SELECT DISTINCT a.* FROM assets a
             INNER JOIN asset_tags at ON a.id = at.asset_id
             WHERE a.library_id = ? AND at.tag_id IN ({})",
            ph
        )
    };

    let mut query = sqlx::query_as::<_, Asset>(&sql).bind(library_id);
    for tag_id in tag_ids {
        query = query.bind(tag_id);
    }
    if match_all {
        query = query.bind(tag_ids.len() as i64);
    }

    query.fetch_all(pool).await
}

// --- AI Config queries ---

pub async fn save_ai_config(
    pool: &SqlitePool,
    config: &AiConfig,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "INSERT OR REPLACE INTO ai_config (id, provider_name, api_endpoint, api_key, model_id, embedding_model, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&config.id)
    .bind(&config.provider_name)
    .bind(&config.api_endpoint)
    .bind(&config.api_key)
    .bind(&config.model_id)
    .bind(&config.embedding_model)
    .bind(config.is_active)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn get_active_ai_config(pool: &SqlitePool) -> Result<Option<AiConfig>, sqlx::Error> {
    sqlx::query_as::<_, AiConfig>("SELECT * FROM ai_config WHERE is_active = 1 LIMIT 1")
        .fetch_optional(pool)
        .await
}

// --- Embedding queries ---

pub async fn save_embedding(
    pool: &SqlitePool,
    asset_id: &str,
    model: &str,
    vector: &[u8],
) -> Result<(), sqlx::Error> {
    let id = Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT OR REPLACE INTO embeddings (id, asset_id, model, vector) VALUES (?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(asset_id)
    .bind(model)
    .bind(vector)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn get_all_embeddings(
    pool: &SqlitePool,
    library_id: &str,
    model: &str,
) -> Result<Vec<(String, Vec<u8>)>, sqlx::Error> {
    sqlx::query_as::<_, (String, Vec<u8>)>(
        "SELECT e.asset_id, e.vector FROM embeddings e
         INNER JOIN assets a ON e.asset_id = a.id
         WHERE a.library_id = ? AND e.model = ?",
    )
    .bind(library_id)
    .bind(model)
    .fetch_all(pool)
    .await
}
