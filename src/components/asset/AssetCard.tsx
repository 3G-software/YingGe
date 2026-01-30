import { useState, useEffect } from "react";
import { Image, Music, File, Check } from "lucide-react";
import { convertFileSrc } from "@tauri-apps/api/core";
import type { Asset } from "../../types/asset";
import { useAppStore } from "../../stores/appStore";
import { getThumbnailPath } from "../../services/tauriBridge";

interface AssetCardProps {
  asset: Asset;
  onClick: () => void;
}

export function AssetCard({ asset, onClick }: AssetCardProps) {
  const { selectedAssetIds, toggleAssetSelection } = useAppStore();
  const isSelected = selectedAssetIds.includes(asset.id);
  const [thumbSrc, setThumbSrc] = useState<string | null>(null);

  useEffect(() => {
    if (asset.file_type === "image" && asset.thumbnail_path) {
      getThumbnailPath(asset.id).then((path) => {
        if (path) setThumbSrc(convertFileSrc(path));
      });
    }
  }, [asset.id, asset.file_type, asset.thumbnail_path]);

  const handleSelect = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleAssetSelection(asset.id);
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
      onClick={onClick}
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
