import { useMutation } from "@tanstack/react-query";
import * as api from "../services/tauriBridge";

export function useKeywordSearch() {
  return useMutation({
    mutationFn: (params: {
      libraryId: string;
      query: string;
      tagIds?: string[];
      fileType?: string;
      page: number;
      pageSize: number;
    }) => api.searchKeyword(params),
  });
}

export function useSemanticSearch() {
  return useMutation({
    mutationFn: ({
      libraryId,
      query,
      topK,
    }: {
      libraryId: string;
      query: string;
      topK: number;
    }) => api.aiSemanticSearch(libraryId, query, topK),
  });
}

export function useTagSearch() {
  return useMutation({
    mutationFn: ({
      libraryId,
      tagIds,
      matchAll,
    }: {
      libraryId: string;
      tagIds: string[];
      matchAll: boolean;
    }) => api.searchByTags(libraryId, tagIds, matchAll),
  });
}
