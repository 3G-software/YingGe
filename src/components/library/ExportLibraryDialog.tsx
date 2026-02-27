import { useState } from "react";
import { useTranslation } from "react-i18next";
import { X, Download, Loader2 } from "lucide-react";
import { save } from "@tauri-apps/plugin-dialog";
import { useAppStore } from "../../stores/appStore";
import { exportLibrary, exportAllLibraries } from "../../services/tauriBridge";

interface ExportLibraryDialogProps {
  open: boolean;
  onClose: () => void;
}

export function ExportLibraryDialog({ open, onClose }: ExportLibraryDialogProps) {
  const { t } = useTranslation();
  const { currentLibrary } = useAppStore();
  const [exportMode, setExportMode] = useState<"current" | "all">("current");
  const [isExporting, setIsExporting] = useState(false);

  if (!open) return null;

  const handleExport = async () => {
    try {
      setIsExporting(true);

      const defaultFileName = exportMode === "current"
        ? `${currentLibrary?.name || "library"}_export.zip`
        : "all_libraries_export.zip";

      const outputPath = await save({
        defaultPath: defaultFileName,
        filters: [{
          name: "ZIP Archive",
          extensions: ["zip"],
        }],
      });

      if (!outputPath) {
        setIsExporting(false);
        return;
      }

      if (exportMode === "current") {
        if (!currentLibrary) {
          alert(t("export.noLibrarySelected", "请先选择一个资源库"));
          setIsExporting(false);
          return;
        }
        await exportLibrary(currentLibrary.id, outputPath);
      } else {
        await exportAllLibraries(outputPath);
      }

      alert(t("export.success", "导出成功！"));
      onClose();
    } catch (error) {
      console.error("Export failed:", error);
      alert(t("export.failed", `导出失败: ${error}`));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-bg rounded-lg shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-text-primary">
            {t("export.title", "导出资源库")}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-bg-tertiary text-text-secondary hover:text-text-primary transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              {t("export.mode", "导出模式")}
            </label>
            <div className="space-y-2">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  value="current"
                  checked={exportMode === "current"}
                  onChange={(e) => setExportMode(e.target.value as "current" | "all")}
                  className="text-primary focus:ring-primary"
                />
                <span className="text-sm text-text-primary">
                  {t("export.currentLibrary", "导出当前资源库")}
                  {currentLibrary && ` (${currentLibrary.name})`}
                </span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  value="all"
                  checked={exportMode === "all"}
                  onChange={(e) => setExportMode(e.target.value as "current" | "all")}
                  className="text-primary focus:ring-primary"
                />
                <span className="text-sm text-text-primary">
                  {t("export.allLibraries", "导出所有资源库")}
                </span>
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <button
              onClick={onClose}
              disabled={isExporting}
              className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-bg-tertiary transition-colors disabled:opacity-50"
            >
              {t("common.cancel", "取消")}
            </button>
            <button
              onClick={handleExport}
              disabled={isExporting || (exportMode === "current" && !currentLibrary)}
              className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isExporting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  {t("export.exporting", "导出中...")}
                </>
              ) : (
                <>
                  <Download size={16} />
                  {t("export.export", "导出")}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
