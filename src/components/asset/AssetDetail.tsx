import { useState, useEffect } from "react";
import {
  X,
  Edit2,
  Save,
  Sparkles,
  Tag as TagIcon,
} from "lucide-react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { useAssetDetail, useRenameAsset, useUpdateDescription } from "../../hooks/useAssets";
import { useRemoveTags } from "../../hooks/useTags";
import { aiTagAsset, getAssetFilePath } from "../../services/tauriBridge";

interface AssetDetailProps {
  assetId: string;
  onClose: () => void;
}

export function AssetDetail({ assetId, onClose }: AssetDetailProps) {
  const { data: detail, refetch } = useAssetDetail(assetId);
  const renameAsset = useRenameAsset();
  const updateDesc = useUpdateDescription();
  const removeTags = useRemoveTags();

  const [editing, setEditing] = useState<"name" | "description" | null>(null);
  const [editValue, setEditValue] = useState("");
  const [fileSrc, setFileSrc] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    if (detail?.asset.file_type === "image") {
      getAssetFilePath(assetId).then((path) => {
        setFileSrc(convertFileSrc(path));
      });
    }
  }, [assetId, detail]);

  if (!detail) return null;
  const { asset, tags } = detail;

  const handleSave = () => {
    if (editing === "name") {
      renameAsset.mutate({ id: asset.id, newName: editValue });
    } else if (editing === "description") {
      updateDesc.mutate({ id: asset.id, description: editValue });
    }
    setEditing(null);
  };

  const handleAiTag = async () => {
    setAiLoading(true);
    try {
      await aiTagAsset(asset.id);
      refetch();
    } catch (e) {
      console.error("AI tagging failed:", e);
    }
    setAiLoading(false);
  };

  const handleRemoveTag = (tagId: string) => {
    removeTags.mutate({ assetId: asset.id, tagIds: [tagId] });
  };

  return (
    <div className="w-80 h-full border-l border-border bg-bg-secondary flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border">
        <span className="text-sm font-medium truncate">Asset Detail</span>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-bg-tertiary text-text-secondary"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Preview */}
        {fileSrc && (
          <div className="pt-4 px-3 pb-3 border-b border-border">
            <img
              src={fileSrc}
              alt={asset.file_name}
              className="w-full rounded bg-bg-tertiary object-contain max-h-48"
            />
          </div>
        )}

        {/* Name */}
        <div className="p-3 border-b border-border">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-text-secondary">Name</span>
            <button
              onClick={() => {
                setEditing("name");
                setEditValue(asset.file_name);
              }}
              className="p-0.5 rounded hover:bg-bg-tertiary text-text-secondary"
            >
              <Edit2 size={12} />
            </button>
          </div>
          {editing === "name" ? (
            <div className="flex gap-1">
              <input
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="flex-1 px-2 py-1 text-sm bg-bg rounded border border-border focus:border-primary focus:outline-none"
                autoFocus
              />
              <button
                onClick={handleSave}
                className="p-1 rounded bg-primary text-white"
              >
                <Save size={14} />
              </button>
            </div>
          ) : (
            <div className="text-sm truncate">{asset.file_name}</div>
          )}
        </div>

        {/* Description */}
        <div className="p-3 border-b border-border">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-text-secondary">Description</span>
            <div className="flex gap-1">
              <button
                onClick={handleAiTag}
                disabled={aiLoading}
                className="p-0.5 rounded hover:bg-bg-tertiary text-text-secondary disabled:opacity-50"
                title="AI Auto-tag"
              >
                <Sparkles size={12} />
              </button>
              <button
                onClick={() => {
                  setEditing("description");
                  setEditValue(asset.description);
                }}
                className="p-0.5 rounded hover:bg-bg-tertiary text-text-secondary"
              >
                <Edit2 size={12} />
              </button>
            </div>
          </div>
          {editing === "description" ? (
            <div className="flex flex-col gap-1">
              <textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="w-full px-2 py-1 text-sm bg-bg rounded border border-border focus:border-primary focus:outline-none resize-none"
                rows={3}
                autoFocus
              />
              <button
                onClick={handleSave}
                className="self-end p-1 rounded bg-primary text-white"
              >
                <Save size={14} />
              </button>
            </div>
          ) : (
            <div className="text-sm text-text-secondary">
              {asset.description || "No description"}
            </div>
          )}
        </div>

        {/* Tags */}
        <div className="p-3 border-b border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-text-secondary">Tags</span>
            <TagIcon size={12} className="text-text-secondary" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span
                key={tag.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full border border-border"
                style={{ borderColor: tag.color, color: tag.color }}
              >
                {tag.name}
                <button
                  onClick={() => handleRemoveTag(tag.id)}
                  className="hover:opacity-70"
                >
                  <X size={10} />
                </button>
              </span>
            ))}
            {tags.length === 0 && (
              <span className="text-xs text-text-secondary">No tags</span>
            )}
          </div>
        </div>

        {/* Metadata */}
        <div className="p-3 space-y-2 text-xs text-text-secondary">
          <div className="flex justify-between">
            <span>Type</span>
            <span>{asset.mime_type}</span>
          </div>
          <div className="flex justify-between">
            <span>Size</span>
            <span>{(asset.file_size / 1024).toFixed(1)} KB</span>
          </div>
          {asset.width && asset.height && (
            <div className="flex justify-between">
              <span>Dimensions</span>
              <span>
                {asset.width} x {asset.height}
              </span>
            </div>
          )}
          <div className="flex justify-between">
            <span>Imported</span>
            <span>{new Date(asset.imported_at).toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
