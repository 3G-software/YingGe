import { useState, useEffect } from "react";
import { Image, Music, File, Check } from "lucide-react";
import type { Asset } from "../../types/asset";
import { useAppStore } from "../../stores/appStore";
import { getThumbnailData } from "../../services/tauriBridge";

interface AssetCardProps {
  asset: Asset;
  assetIndex: number;
  allAssets: Asset[];
  onClick: () => void;
}

export function AssetCard({ asset, assetIndex, allAssets, onClick }: AssetCardProps) {
  const { selectedAssetIds, toggleAssetSelection, setSelectedAssetIds } = useAppStore();
  const isSelected = selectedAssetIds.includes(asset.id);
  const [thumbSrc, setThumbSrc] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Listen for asset updates to refresh thumbnail
  useEffect(() => {
    const handleAssetUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail?.assetId === asset.id) {
        setRefreshKey(prev => prev + 1);
      }
    };

    window.addEventListener('asset-updated', handleAssetUpdate);
    return () => window.removeEventListener('asset-updated', handleAssetUpdate);
  }, [asset.id]);

  useEffect(() => {
    if (asset.file_type === "image" && asset.thumbnail_path) {
      // Clear previous thumbnail to force reload
      setThumbSrc(null);

      getThumbnailData(asset.id).then((dataUrl) => {
        if (dataUrl) {
          // Add timestamp to prevent browser caching
          const cacheBuster = `${asset.id}-${asset.updated_at}-${refreshKey}-${Date.now()}`;
          const newSrc = `${dataUrl}#${cacheBuster}`;
          setThumbSrc(newSrc);
        }
      });
    }
  }, [asset.id, asset.file_type, asset.thumbnail_path, asset.updated_at, refreshKey]);

  const handleSelect = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleAssetSelection(asset.id);
  };

  const handleClick = (e: React.MouseEvent) => {
    // If holding Cmd/Ctrl, toggle selection without opening detail
    if (e.metaKey || e.ctrlKey) {
      toggleAssetSelection(asset.id);
    } else if (e.shiftKey) {
      // Shift+click: range selection from last selected to current
      if (selectedAssetIds.length === 0) {
        // No previous selection, just select this one
        setSelectedAssetIds([asset.id]);
      } else {
        // Find the index of the last selected asset
        const lastSelectedId = selectedAssetIds[selectedAssetIds.length - 1];
        const lastSelectedIndex = allAssets.findIndex(a => a.id === lastSelectedId);

        if (lastSelectedIndex === -1) {
          // Last selected asset not found in current list, just select this one
          setSelectedAssetIds([asset.id]);
        } else {
          // Select all assets between lastSelectedIndex and current assetIndex
          const startIndex = Math.min(lastSelectedIndex, assetIndex);
          const endIndex = Math.max(lastSelectedIndex, assetIndex);
          const rangeIds = allAssets.slice(startIndex, endIndex + 1).map(a => a.id);

          // Merge with existing selection (keep previously selected items)
          const newSelection = [...new Set([...selectedAssetIds, ...rangeIds])];
          setSelectedAssetIds(newSelection);
        }
      }
    } else {
      // Normal click: select this asset only and open detail
      setSelectedAssetIds([asset.id]);
      onClick();
    }
  };

  const handleDragStart = (_e: React.DragEvent) => {
    // If dragging a selected asset, drag all selected assets
    // If dragging an unselected asset, select it first
    const assetsToDrag = isSelected ? selectedAssetIds : [asset.id];

    if (!isSelected) {
      setSelectedAssetIds([asset.id]);
    }

    // Store asset IDs in global variable for Tauri drag system to access
    (window as any).__draggedAssetIds = assetsToDrag;
  };

  const handleDragEnd = () => {
    // Clear the dragged asset IDs after a short delay
    setTimeout(() => {
      (window as any).__draggedAssetIds = null;
    }, 500);
  };

  const fileIcon = () => {
    switch (asset.file_type) {
      case "image":
        return <Image size={32} className="text-text-secondary" />;
      case "audio":
        return <Music size={32} className="text-text-secondary" />;
      default:
        return <File size={32} className="text-text-secondary" />;
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div
      onClick={handleClick}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={`group relative rounded-lg border transition-all cursor-pointer overflow-hidden ${
        isSelected
          ? "border-primary bg-primary/10"
          : "border-border hover:border-primary/50 bg-bg-secondary"
      }`}
    >
      {/* Selection checkbox */}
      <button
        onClick={handleSelect}
        className={`absolute top-2 left-2 z-10 w-5 h-5 rounded border flex items-center justify-center transition-all ${
          isSelected
            ? "bg-primary border-primary"
            : "border-border bg-bg/80 opacity-0 group-hover:opacity-100"
        }`}
      >
        {isSelected && <Check size={12} className="text-white" />}
      </button>

      {/* Thumbnail */}
      <div className="aspect-square flex items-center justify-center bg-bg-tertiary/50">
        {thumbSrc ? (
          <img
            key={`${asset.id}-${refreshKey}`}
            src={thumbSrc}
            alt={asset.file_name}
            className="w-full h-full object-contain"
          />
        ) : (
          fileIcon()
        )}
      </div>

      {/* Info */}
      <div className="p-2">
        <div className="text-sm font-medium truncate" title={asset.file_name}>
          {asset.file_name}
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs text-text-secondary">
            {formatSize(asset.file_size)}
          </span>
          {asset.width && asset.height && (
            <span className="text-xs text-text-secondary">
              {asset.width}x{asset.height}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
