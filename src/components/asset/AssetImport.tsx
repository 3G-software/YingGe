import { useState, useCallback, useEffect } from "react";
import { Upload, X, File, FolderOpen } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { useImportAssets } from "../../hooks/useAssets";
import { useAppStore } from "../../stores/appStore";
import { aiTagAsset, getAiConfig } from "../../services/tauriBridge";
import { useTranslation } from "react-i18next";
import { AiConfigHintDialog } from "../common/AiConfigHintDialog";
import type { AiConfig } from "../../types/asset";

interface AssetImportProps {
  open: boolean;
  onClose: () => void;
  onOpenSettings?: () => void;
}

const STORAGE_KEY_DONT_SHOW_AI_NOT_CONFIGURED = "yingge_dont_show_ai_not_configured";
const STORAGE_KEY_DONT_SHOW_AI_CONNECTION_FAILED = "yingge_dont_show_ai_connection_failed";

const SUPPORTED_EXTENSIONS = [
  "png", "jpg", "jpeg", "gif", "bmp", "webp", "svg", "tiff",
  "mp3", "wav", "ogg", "flac", "aac", "m4a",
  "mp4", "avi", "mov", "webm",
];

// Check if AI config is valid (has required fields)
function isAiConfigValid(config: AiConfig | null): boolean {
  if (!config) return false;
  return !!(config.api_key && config.api_key.trim() && config.api_endpoint && config.api_endpoint.trim());
}

export function AssetImport({ open: isOpen, onClose, onOpenSettings }: AssetImportProps) {
  const { t } = useTranslation();
  const currentLibrary = useAppStore((s) => s.currentLibrary);
  const currentFolder = useAppStore((s) => s.currentFolder);
  const importAssets = useImportAssets();
  const [importing, setImporting] = useState(false);
  const [showAiHint, setShowAiHint] = useState(false);
  const [aiHintMode, setAiHintMode] = useState<"not_configured" | "connection_failed">("not_configured");
  const [pendingPaths, setPendingPaths] = useState<string[] | null>(null);
  const [aiConfigValid, setAiConfigValid] = useState<boolean | null>(null);

  // Check AI config when dialog opens
  useEffect(() => {
    if (isOpen) {
      getAiConfig().then((config) => {
        setAiConfigValid(isAiConfigValid(config));
      }).catch(() => {
        setAiConfigValid(false);
      });
    }
  }, [isOpen]);

  const shouldShowAiHint = useCallback(() => {
    const dontShow = localStorage.getItem(STORAGE_KEY_DONT_SHOW_AI_NOT_CONFIGURED);
    return !dontShow && aiConfigValid === false;
  }, [aiConfigValid]);

  const doImport = useCallback(async (paths: string[]) => {
    if (!currentLibrary || paths.length === 0) return;

    setImporting(true);
    try {
      const importedAssets = await importAssets.mutateAsync({
        libraryId: currentLibrary.id,
        filePaths: paths,
        folderPath: currentFolder,
      });

      console.log(`[AssetImport] Import completed, ${importedAssets.length} assets imported`);

      // Close dialog first, then do AI tagging in background
      onClose();
      setImporting(false);

      // Auto-tag images with AI in background (only if configured)
      if (aiConfigValid) {
        const imageAssets = importedAssets.filter(asset => asset.file_type === 'image');
        if (imageAssets.length > 0) {
          console.log(`[AssetImport] Auto-tagging ${imageAssets.length} images with AI in background`);

          // Tag images in background and track failures
          let hasConnectionError = false;
          const dontShowConnectionFailed = localStorage.getItem(STORAGE_KEY_DONT_SHOW_AI_CONNECTION_FAILED);

          for (const asset of imageAssets) {
            try {
              console.log(`[AssetImport] Starting AI tagging for asset: ${asset.id}`);
              await aiTagAsset(asset.id);
              console.log(`[AssetImport] AI tagging completed for asset: ${asset.id}`);
            } catch (error) {
              console.error(`[AssetImport] AI tagging failed for asset ${asset.id}:`, error);
              // Check if it's a connection error
              if (!hasConnectionError && !dontShowConnectionFailed) {
                hasConnectionError = true;
                setAiHintMode("connection_failed");
                setShowAiHint(true);
              }
              // Continue with other images even if one fails
            }
          }
        }
      }
    } catch (e) {
      console.error("Import failed:", e);
      setImporting(false);
    }
  }, [currentLibrary, currentFolder, importAssets, onClose, aiConfigValid]);

  const handleDontShowAgain = useCallback(() => {
    if (aiHintMode === "not_configured") {
      localStorage.setItem(STORAGE_KEY_DONT_SHOW_AI_NOT_CONFIGURED, "true");
    } else {
      localStorage.setItem(STORAGE_KEY_DONT_SHOW_AI_CONNECTION_FAILED, "true");
    }
    setShowAiHint(false);
    if (pendingPaths) {
      doImport(pendingPaths);
      setPendingPaths(null);
    }
  }, [aiHintMode, pendingPaths, doImport]);

  const handleGoToSettings = useCallback(() => {
    setShowAiHint(false);
    setPendingPaths(null);
    onClose();
    onOpenSettings?.();
  }, [onClose, onOpenSettings]);

  const handleContinueImport = useCallback(() => {
    setShowAiHint(false);
    if (pendingPaths) {
      doImport(pendingPaths);
      setPendingPaths(null);
    }
  }, [pendingPaths, doImport]);

  const handleImportFiles = useCallback(async (paths: string[]) => {
    if (!currentLibrary || paths.length === 0) return;

    // Check if we should show AI hint
    if (shouldShowAiHint()) {
      setAiHintMode("not_configured");
      setPendingPaths(paths);
      setShowAiHint(true);
      return;
    }

    doImport(paths);
  }, [currentLibrary, shouldShowAiHint, doImport]);

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
    <>
      {/* AI Hint Dialog */}
      <AiConfigHintDialog
        open={showAiHint}
        mode={aiHintMode}
        onGoToSettings={handleGoToSettings}
        onContinue={handleContinueImport}
        onDontShowAgain={handleDontShowAgain}
      />

      {/* Main Import Dialog */}
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-bg-secondary rounded-lg border border-border shadow-xl w-[480px]">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h2 className="text-lg font-medium">{t("import.title")}</h2>
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
                {t("library.noLibraries")}
              </p>
            ) : (
              <>
                {/* Info */}
                <div className="border-2 border-dashed border-border rounded-lg p-8 text-center mb-4">
                  <Upload size={40} className="mx-auto mb-3 text-text-secondary" />
                  <p className="text-sm text-text-primary mb-1">
                    {t("import.selectFiles")} / {t("import.selectFolder")}
                  </p>
                  <p className="text-xs text-text-secondary">
                    {t("import.supported")}
                  </p>
                  <p className="text-xs text-text-secondary mt-2">
                    {t("import.dragDrop")}
                  </p>
                  {importing && (
                    <div className="flex items-center justify-center gap-2 mt-3">
                      <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      <span className="text-sm text-primary">{t("import.importing")}</span>
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
                    {t("import.selectFiles")}
                  </button>
                  <button
                    onClick={handleSelectFolder}
                    disabled={importing}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-bg-tertiary text-text-primary rounded-lg hover:bg-border transition-colors disabled:opacity-50"
                  >
                    <FolderOpen size={16} />
                    {t("import.selectFolder")}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-border text-xs text-text-secondary">
            <span>
              {t("library.title")}: {currentLibrary?.name || "None"}
            </span>
            <span>{t("import.targetFolder")}: {currentFolder}</span>
          </div>
        </div>
      </div>
    </>
  );
}
