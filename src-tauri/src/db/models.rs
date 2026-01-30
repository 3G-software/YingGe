use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Library {
    pub id: String,
    pub name: String,
    pub root_path: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Asset {
    pub id: String,
    pub library_id: String,
    pub file_name: String,
    pub original_name: String,
    pub relative_path: String,
    pub file_type: String,
    pub mime_type: String,
    pub file_size: i64,
    pub file_hash: String,
    pub width: Option<i32>,
    pub height: Option<i32>,
    pub duration_ms: Option<i64>,
    pub description: String,
    pub ai_description: String,
    pub thumbnail_path: Option<String>,
    pub folder_path: String,
    pub created_at: String,
    pub updated_at: String,
    pub imported_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Tag {
    pub id: String,
    pub library_id: String,
    pub name: String,
    pub color: String,
    pub category: String,
    pub is_ai: bool,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TagWithCount {
    pub id: String,
    pub library_id: String,
    pub name: String,
    pub color: String,
    pub category: String,
    pub is_ai: bool,
    pub created_at: String,
    pub asset_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct AssetTag {
    pub asset_id: String,
    pub tag_id: String,
    pub confidence: f64,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Embedding {
    pub id: String,
    pub asset_id: String,
    pub model: String,
    pub vector: Vec<u8>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct AiConfig {
    pub id: String,
    pub provider_name: String,
    pub api_endpoint: String,
    pub api_key: String,
    pub model_id: String,
    pub embedding_model: String,
    pub is_active: bool,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Plugin {
    pub id: String,
    pub name: String,
    pub version: String,
    pub description: String,
    pub entry_point: String,
    pub enabled: bool,
    pub config_json: String,
    pub installed_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaginatedAssets {
    pub assets: Vec<Asset>,
    pub total: i64,
    pub page: u32,
    pub page_size: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssetDetail {
    pub asset: Asset,
    pub tags: Vec<Tag>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FolderInfo {
    pub path: String,
    pub name: String,
    pub asset_count: i64,
}
