import { useState } from "react";
import { X, Trash2, FolderOpen, AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { useLibraries } from "../../hooks/useLibrary";
import { deleteLibraryWithFiles } from "../../services/tauriBridge";
import { useAppStore } from "../../stores/appStore";

interface LibraryManagementDialogProps {
  open: boolean;
  onClose: () => void;
}

export function LibraryManagementDialog({ open, onClose }: LibraryManagementDialogProps) {
  const { t } = useTranslation();
  const { data: libraries } = useLibraries();
  const { currentLibrary, setCurrentLibrary } = useAppStore();
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  if (!open) return null;

  const handleDelete = async (libraryId: string) => {
    setDeleting(true);

    // Check if this is the last library BEFORE deletion
    const isLastLibrary = libraries && libraries.length <= 1;

    try {
      await deleteLibraryWithFiles(libraryId);

      // If deleted library was current, clear selection
      if (currentLibrary?.id === libraryId) {
        setCurrentLibrary(null);
      }

      // Refresh libraries list
      await queryClient.invalidateQueries({ queryKey: ["libraries"], refetchType: "all" });
      setConfirmDelete(null);

      // If this was the last library, close the dialog
      if (isLastLibrary) {
        onClose();
      }
    } catch (e) {
      console.error("Failed to delete library:", e);
    }
    setDeleting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative rounded-lg shadow-xl w-full max-w-lg mx-4 border border-border" style={{ backgroundColor: "var(--color-bg-secondary, #1e1e1e)" }}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <FolderOpen size={20} className="text-primary" />
            <h2 className="text-lg font-semibold">{t("libraryMgmt.title")}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-bg-tertiary text-text-secondary"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 max-h-96 overflow-y-auto">
          {!libraries || libraries.length === 0 ? (
            <p className="text-sm text-text-secondary text-center py-4">
              {t("library.noLibraries")}
            </p>
          ) : (
            <div className="space-y-2">
              {libraries.map((lib) => (
                <div
                  key={lib.id}
                  className="p-3 rounded-lg border border-border bg-bg-primary"
                >
                  {confirmDelete === lib.id ? (
                    <div className="space-y-3">
                      <div className="flex items-start gap-2 text-red-400">
                        <AlertTriangle size={20} className="flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium">{t("libraryMgmt.confirmDelete")}</p>
                          <p className="text-xs mt-1">{t("libraryMgmt.deleteWarning")}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setConfirmDelete(null)}
                          disabled={deleting}
                          className="flex-1 px-3 py-1.5 text-sm rounded border border-border hover:bg-bg-tertiary transition-colors"
                        >
                          {t("common.cancel")}
                        </button>
                        <button
                          onClick={() => handleDelete(lib.id)}
                          disabled={deleting}
                          className="flex-1 px-3 py-1.5 text-sm bg-red-500 text-white rounded hover:bg-red-600 transition-colors disabled:opacity-50"
                        >
                          {deleting ? t("common.loading") : t("common.delete")}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{lib.name}</p>
                        <p className="text-xs text-text-secondary truncate">{lib.root_path}</p>
                      </div>
                      <button
                        onClick={() => setConfirmDelete(lib.id)}
                        className="p-2 rounded hover:bg-red-500/20 text-text-secondary hover:text-red-400 transition-colors"
                        title={t("common.delete")}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end p-4 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-bg-tertiary transition-colors"
          >
            {t("common.close")}
          </button>
        </div>
      </div>
    </div>
  );
}
