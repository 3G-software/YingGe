import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "../services/tauriBridge";
import { useAppStore } from "../stores/appStore";

export function useTags() {
  const libraryId = useAppStore((s) => s.currentLibrary?.id);

  return useQuery({
    queryKey: ["tags", libraryId],
    queryFn: () => api.listTags(libraryId!),
    enabled: !!libraryId,
  });
}

export function useCreateTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      libraryId,
      name,
      color,
      category,
    }: {
      libraryId: string;
      name: string;
      color?: string;
      category?: string;
    }) => api.createTag(libraryId, name, color, category),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tags"] });
    },
  });
}

export function useDeleteTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.deleteTag(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tags"] });
    },
  });
}

export function useAssignTags() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      assetId,
      tagIds,
    }: {
      assetId: string;
      tagIds: string[];
    }) => api.assignTags(assetId, tagIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["asset-detail"] });
      queryClient.invalidateQueries({ queryKey: ["tags"] });
    },
  });
}

export function useRemoveTags() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      assetId,
      tagIds,
    }: {
      assetId: string;
      tagIds: string[];
    }) => api.removeTags(assetId, tagIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["asset-detail"] });
      queryClient.invalidateQueries({ queryKey: ["tags"] });
    },
  });
}
