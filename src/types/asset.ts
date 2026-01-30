export interface Asset {
  id: string;
  library_id: string;
  file_name: string;
  original_name: string;
  relative_path: string;
  file_type: "image" | "audio" | "video" | "other";
  mime_type: string;
  file_size: number;
  file_hash: string;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
  description: string;
  ai_description: string;
  thumbnail_path: string | null;
  folder_path: string;
  created_at: string;
  updated_at: string;
  imported_at: string;
}

export interface PaginatedAssets {
  assets: Asset[];
  total: number;
  page: number;
  page_size: number;
}

export interface AssetDetail {
  asset: Asset;
  tags: Tag[];
}

export interface FolderInfo {
  path: string;
  name: string;
  asset_count: number;
}

export interface Tag {
  id: string;
  library_id: string;
  name: string;
  color: string;
  category: string;
  is_ai: boolean;
  created_at: string;
}

export interface TagWithCount extends Tag {
  asset_count: number;
}

export interface ScoredAsset {
  asset: Asset;
  score: number;
}

export interface AiTagResult {
  tags: Tag[];
  description: string;
  suggested_name: string | null;
}

export interface AiConfig {
  id: string;
  provider_name: string;
  api_endpoint: string;
  api_key: string;
  model_id: string;
  embedding_model: string;
  is_active: boolean;
  created_at: string;
}

export interface AiConfigInput {
  provider_name: string;
  api_endpoint: string;
  api_key: string;
  model_id: string;
  embedding_model: string;
}

export interface Library {
  id: string;
  name: string;
  root_path: string;
  created_at: string;
  updated_at: string;
}

export interface SpritesheetResult {
  image_asset: Asset;
  descriptor_content: string;
}
