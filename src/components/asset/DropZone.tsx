import { useState, useEffect, useRef, useCallback } from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { Upload } from "lucide-react";
import { useImportAssets } from "../../hooks/useAssets";
import { useAppStore } from "../../stores/appStore";
import { aiTagAsset, getAiConfig, moveAssets } from "../../services/tauriBridge";
import { AiConfigHintDialog } from "../common/AiConfigHintDialog";
import type { AiConfig } from "../../types/asset";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

const STORAGE_KEY_DONT_SHOW_AI_NOT_CONFIGURED = "yingge_dont_show_ai_not_configured";
const STORAGE_KEY_DONT_SHOW_AI_CONNECTION_FAILED = "yingge_dont_show_ai_connection_failed";

interface DropZoneProps {
  children: React.ReactNode;
  onOpenSettings?: () => void;
}

// Global flag to prevent multiple simultaneous imports across all instances
let globalImportInProgress = false;

// Store the unlisten function globally
let globalUnlisten: (() => void) | null = null;

// Check if AI config is valid (has required fields)
function isAiConfigValid(config: AiConfig | null): boolean {
  if (!config) return false;
  return !!(config.api_key && config.api_key.trim() && config.api_endpoint && config.api_endpoint.trim());
}

export function DropZone({ children, onOpenSettings }: DropZoneProps) {
  const { i18n } = useTranslation();
  const currentLibrary = useAppStore((s) => s.currentLibrary);
  const currentFolder = useAppStore((s) => s.currentFolder);
  const importAssets = useImportAssets();
  const queryClient = useQueryClient();
  const [importing, setImporting] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showAiHint, setShowAiHint] = useState(false);
  const [aiHintMode, setAiHintMode] = useState<"not_configured" | "connection_failed">("not_configured");
  const [pendingPaths, setPendingPaths] = useState<string[] | null>(null);
  const [aiConfigValid, setAiConfigValid] = useState<boolean | null>(null);
  const mousePositionRef = useRef({ x: 0, y: 0 });

  // Check AI config on mount
  useEffect(() => {
    getAiConfig().then((config) => {
      setAiConfigValid(isAiConfigValid(config));
    }).catch(() => {
      setAiConfigValid(false);
    });
  }, []);

  const shouldShowAiHint = useCallback(() => {
    const dontShow = localStorage.getItem(STORAGE_KEY_DONT_SHOW_AI_NOT_CONFIGURED);
    return !dontShow && aiConfigValid === false;
  }, [aiConfigValid]);

  const doImport = useCallback(async (paths: string[]) => {
    const { currentLibrary, currentFolder, importAssets } = importStateRef.current;
    if (!currentLibrary || paths.length === 0) return;

    setImporting(true);
    try {
      const result = await importAssets.mutateAsync({
        libraryId: currentLibrary.id,
        filePaths: paths,
        folderPath: currentFolder,
      });

      const importedAssets = result.imported_assets;
      const skippedFiles = result.skipped_files;

      console.log(`[DropZone] Import completed, ${importedAssets.length} assets imported, ${skippedFiles.length} files skipped`);

      // Show notification for skipped files
      if (skippedFiles.length > 0) {
        const fileList = skippedFiles.slice(0, 5).join(', ');
        const more = skippedFiles.length > 5 ? ` and ${skippedFiles.length - 5} more` : '';
        alert(`Skipped ${skippedFiles.length} unsupported file(s): ${fileList}${more}`);
      }

      // Reset flags and hide importing indicator first
      globalImportInProgress = false;
      setImporting(false);

      // Auto-tag images with AI in background (only if configured)
      if (aiConfigValid) {
        const imageAssets = importedAssets.filter(asset => asset.file_type === 'image');
        if (imageAssets.length > 0) {
          console.log(`[DropZone] Auto-tagging ${imageAssets.length} images with AI in background`);

          // Tag images in background and track failures
          let hasConnectionError = false;
          const dontShowConnectionFailed = localStorage.getItem(STORAGE_KEY_DONT_SHOW_AI_CONNECTION_FAILED);

          for (const asset of imageAssets) {
            try {
              console.log(`[DropZone] Starting AI tagging for asset: ${asset.id}`);
              await aiTagAsset(asset.id, i18n.language);
              console.log(`[DropZone] AI tagging completed for asset: ${asset.id}`);
              // Invalidate asset detail query to refresh UI if this asset is currently selected
              queryClient.invalidateQueries({ queryKey: ['asset-detail', asset.id] });
            } catch (error) {
              console.error(`[DropZone] AI tagging failed for asset ${asset.id}:`, error);
              // Check if it's a connection error
              if (!hasConnectionError && !dontShowConnectionFailed) {
                hasConnectionError = true;
                setAiHintMode("connection_failed");
                setShowAiHint(true);
              }
            }
          }
        }
      }
    } catch (e) {
      console.error(`[DropZone] Import failed:`, e);
      globalImportInProgress = false;
      setImporting(false);
    }
  }, [aiConfigValid, i18n.language]);

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
    globalImportInProgress = false;
    onOpenSettings?.();
  }, [onOpenSettings]);

  const handleContinueImport = useCallback(() => {
    setShowAiHint(false);
    if (pendingPaths) {
      doImport(pendingPaths);
      setPendingPaths(null);
    }
  }, [pendingPaths, doImport]);

  // Use ref to store the latest values without triggering effect re-runs
  const importStateRef = useRef({ currentLibrary, currentFolder, importAssets, shouldShowAiHint, doImport });

  // Update ref whenever values change
  useEffect(() => {
    importStateRef.current = { currentLibrary, currentFolder, importAssets, shouldShowAiHint, doImport };
  }, [currentLibrary, currentFolder, importAssets, shouldShowAiHint, doImport]);

  // Track mouse position
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mousePositionRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Register drag drop listener only once on mount
  useEffect(() => {
    const componentId = Math.random().toString(36).substring(7);
    console.log(`[DropZone ${componentId}] Component mounted`);

    // Clean up any existing listener first
    if (globalUnlisten) {
      console.log(`[DropZone ${componentId}] Cleaning up existing listener`);
      globalUnlisten();
      globalUnlisten = null;
    }

    console.log(`[DropZone ${componentId}] Registering drag drop listener`);

    // Use async function to properly handle the promise
    const setupListener = async () => {
      const unlisten = await getCurrentWebview().onDragDropEvent((event) => {
        console.log(`[DropZone] Drag drop event:`, event.payload.type);

        if (event.payload.type === "enter" || event.payload.type === "over") {
          setIsDragOver(true);
        } else if (event.payload.type === "leave") {
          setIsDragOver(false);
        } else if (event.payload.type === "drop") {
          setIsDragOver(false);

          // Check if this is an internal drag (asset movement)
          const draggedAssetIds = (window as any).__draggedAssetIds;

          if (draggedAssetIds && Array.isArray(draggedAssetIds) && draggedAssetIds.length > 0) {
            // Internal drag: move assets to folder under mouse
            const elements = document.elementsFromPoint(mousePositionRef.current.x, mousePositionRef.current.y);
            let targetFolder: string | null = null;

            // Look for folder elements with data-folder-path attribute
            for (const el of elements) {
              const folderPath = el.getAttribute('data-folder-path');
              if (folderPath !== null) {
                targetFolder = folderPath;
                break;
              }
            }

            if (targetFolder !== null) {
              // Move assets to the target folder
              moveAssets(draggedAssetIds, targetFolder)
                .then(() => {
                  queryClient.invalidateQueries({ queryKey: ["assets"], refetchType: "all" });
                  queryClient.invalidateQueries({ queryKey: ["folders"], refetchType: "all" });
                  queryClient.invalidateQueries({ queryKey: ["root-assets-count"], refetchType: "all" });
                })
                .catch((error) => {
                  console.error('[DropZone] Failed to move assets:', error);
                  alert(`移动资源失败: ${error}`);
                });
            }

            // Clear the dragged asset IDs
            (window as any).__draggedAssetIds = null;
            return;
          }

          // External drag: import files
          // Atomic check-and-set: if already importing, bail out immediately
          if (globalImportInProgress) {
            console.log(`[DropZone] Import already in progress, ignoring drop event`);
            return;
          }

          // Set flag immediately before any other checks
          globalImportInProgress = true;

          const { currentLibrary, shouldShowAiHint, doImport } = importStateRef.current;

          // Check if we can import
          if (!currentLibrary) {
            console.log(`[DropZone] Cannot import: no library selected`);
            globalImportInProgress = false; // Reset flag
            return;
          }

          if (event.payload.paths && event.payload.paths.length > 0) {
            console.log(`[DropZone] Starting import with paths:`, event.payload.paths);

            // Check if we should show AI hint
            if (shouldShowAiHint()) {
              setAiHintMode("not_configured");
              setPendingPaths(event.payload.paths);
              setShowAiHint(true);
              return;
            }

            doImport(event.payload.paths);
          } else {
            // No paths to import, reset flag
            console.log(`[DropZone] No paths to import, resetting flag`);
            globalImportInProgress = false;
          }
        }
      });

      globalUnlisten = unlisten;
      console.log(`[DropZone ${componentId}] Listener registered successfully`);
    };

    setupListener();

    return () => {
      console.log(`[DropZone ${componentId}] Component unmounting, cleaning up listener`);
      if (globalUnlisten) {
        globalUnlisten();
        globalUnlisten = null;
      }
    };
  }, []); // Empty dependency array - only run once on mount

  // Don't show overlay if no library selected
  if (!currentLibrary) {
    return <>{children}</>;
  }

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

      <div className="relative flex-1 flex flex-col overflow-hidden">
        {children}

        {/* Drop overlay */}
        {isDragOver && (
          <div className="absolute inset-0 z-40 bg-bg-primary/90 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
                <Upload size={40} className="text-primary" />
              </div>
              <p className="text-lg font-medium text-text-primary mb-1">
                Drop files to import
              </p>
              <p className="text-sm text-text-secondary">
                Files will be imported to: {currentFolder}
              </p>
            </div>
          </div>
        )}

        {/* Importing indicator */}
        {importing && (
          <div className="absolute bottom-4 right-4 z-40 bg-bg-secondary border border-border rounded-lg px-4 py-2 shadow-lg flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Importing files...</span>
          </div>
        )}
      </div>
    </>
  );
}
