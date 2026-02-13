import { useState, useEffect, useRef } from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { Upload } from "lucide-react";
import { useImportAssets } from "../../hooks/useAssets";
import { useAppStore } from "../../stores/appStore";
import { aiTagAsset } from "../../services/tauriBridge";

interface DropZoneProps {
  children: React.ReactNode;
}

// Global flag to prevent multiple simultaneous imports across all instances
let globalImportInProgress = false;

// Global flag to ensure only one listener is registered
let globalListenerRegistered = false;
let globalUnlisten: (() => void) | undefined;

export function DropZone({ children }: DropZoneProps) {
  const currentLibrary = useAppStore((s) => s.currentLibrary);
  const currentFolder = useAppStore((s) => s.currentFolder);
  const importAssets = useImportAssets();
  const [importing, setImporting] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // Use ref to store the latest values without triggering effect re-runs
  const importStateRef = useRef({ currentLibrary, currentFolder, importAssets });

  // Update ref whenever values change
  useEffect(() => {
    importStateRef.current = { currentLibrary, currentFolder, importAssets };
  }, [currentLibrary, currentFolder, importAssets]);

  // Register drag drop listener only once on mount
  useEffect(() => {
    const componentId = Math.random().toString(36).substring(7);
    console.log(`[DropZone ${componentId}] Component mounted`);

    // Check if listener is already registered globally
    if (globalListenerRegistered) {
      console.log(`[DropZone ${componentId}] Listener already registered globally, skipping`);
      return;
    }

    console.log(`[DropZone ${componentId}] Registering drag drop listener`);
    globalListenerRegistered = true;

    // Use async function to properly handle the promise
    const setupListener = async () => {
      globalUnlisten = await getCurrentWebview().onDragDropEvent((event) => {
        console.log(`[DropZone] Drag drop event:`, event.payload.type);

        if (event.payload.type === "enter" || event.payload.type === "over") {
          setIsDragOver(true);
        } else if (event.payload.type === "leave") {
          setIsDragOver(false);
        } else if (event.payload.type === "drop") {
          setIsDragOver(false);

          // Atomic check-and-set: if already importing, bail out immediately
          if (globalImportInProgress) {
            console.log(`[DropZone] Import already in progress, ignoring drop event`);
            return;
          }

          // Set flag immediately before any other checks
          globalImportInProgress = true;

          const { currentLibrary, currentFolder, importAssets } = importStateRef.current;

          // Check if we can import
          if (!currentLibrary) {
            console.log(`[DropZone] Cannot import: no library selected`);
            globalImportInProgress = false; // Reset flag
            return;
          }

          if (event.payload.paths && event.payload.paths.length > 0) {
            console.log(`[DropZone] Starting import with paths:`, event.payload.paths);
            setImporting(true);

            importAssets.mutateAsync({
              libraryId: currentLibrary.id,
              filePaths: event.payload.paths,
              folderPath: currentFolder,
            }).then((importedAssets) => {
              console.log(`[DropZone] Import completed, ${importedAssets.length} assets imported`);

              // Auto-tag images with AI
              const imageAssets = importedAssets.filter(asset => asset.file_type === 'image');
              if (imageAssets.length > 0) {
                console.log(`[DropZone] Auto-tagging ${imageAssets.length} images with AI`);

                // Tag each image asynchronously (don't wait for completion)
                imageAssets.forEach(async (asset) => {
                  try {
                    console.log(`[DropZone] Starting AI tagging for asset: ${asset.id}`);
                    await aiTagAsset(asset.id);
                    console.log(`[DropZone] AI tagging completed for asset: ${asset.id}`);
                  } catch (error) {
                    console.error(`[DropZone] AI tagging failed for asset ${asset.id}:`, error);
                  }
                });
              }

              globalImportInProgress = false;
              setImporting(false);
            }).catch((e) => {
              console.error(`[DropZone] Import failed:`, e);
              globalImportInProgress = false;
              setImporting(false);
            });
          } else {
            // No paths to import, reset flag
            console.log(`[DropZone] No paths to import, resetting flag`);
            globalImportInProgress = false;
          }
        }
      });
    };

    setupListener();

    return () => {
      console.log(`[DropZone ${componentId}] Component unmounting`);
      // Don't unregister the global listener on unmount
      // It will be cleaned up when the app closes
    };
  }, []); // Empty dependency array - only run once on mount

  // Don't show overlay if no library selected
  if (!currentLibrary) {
    return <>{children}</>;
  }

  return (
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
  );
}
