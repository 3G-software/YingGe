import { useState } from "react";
import {
  Search,
  LayoutGrid,
  List,
  Upload,
  Sparkles,
  PanelLeftClose,
  PanelLeft,
  Trash2,
} from "lucide-react";
import { useAppStore } from "../../stores/appStore";
import { useDeleteAssets } from "../../hooks/useAssets";

interface TopBarProps {
  onImportClick: () => void;
  onSearch: (query: string, mode: "keyword" | "semantic") => void;
}

export function TopBar({ onImportClick, onSearch }: TopBarProps) {
  const {
    viewMode,
    setViewMode,
    sidebarOpen,
    setSidebarOpen,
    searchQuery,
    setSearchQuery,
    searchMode,
    setSearchMode,
    selectedAssetIds,
    clearSelection,
  } = useAppStore();
  const deleteAssets = useDeleteAssets();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (selectedAssetIds.length === 0) return;

    const confirmed = window.confirm(
      `Delete ${selectedAssetIds.length} selected asset(s)? This cannot be undone.`
    );
    if (!confirmed) return;

    setDeleting(true);
    try {
      await deleteAssets.mutateAsync(selectedAssetIds);
      clearSelection();
    } catch (e) {
      console.error("Delete failed:", e);
    }
    setDeleting(false);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      onSearch(searchQuery, searchMode);
    }
  };

  return (
    <header className="h-12 flex items-center gap-3 px-3 border-b border-border bg-bg-secondary">
      {/* Sidebar toggle */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="p-1.5 rounded hover:bg-bg-tertiary text-text-secondary hover:text-text-primary transition-colors"
      >
        {sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeft size={18} />}
      </button>

      {/* Search */}
      <form
        onSubmit={handleSearchSubmit}
        className="flex-1 flex items-center gap-2 max-w-xl"
      >
        <div className="flex-1 relative flex items-center">
          <Search
            size={16}
            className="absolute left-2.5 text-text-secondary pointer-events-none"
          />
          <input
            type="text"
            placeholder={
              searchMode === "semantic"
                ? "Describe what you're looking for..."
                : "Search assets..."
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm bg-bg rounded border border-border focus:border-primary focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={() =>
            setSearchMode(searchMode === "keyword" ? "semantic" : "keyword")
          }
          className={`p-1.5 rounded border transition-colors ${
            searchMode === "semantic"
              ? "border-primary bg-primary/20 text-primary"
              : "border-border text-text-secondary hover:text-text-primary hover:bg-bg-tertiary"
          }`}
          title={
            searchMode === "semantic"
              ? "AI Semantic Search (active)"
              : "Switch to AI Search"
          }
        >
          <Sparkles size={16} />
        </button>
      </form>

      {/* Actions */}
      <div className="flex items-center gap-1">
        {/* Delete button - shown when assets selected */}
        {selectedAssetIds.length > 0 && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-red-500 text-white rounded hover:bg-red-600 transition-colors disabled:opacity-50"
          >
            <Trash2 size={14} />
            Delete ({selectedAssetIds.length})
          </button>
        )}

        <button
          onClick={onImportClick}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-white rounded hover:bg-primary-hover transition-colors"
        >
          <Upload size={14} />
          Import
        </button>

        <div className="flex items-center border border-border rounded ml-2">
          <button
            onClick={() => setViewMode("grid")}
            className={`p-1.5 transition-colors ${
              viewMode === "grid"
                ? "bg-bg-tertiary text-text-primary"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            <LayoutGrid size={16} />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`p-1.5 transition-colors ${
              viewMode === "list"
                ? "bg-bg-tertiary text-text-primary"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            <List size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}
