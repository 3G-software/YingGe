import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "../services/tauriBridge";
import { useAppStore } from "../stores/appStore";

export function useAssets(page = 1, pageSize = 50) {
  const libraryId = useAppStore((s) => s.currentLibrary?.id);
  const folderPath = useAppStore((s) => s.currentFolder);

  return useQuery({
    queryKey: ["assets", libraryId, folderPath, page, pageSize],
    queryFn: () =>
      api.getAssets({
        libraryId: libraryId!,
        folderPath,
        page,
        pageSize,
        sortBy: "date",
        sortOrder: "desc",
      }),
    enabled: !!libraryId,
  });
}

export function useAssetDetail(assetId: string | null) {
  return useQuery({
    queryKey: ["asset-detail", assetId],
    queryFn: () => api.getAssetDetail(assetId!),
    enabled: !!assetId,
  });
}

export function useImportAssets() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      libraryId,
      filePaths,
      folderPath,
    }: {
      libraryId: string;
      filePaths: string[];
      folderPath: string;
    }) => api.importAssets(libraryId, filePaths, folderPath),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      queryClient.invalidateQueries({ queryKey: ["folders"] });
    },
  });
}

export function useRenameAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, newName }: { id: string; newName: string }) =>
      api.renameAsset(id, newName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      queryClient.invalidateQueries({ queryKey: ["asset-detail"] });
    },
  });
}

export function useUpdateDescription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      description,
    }: {
      id: string;
      description: string;
    }) => api.updateDescription(id, description),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["asset-detail"] });
    },
  });
}

export function useDeleteAssets() {
  const queryClient = useQueryClient();
  const clearSelection = useAppStore((s) => s.clearSelection);

  return useMutation({
    mutationFn: (ids: string[]) => api.deleteAssets(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      clearSelection();
    },
  });
}

export function useFolders() {
  const libraryId = useAppStore((s) => s.currentLibrary?.id);

  return useQuery({
    queryKey: ["folders", libraryId],
    queryFn: () => api.getFolders(libraryId!),
    enabled: !!libraryId,
  });
}
