import { useState } from "react";
import { X, Minimize2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { compressImage } from "../../services/tauriBridge";
import { useQueryClient } from "@tanstack/react-query";

interface CompressDialogProps {
  open: boolean;
  assetIds: string[];
  onClose: () => void;
}

export function CompressDialog({ open, assetIds, onClose }: CompressDialogProps) {
  const { t, i18n } = useTranslation();
  const [quality, setQuality] = useState(80);
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState<{
    success: number;
    failed: number;
    totalReduction: number;
    errorMessage?: string;
  } | null>(null);
  const queryClient = useQueryClient();

  console.log("[CompressDialog] Render, open:", open, "assetIds:", assetIds);

  if (!open) {
    console.log("[CompressDialog] Not open, returning null");
    return null;
  }

  console.log("[CompressDialog] Dialog is open, rendering content");

  const getSuffix = () => {
    return i18n.language === "zh" ? "_压缩" : "_compressed";
  };

  const handleCompress = async () => {
    console.log("[CompressDialog] handleCompress called, assetIds:", assetIds);
    if (assetIds.length === 0) {
      console.log("[CompressDialog] No assets selected, returning");
      return;
    }

    setProcessing(true);
    setResults(null);

    let success = 0;
    let failed = 0;
    let totalReduction = 0;
    let lastError = "";

    for (const assetId of assetIds) {
      try {
        console.log("[CompressDialog] Compressing asset:", assetId, "quality:", quality, "suffix:", getSuffix());
        const res = await compressImage({
          assetId,
          quality,
          outputFormat: "jpeg",
          suffix: getSuffix(),
        });
        console.log("[CompressDialog] Compress success:", res);
        success++;
        totalReduction += res.compression_ratio;
      } catch (e: unknown) {
        const errorMsg = e instanceof Error ? e.message : String(e);
        console.error("[CompressDialog] Compress failed for asset:", assetId, "error:", errorMsg);
        lastError = errorMsg;
        failed++;
      }
    }

    setResults({
      success,
      failed,
      totalReduction: success > 0 ? totalReduction / success : 0,
      errorMessage: failed > 0 ? lastError : undefined,
    });

    // Refresh assets list
    await queryClient.invalidateQueries({ queryKey: ["assets"], refetchType: "all" });
    setProcessing(false);
  };

  const handleClose = () => {
    setResults(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />
      <div className="relative rounded-lg shadow-xl w-full max-w-md mx-4 border border-border" style={{ backgroundColor: "var(--color-bg-secondary, #1e1e1e)" }}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Minimize2 size={20} className="text-primary" />
            <h2 className="text-lg font-semibold">{t("tools.compressImage")}</h2>
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
          {/* Selected count */}
          <div className="text-sm text-text-secondary">
            {assetIds.length === 0 ? (
              t("compress.selectAsset")
            ) : (
              <>
                {assetIds.length} {t("compress.assetsSelected")}
              </>
            )}
          </div>

          {/* Quality slider */}
          <div>
            <label className="block text-sm font-medium mb-2">
              {t("compress.quality")} ({quality}%)
            </label>
            <input
              type="range"
              min="10"
              max="100"
              value={quality}
              onChange={(e) => setQuality(parseInt(e.target.value))}
              className="w-full"
              disabled={processing}
            />
            <div className="flex justify-between text-xs text-text-secondary mt-1">
              <span>{t("compress.smaller")}</span>
              <span>{t("compress.better")}</span>
            </div>
          </div>

          {/* Results */}
          {results && (
            <div className={`p-3 rounded-lg border ${results.failed > 0 && results.success === 0 ? "border-red-500/50 bg-red-500/10" : "border-green-500/50 bg-green-500/10"}`}>
              <p className={`text-sm font-medium mb-1 ${results.failed > 0 && results.success === 0 ? "text-red-500" : "text-green-500"}`}>
                {results.success > 0 ? t("compress.success") : t("common.error")}
              </p>
              <p className="text-sm text-text-secondary">
                {results.success} {t("compress.assetsCompressed")}
                {results.failed > 0 && `, ${results.failed} ${t("compress.assetsFailed")}`}
              </p>
              {results.success > 0 && (
                <p className="text-sm text-text-secondary">
                  {t("compress.avgReduction")}: {results.totalReduction.toFixed(1)}%
                </p>
              )}
              {results.errorMessage && (
                <p className="text-sm text-red-400 mt-2 break-all">
                  {t("common.error")}: {results.errorMessage}
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
            {results ? t("common.close") : t("common.cancel")}
          </button>
          {!results && (
            <button
              onClick={handleCompress}
              disabled={assetIds.length === 0 || processing}
              className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {processing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {t("compress.processing")}
                </>
              ) : (
                <>
                  <Minimize2 size={16} />
                  {t("compress.compress")}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
