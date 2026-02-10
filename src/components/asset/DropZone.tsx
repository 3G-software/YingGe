import { useState, useEffect, useRef } from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { Upload } from "lucide-react";
import { useImportAssets } from "../../hooks/useAssets";
import { useAppStore } from "../../stores/appStore";

interface DropZoneProps {
  children: React.ReactNode;
}

export function DropZone({ children }: DropZoneProps) {
  const currentLibrary = useAppStore((s) => s.currentLibrary);
  const currentFolder = useAppStore((s) => s.currentFolder);
  const importAssets = useImportAssets();
  const [importing, setImporting] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // Use ref to store the latest values without triggering effect re-runs
  const importStateRef = useRef({ currentLibrary, currentFolder, importAssets });
  // Use a separate ref to track if import is in progress (more reliable than state)
  const isImportingRef = useRef(false);

  // Update ref whenever values change
  useEffect(() => {
    importStateRef.current = { currentLibrary, currentFolder, importAssets };
  }, [currentLibrary, currentFolder, importAssets]);

  // Register drag drop listener only once on mount
  useEffect(() => {
    console.log("[DropZone] Registering drag drop listener (mount)");
    let unlisten: (() => void) | undefined;
    let isMounted = true;

    // Use async function to properly handle the promise
    const setupListener = async () => {
      unlisten = await getCurrentWebview().onDragDropEvent((event) => {
        console.log("[DropZone] Drag drop event:", event.payload.type);

        if (event.payload.type === "enter" || event.payload.type === "over") {
          setIsDragOver(true);
        } else if (event.payload.type === "leave") {
          setIsDragOver(false);
        } else if (event.payload.type === "drop") {
          setIsDragOver(false);

          const { currentLibrary, currentFolder, importAssets } = importStateRef.current;

          // Check if we can import using ref (more reliable than state)
          if (!currentLibrary || isImportingRef.current) {
            console.log("[DropZone] Cannot import: no library or already importing");
            return;
          }

          if (event.payload.paths && event.payload.paths.length > 0) {
            console.log("[DropZone] Starting import with paths:", event.payload.paths);

            // Set importing flag immediately in ref
            isImportingRef.current = true;
            setImporting(true);

            importAssets.mutateAsync({
              libraryId: currentLibrary.id,
              filePaths: event.payload.paths,
              folderPath: currentFolder,
            }).then(() => {
              console.log("[DropZone] Import completed");
              isImportingRef.current = false;
              setImporting(false);
            }).catch((e) => {
              console.error("[DropZone] Import failed:", e);
              isImportingRef.current = false;
              setImporting(false);
            });
          }
        }
      });
    };

    setupListener();

    return () => {
      console.log("[DropZone] Unregistering drag drop listener (unmount)");
      isMounted = false;
      unlisten?.();
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
