import { useCallback, useState, useEffect } from "react";
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

  const handleImportFiles = useCallback(async (paths: string[]) => {
    if (!currentLibrary || paths.length === 0 || importing) return;

    setImporting(true);
    try {
      await importAssets.mutateAsync({
        libraryId: currentLibrary.id,
        filePaths: paths,
        folderPath: currentFolder,
      });
    } catch (e) {
      console.error("Import failed:", e);
    }
    setImporting(false);
  }, [currentLibrary, currentFolder, importAssets, importing]);

  useEffect(() => {
    if (!currentLibrary) return;

    let unlisten: (() => void) | undefined;

    getCurrentWebview().onDragDropEvent((event) => {
      if (event.payload.type === "enter" || event.payload.type === "over") {
        setIsDragOver(true);
      } else if (event.payload.type === "leave") {
        setIsDragOver(false);
      } else if (event.payload.type === "drop") {
        setIsDragOver(false);
        if (event.payload.paths && event.payload.paths.length > 0) {
          handleImportFiles(event.payload.paths);
        }
      }
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      unlisten?.();
    };
  }, [currentLibrary, handleImportFiles]);

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
