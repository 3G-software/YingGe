import { create } from "zustand";
import type { Library } from "../types/asset";

interface AppState {
  currentLibrary: Library | null;
  selectedAssetIds: string[];
  currentFolder: string;
  viewMode: "grid" | "list";
  sidebarOpen: boolean;
  searchQuery: string;
  searchMode: "keyword" | "semantic";

  setCurrentLibrary: (library: Library | null) => void;
  setSelectedAssetIds: (ids: string[]) => void;
  toggleAssetSelection: (id: string) => void;
  clearSelection: () => void;
  setCurrentFolder: (folder: string) => void;
  setViewMode: (mode: "grid" | "list") => void;
  setSidebarOpen: (open: boolean) => void;
  setSearchQuery: (query: string) => void;
  setSearchMode: (mode: "keyword" | "semantic") => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentLibrary: null,
  selectedAssetIds: [],
  currentFolder: "/",
  viewMode: "grid",
  sidebarOpen: true,
  searchQuery: "",
  searchMode: "keyword",

  setCurrentLibrary: (library) => set({ currentLibrary: library }),
  setSelectedAssetIds: (ids) => set({ selectedAssetIds: ids }),
  toggleAssetSelection: (id) =>
    set((state) => ({
      selectedAssetIds: state.selectedAssetIds.includes(id)
        ? state.selectedAssetIds.filter((i) => i !== id)
        : [...state.selectedAssetIds, id],
    })),
  clearSelection: () => set({ selectedAssetIds: [] }),
  setCurrentFolder: (folder) => set({ currentFolder: folder }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setSearchMode: (mode) => set({ searchMode: mode }),
}));
