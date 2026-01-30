import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "../services/tauriBridge";
import { useAppStore } from "../stores/appStore";

export function useLibraries() {
  return useQuery({
    queryKey: ["libraries"],
    queryFn: api.listLibraries,
  });
}

export function useCreateLibrary() {
  const queryClient = useQueryClient();
  const setCurrentLibrary = useAppStore((s) => s.setCurrentLibrary);

  return useMutation({
    mutationFn: ({ name, rootPath }: { name: string; rootPath: string }) =>
      api.createLibrary(name, rootPath),
    onSuccess: (library) => {
      queryClient.invalidateQueries({ queryKey: ["libraries"] });
      setCurrentLibrary(library);
    },
  });
}

export function useDeleteLibrary() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.deleteLibrary(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["libraries"] });
    },
  });
}
