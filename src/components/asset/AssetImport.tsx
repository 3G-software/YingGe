import { useState } from "react";
import { Upload, X } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { useImportAssets } from "../../hooks/useAssets";
import { useAppStore } from "../../stores/appStore";

interface AssetImportProps {
  open: boolean;
  onClose: () => void;
}

export function AssetImport({ open: isOpen, onClose }: AssetImportProps) {
  const currentLibrary = useAppStore((s) => s.currentLibrary);
  const currentFolder = useAppStore((s) => s.currentFolder);
  const importAssets = useImportAssets();
  const [importing, setImporting] = useState(false);

  if (!isOpen) return null;

  const handleSelectFiles = async () => {
    const selected = await open({
      multiple: true,
      filters: [
        {
          name: "Assets",
          extensions: [
            "png", "jpg", "jpeg", "gif", "bmp", "webp", "svg", "tiff",
            "mp3", "wav", "ogg", "flac", "aac", "m4a",
            "mp4", "avi", "mov", "webm",
          ],
        },
      ],
    });

    if (selected && currentLibrary) {
      const paths = Array.isArray(selected) ? selected : [selected];
      setImporting(true);
      try {
        await importAssets.mutateAsync({
          libraryId: currentLibrary.id,
          filePaths: paths,
          folderPath: currentFolder,
        });
        onClose();
      } catch (e) {
        console.error("Import failed:", e);
      }
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-bg-secondary rounded-lg border border-border shadow-xl w-[480px]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-medium">Import Assets</h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-bg-tertiary text-text-secondary"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {!currentLibrary ? (
            <p className="text-center text-text-secondary">
              Please select a library first
            </p>
          ) : (
            <div
              onClick={handleSelectFiles}
              className="border-2 border-dashed border-border rounded-lg p-12 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors"
            >
              <Upload
                size={40}
                className="mx-auto mb-3 text-text-secondary"
              />
              <p className="text-sm text-text-primary mb-1">
                Click to select files
              </p>
              <p className="text-xs text-text-secondary">
                Supports images (PNG, JPG, GIF, WebP, SVG) and audio (MP3, WAV,
                OGG, FLAC)
              </p>
              {importing && (
                <p className="text-sm text-primary mt-3">Importing...</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border text-xs text-text-secondary">
          <span>
            Library: {currentLibrary?.name || "None"}
          </span>
          <span>Folder: {currentFolder}</span>
        </div>
      </div>
    </div>
  );
}
