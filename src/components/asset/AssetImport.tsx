import { useState, useCallback } from "react";
import { Upload, X, File, FolderOpen } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { useImportAssets } from "../../hooks/useAssets";
import { useAppStore } from "../../stores/appStore";
import { aiTagAsset } from "../../services/tauriBridge";

interface AssetImportProps {
  open: boolean;
  onClose: () => void;
}

const SUPPORTED_EXTENSIONS = [
  "png", "jpg", "jpeg", "gif", "bmp", "webp", "svg", "tiff",
  "mp3", "wav", "ogg", "flac", "aac", "m4a",
  "mp4", "avi", "mov", "webm",
];

export function AssetImport({ open: isOpen, onClose }: AssetImportProps) {
  const currentLibrary = useAppStore((s) => s.currentLibrary);
  const currentFolder = useAppStore((s) => s.currentFolder);
  const importAssets = useImportAssets();
  const [importing, setImporting] = useState(false);

  const handleImportFiles = useCallback(async (paths: string[]) => {
    if (!currentLibrary || paths.length === 0) return;

    setImporting(true);
    try {
      const importedAssets = await importAssets.mutateAsync({
        libraryId: currentLibrary.id,
        filePaths: paths,
        folderPath: currentFolder,
      });

      console.log(`[AssetImport] Import completed, ${importedAssets.length} assets imported`);

      // Auto-tag images with AI
      const imageAssets = importedAssets.filter(asset => asset.file_type === 'image');
      if (imageAssets.length > 0) {
        console.log(`[AssetImport] Auto-tagging ${imageAssets.length} images with AI`);

        // Tag each image asynchronously (don't wait for completion)
        imageAssets.forEach(async (asset) => {
          try {
            console.log(`[AssetImport] Starting AI tagging for asset: ${asset.id}`);
            await aiTagAsset(asset.id);
            console.log(`[AssetImport] AI tagging completed for asset: ${asset.id}`);
          } catch (error) {
            console.error(`[AssetImport] AI tagging failed for asset ${asset.id}:`, error);
          }
        });
      }

      onClose();
    } catch (e) {
      console.error("Import failed:", e);
    }
    setImporting(false);
  }, [currentLibrary, currentFolder, importAssets, onClose]);

  if (!isOpen) return null;

  const handleSelectFiles = async () => {
    const selected = await open({
      multiple: true,
      directory: false,
      filters: [
        {
          name: "Assets",
          extensions: SUPPORTED_EXTENSIONS,
        },
      ],
    });

    if (selected) {
      const paths = Array.isArray(selected) ? selected : [selected];
      handleImportFiles(paths);
    }
  };

  const handleSelectFolder = async () => {
    const selected = await open({
      multiple: false,
      directory: true,
    });

    if (selected) {
      const paths = Array.isArray(selected) ? selected : [selected];
      handleImportFiles(paths);
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
            <>
              {/* Info */}
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center mb-4">
                <Upload size={40} className="mx-auto mb-3 text-text-secondary" />
                <p className="text-sm text-text-primary mb-1">
                  Select files or folder to import
                </p>
                <p className="text-xs text-text-secondary">
                  Supports images, audio, and video files
                </p>
                <p className="text-xs text-text-secondary mt-2">
                  Or drag and drop files directly onto the main window
                </p>
                {importing && (
                  <div className="flex items-center justify-center gap-2 mt-3">
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm text-primary">Importing...</span>
                  </div>
                )}
              </div>

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleSelectFiles}
                  disabled={importing}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50"
                >
                  <File size={16} />
                  Select Files
                </button>
                <button
                  onClick={handleSelectFolder}
                  disabled={importing}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-bg-tertiary text-text-primary rounded-lg hover:bg-border transition-colors disabled:opacity-50"
                >
                  <FolderOpen size={16} />
                  Select Folder
                </button>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border text-xs text-text-secondary">
          <span>
            Library: {currentLibrary?.name || "None"}
          </span>
          <span>Target folder: {currentFolder}</span>
        </div>
      </div>
    </div>
  );
}
