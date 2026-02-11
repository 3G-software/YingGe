import { invoke } from "@tauri-apps/api/core";
import type {
  Library,
  Asset,
  PaginatedAssets,
  AssetDetail,
  FolderInfo,
  Tag,
  TagWithCount,
  AiConfig,
  AiConfigInput,
  AiTagResult,
  ScoredAsset,
  SpritesheetResult,
} from "../types/asset";

// --- Library ---

export const createLibrary = (name: string, rootPath: string) =>
  invoke<Library>("create_library", { name, rootPath });

export const listLibraries = () => invoke<Library[]>("list_libraries");

export const getLibrary = (id: string) =>
  invoke<Library>("get_library", { id });

export const deleteLibrary = (id: string) =>
  invoke<void>("delete_library", { id });

// --- Asset ---

export const importAssets = (
  libraryId: string,
  filePaths: string[],
  folderPath: string
) =>
  invoke<Asset[]>("import_assets", { libraryId, filePaths, folderPath });

export const getAssets = (params: {
  libraryId: string;
  folderPath?: string;
  fileType?: string;
  page: number;
  pageSize: number;
  sortBy: string;
  sortOrder: string;
}) => invoke<PaginatedAssets>("get_assets", params);

export const getAssetDetail = (id: string) =>
  invoke<AssetDetail>("get_asset_detail", { id });

export const renameAsset = (id: string, newName: string) =>
  invoke<void>("rename_asset", { id, newName });

export const updateDescription = (id: string, description: string) =>
  invoke<void>("update_description", { id, description });

export const deleteAssets = (ids: string[]) =>
  invoke<void>("delete_assets", { ids });

export const moveAssets = (ids: string[], targetFolder: string) =>
  invoke<void>("move_assets", { ids, targetFolder });

export const getFolders = (libraryId: string) =>
  invoke<FolderInfo[]>("get_folders", { libraryId });

export const createFolder = (libraryId: string, folderName: string, parentPath: string) =>
  invoke<void>("create_folder", { libraryId, folderName, parentPath });

export const renameFolder = (libraryId: string, oldPath: string, newName: string) =>
  invoke<void>("rename_folder", { libraryId, oldPath, newName });

export const getAssetFilePath = (id: string) =>
  invoke<string>("get_asset_file_path", { id });

export const getThumbnailPath = (id: string) =>
  invoke<string | null>("get_thumbnail_path", { id });

export const getThumbnailData = (id: string) =>
  invoke<string | null>("get_thumbnail_data", { id });

// --- Tag ---

export const createTag = (
  libraryId: string,
  name: string,
  color?: string,
  category?: string
) => invoke<Tag>("create_tag", { libraryId, name, color, category });

export const listTags = (libraryId: string, category?: string) =>
  invoke<TagWithCount[]>("list_tags", { libraryId, category });

export const renameTag = (id: string, newName: string) =>
  invoke<void>("rename_tag", { id, newName });

export const deleteTag = (id: string) => invoke<void>("delete_tag", { id });

export const assignTags = (assetId: string, tagIds: string[]) =>
  invoke<void>("assign_tags", { assetId, tagIds });

export const removeTags = (assetId: string, tagIds: string[]) =>
  invoke<void>("remove_tags", { assetId, tagIds });

export const getAssetTags = (assetId: string) =>
  invoke<Tag[]>("get_asset_tags", { assetId });

// --- Search ---

export const searchKeyword = (params: {
  libraryId: string;
  query: string;
  tagIds?: string[];
  fileType?: string;
  page: number;
  pageSize: number;
}) => invoke<PaginatedAssets>("search_keyword", params);

export const searchByTags = (
  libraryId: string,
  tagIds: string[],
  matchAll: boolean
) => invoke<Asset[]>("search_by_tags", { libraryId, tagIds, matchAll });

// --- AI ---

export const aiTagAsset = (assetId: string) =>
  invoke<AiTagResult>("ai_tag_asset", { assetId });

export const aiSemanticSearch = (
  libraryId: string,
  query: string,
  topK: number
) => invoke<ScoredAsset[]>("ai_semantic_search", { libraryId, query, topK });

export const saveAiConfig = (config: AiConfigInput) =>
  invoke<void>("save_ai_config", { config });

export const getAiConfig = () => invoke<AiConfig | null>("get_ai_config");

export const testAiConnection = (config: AiConfigInput) =>
  invoke<boolean>("test_ai_connection", { config });

// --- Processing ---

export const removeBackground = (
  assetId: string,
  targetColor: [number, number, number],
  tolerance: number
) => invoke<Asset>("remove_background", { assetId, targetColor, tolerance });

export const mergeSpritesheet = (params: {
  assetIds: string[];
  columns: number;
  padding: number;
  outputName: string;
  descriptorFormat: string;
}) => invoke<SpritesheetResult>("merge_spritesheet", params);

export const splitImage = (assetId: string, rows: number, cols: number) =>
  invoke<Asset[]>("split_image", { assetId, rows, cols });
