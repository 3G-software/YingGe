import { useState } from "react";
import { X, Eraser } from "lucide-react";
import { useTranslation } from "react-i18next";
import { removeBackground } from "../../services/tauriBridge";
import { useQueryClient } from "@tanstack/react-query";

interface RemoveBackgroundDialogProps {
  open: boolean;
  assetId: string | null;
  onClose: () => void;
}

export function RemoveBackgroundDialog({ open, assetId, onClose }: RemoveBackgroundDialogProps) {
  const { t } = useTranslation();
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    errorMessage?: string;
  } | null>(null);
  const queryClient = useQueryClient();

  if (!open) return null;

  const handleRemove = async () => {
    if (!assetId) return;

    setProcessing(true);
    setResult(null);

    try {
      await removeBackground(assetId);

      setResult({
        success: true,
      });

      // Refresh assets list
      await queryClient.invalidateQueries({ queryKey: ["assets"], refetchType: "all" });
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      setResult({
        success: false,
        errorMessage: errorMsg,
      });
    }

    setProcessing(false);
  };

  const handleClose = () => {
    setResult(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />
      <div className="relative rounded-lg shadow-xl w-full max-w-md mx-4 border border-border" style={{ backgroundColor: "var(--color-bg-secondary, #1e1e1e)" }}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Eraser size={20} className="text-primary" />
            <h2 className="text-lg font-semibold">{t("removeBackground.title")}</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-1 rounded hover:bg-bg-tertiary text-text-secondary"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Info */}
          <div className="text-sm text-text-secondary">
            {assetId ? (
              t("removeBackground.description")
            ) : (
              t("removeBackground.selectAsset")
            )}
          </div>

          {/* Algorithm Info */}
          <div className="p-3 rounded-lg bg-bg-tertiary border border-border">
            <p className="text-xs text-text-secondary">
              {t("removeBackground.algorithmInfo")}
            </p>
          </div>

          {/* Results */}
          {result && (
            <div className={`p-3 rounded-lg border ${result.success ? "border-green-500/50 bg-green-500/10" : "border-red-500/50 bg-red-500/10"}`}>
              <p className={`text-sm font-medium mb-1 ${result.success ? "text-green-500" : "text-red-500"}`}>
                {result.success ? t("removeBackground.success") : t("common.error")}
              </p>
              {result.success && (
                <p className="text-sm text-text-secondary">
                  {t("removeBackground.successMessage")}
                </p>
              )}
              {result.errorMessage && (
                <p className="text-sm text-red-400 mt-2 break-all">
                  {t("common.error")}: {result.errorMessage}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t border-border">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-bg-tertiary transition-colors"
            disabled={processing}
          >
            {result ? t("common.close") : t("common.cancel")}
          </button>
          {!result && (
            <button
              onClick={handleRemove}
              disabled={!assetId || processing}
              className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {processing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {t("removeBackground.processing")}
                </>
              ) : (
                <>
                  <Eraser size={16} />
                  {t("removeBackground.remove")}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
