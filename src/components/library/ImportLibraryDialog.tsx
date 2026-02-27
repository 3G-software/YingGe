import { useState } from "react";
import { useTranslation } from "react-i18next";
import { X, Upload, Loader2, AlertCircle } from "lucide-react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { useQueryClient } from "@tanstack/react-query";
import {
  checkImportLibrary,
  importLibrary,
  type ImportCheckResult,
} from "../../services/tauriBridge";

interface ImportLibraryDialogProps {
  open: boolean;
  onClose: () => void;
}

export function ImportLibraryDialog({ open, onClose }: ImportLibraryDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [checkResult, setCheckResult] = useState<ImportCheckResult | null>(null);
  const [mergeMode, setMergeMode] = useState<"replace" | "skip">("skip");
  const [targetPath, setTargetPath] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  if (!open) return null;

  const handleSelectFile = async () => {
    console.log("[ImportLibraryDialog] handleSelectFile called");
    try {
      const selected = await openDialog({
        multiple: false,
        directory: false,
        filters: [{
          name: "ZIP Archive",
          extensions: ["zip"],
        }],
      });

      console.log("[ImportLibraryDialog] Selected file:", selected);

      if (!selected) return;

      const filePath = typeof selected === "string" ? selected : selected[0];
      console.log("[ImportLibraryDialog] File path:", filePath);

      if (filePath) {
        setSelectedFile(filePath);
        setCheckResult(null);

        // Auto-check the file
        setIsChecking(true);
        try {
          const result = await checkImportLibrary(filePath);
          console.log("[ImportLibraryDialog] Check result:", result);
          setCheckResult(result);
        } catch (error) {
          console.error("Check failed:", error);
          alert(t("import.checkFailed", `检查文件失败: ${error}`));
        } finally {
          setIsChecking(false);
        }
      }
    } catch (error) {
      console.error("File selection failed:", error);
      alert(t("import.selectFileFailed", `选择文件失败: ${error}`));
    }
  };

  const handleSelectTargetPath = async () => {
    try {
      const selected = await openDialog({
        multiple: false,
        directory: true,
      });

      if (!selected) return;

      const dirPath = typeof selected === "string" ? selected : selected[0];
      if (dirPath) {
        setTargetPath(dirPath);
      }
    } catch (error) {
      console.error("Directory selection failed:", error);
      alert(t("import.selectDirFailed", `选择目录失败: ${error}`));
    }
  };

  const handleImport = async () => {
    if (!selectedFile || !targetPath) {
      alert(t("import.missingInfo", "请选择导入文件和目标路径"));
      return;
    }

    console.log("[ImportLibraryDialog] Starting import:", { selectedFile, targetPath, mergeMode });

    try {
      setIsImporting(true);
      const result = await importLibrary(selectedFile, targetPath, mergeMode);
      console.log("[ImportLibraryDialog] Import result:", result);

      // Wait a bit for database operations to complete
      await new Promise(resolve => setTimeout(resolve, 500));

      // Refresh all queries to update UI
      await queryClient.invalidateQueries({ queryKey: ["libraries"], refetchType: "all" });
      await queryClient.invalidateQueries({ queryKey: ["assets"], refetchType: "all" });
      await queryClient.invalidateQueries({ queryKey: ["folders"], refetchType: "all" });
      await queryClient.invalidateQueries({ queryKey: ["root-assets-count"], refetchType: "all" });

      // Force refetch to ensure UI updates
      await queryClient.refetchQueries({ queryKey: ["folders"] });
      await queryClient.refetchQueries({ queryKey: ["root-assets-count"] });

      alert(t("import.success", "导入成功！"));
      onClose();

      // Reset state
      setSelectedFile(null);
      setCheckResult(null);
      setTargetPath("");
      setMergeMode("skip");
    } catch (error) {
      console.error("Import failed:", error);
      alert(t("import.failed", `导入失败: ${error}`));
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setCheckResult(null);
    setTargetPath("");
    setMergeMode("skip");
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-bg rounded-lg shadow-xl w-full max-w-2xl p-6 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-text-primary">
            {t("import.title", "导入资源库")}
          </h2>
          <button
            onClick={handleClose}
            className="p-1 rounded hover:bg-bg-tertiary text-text-secondary hover:text-text-primary transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          {/* File Selection */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              {t("import.selectFile", "选择导入文件")}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={selectedFile || ""}
                readOnly
                placeholder={t("import.noFileSelected", "未选择文件")}
                className="flex-1 px-3 py-2 text-sm bg-bg-secondary rounded border border-border focus:outline-none"
              />
              <button
                onClick={handleSelectFile}
                disabled={isChecking || isImporting}
                className="px-4 py-2 text-sm bg-primary text-white rounded hover:bg-primary-hover transition-colors disabled:opacity-50"
              >
                {t("import.browse", "浏览")}
              </button>
            </div>
          </div>

          {/* Check Result */}
          {isChecking && (
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <Loader2 size={16} className="animate-spin" />
              {t("import.checking", "检查文件中...")}
            </div>
          )}

          {checkResult && (
            <div className="p-4 bg-bg-secondary rounded border border-border space-y-2">
              <div className="text-sm">
                <span className="font-medium text-text-primary">
                  {t("import.libraryName", "资源库名称")}:
                </span>{" "}
                <span className="text-text-secondary">{checkResult.library_name}</span>
              </div>
              <div className="text-sm">
                <span className="font-medium text-text-primary">
                  {t("import.totalAssets", "资源总数")}:
                </span>{" "}
                <span className="text-text-secondary">{checkResult.total_assets}</span>
              </div>

              {checkResult.has_duplicates && (
                <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded">
                  <div className="flex items-start gap-2">
                    <AlertCircle size={16} className="text-yellow-500 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-yellow-500 mb-1">
                        {t("import.duplicatesFound", "发现重复资源")}
                      </div>
                      <div className="text-xs text-text-secondary">
                        {t("import.duplicateCount", `共 ${checkResult.duplicate_assets.length} 个重复资源`)}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Target Path */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              {t("import.targetPath", "目标路径")}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={targetPath}
                readOnly
                placeholder={t("import.selectTargetPath", "选择资源库存储路径")}
                className="flex-1 px-3 py-2 text-sm bg-bg-secondary rounded border border-border focus:outline-none"
              />
              <button
                onClick={handleSelectTargetPath}
                disabled={isImporting}
                className="px-4 py-2 text-sm bg-primary text-white rounded hover:bg-primary-hover transition-colors disabled:opacity-50"
              >
                {t("import.browse", "浏览")}
              </button>
            </div>
          </div>

          {/* Merge Mode */}
          {checkResult?.has_duplicates && (
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                {t("import.mergeMode", "重复处理方式")}
              </label>
              <div className="space-y-2">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    value="skip"
                    checked={mergeMode === "skip"}
                    onChange={(e) => setMergeMode(e.target.value as "replace" | "skip")}
                    className="text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-text-primary">
                    {t("import.skipDuplicates", "跳过重复资源")}
                  </span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    value="replace"
                    checked={mergeMode === "replace"}
                    onChange={(e) => setMergeMode(e.target.value as "replace" | "skip")}
                    className="text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-text-primary">
                    {t("import.replaceDuplicates", "替换重复资源")}
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <button
              onClick={handleClose}
              disabled={isImporting}
              className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-bg-tertiary transition-colors disabled:opacity-50"
            >
              {t("common.cancel", "取消")}
            </button>
            <button
              onClick={handleImport}
              disabled={!selectedFile || !targetPath || isImporting}
              className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isImporting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  {t("import.importing", "导入中...")}
                </>
              ) : (
                <>
                  <Upload size={16} />
                  {t("import.import", "导入")}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
