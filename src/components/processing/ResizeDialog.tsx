import { useState, useEffect } from "react";
import { X, Maximize2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { resizeImage, getAssetDetail } from "../../services/tauriBridge";

interface ResizeDialogProps {
  open: boolean;
  assetIds: string[];
  onClose: () => void;
}

export function ResizeDialog({ open, assetIds, onClose }: ResizeDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [width, setWidth] = useState(256);
  const [height, setHeight] = useState(256);
  const [maintainAspect, setMaintainAspect] = useState(true);
  const [originalWidth, setOriginalWidth] = useState(0);
  const [originalHeight, setOriginalHeight] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState(0);

  // Load original dimensions from first selected asset
  useEffect(() => {
    if (open && assetIds.length > 0) {
      getAssetDetail(assetIds[0]).then((detail) => {
        if (detail.asset.width && detail.asset.height) {
          setOriginalWidth(detail.asset.width);
          setOriginalHeight(detail.asset.height);
          setWidth(detail.asset.width);
          setHeight(detail.asset.height);
        }
      });
    }
  }, [open, assetIds]);

  // Update height when width changes (if maintaining aspect ratio)
  const handleWidthChange = (newWidth: number) => {
    setWidth(newWidth);
    if (maintainAspect && originalWidth > 0 && originalHeight > 0) {
      const ratio = originalHeight / originalWidth;
      setHeight(Math.round(newWidth * ratio));
    }
  };

  // Update width when height changes (if maintaining aspect ratio)
  const handleHeightChange = (newHeight: number) => {
    setHeight(newHeight);
    if (maintainAspect && originalWidth > 0 && originalHeight > 0) {
      const ratio = originalWidth / originalHeight;
      setWidth(Math.round(newHeight * ratio));
    }
  };

  if (!open) return null;

  const handleResize = async () => {
    if (assetIds.length === 0) {
      setError(t("resize.noImages"));
      return;
    }

    setProcessing(true);
    setError(null);
    setSuccessCount(0);

    let success = 0;
    let fail = 0;

    for (const assetId of assetIds) {
      try {
        await resizeImage({
          assetId,
          width,
          height,
          maintainAspect,
          suffix: t("resize.suffix"),
        });
        success++;
        setSuccessCount(success);
      } catch (e) {
        fail++;
        console.error(`Failed to resize asset ${assetId}:`, e);
      }
    }

    await queryClient.invalidateQueries({ queryKey: ["assets"] });
    setProcessing(false);

    if (fail === 0) {
      onClose();
    } else {
      setError(t("resize.partialError", { success, fail }));
    }
  };

  // Preset sizes
  const presets = [
    { label: "32x32", w: 32, h: 32 },
    { label: "64x64", w: 64, h: 64 },
    { label: "128x128", w: 128, h: 128 },
    { label: "256x256", w: 256, h: 256 },
    { label: "512x512", w: 512, h: 512 },
    { label: "1024x1024", w: 1024, h: 1024 },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        className="relative rounded-lg shadow-xl w-full max-w-md mx-4 border border-border"
        style={{ backgroundColor: "var(--color-bg-secondary, #1e1e1e)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Maximize2 size={20} className="text-primary" />
            <h2 className="text-lg font-semibold">{t("resize.title")}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-bg-tertiary text-text-secondary"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          <p className="text-sm text-text-secondary">
            {t("resize.selectedCount", { count: assetIds.length })}
          </p>

          {originalWidth > 0 && originalHeight > 0 && (
            <p className="text-sm text-text-secondary">
              {t("resize.originalSize")}: {originalWidth} x {originalHeight} px
            </p>
          )}

          {/* Preset buttons */}
          <div>
            <label className="block text-xs text-text-secondary mb-2">
              {t("resize.presets")}
            </label>
            <div className="flex flex-wrap gap-2">
              {presets.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => {
                    setWidth(preset.w);
                    setHeight(preset.h);
                  }}
                  className={`px-3 py-1 text-xs rounded border transition-colors ${
                    width === preset.w && height === preset.h
                      ? "border-primary bg-primary/20 text-primary"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom size */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-text-secondary mb-1">
                {t("resize.width")}
              </label>
              <input
                type="number"
                min={1}
                max={4096}
                value={width}
                onChange={(e) => handleWidthChange(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full px-3 py-2 text-sm bg-bg rounded border border-border focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">
                {t("resize.height")}
              </label>
              <input
                type="number"
                min={1}
                max={4096}
                value={height}
                onChange={(e) => handleHeightChange(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full px-3 py-2 text-sm bg-bg rounded border border-border focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          {/* Maintain aspect ratio */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={maintainAspect}
              onChange={(e) => setMaintainAspect(e.target.checked)}
              className="w-4 h-4 rounded border-border"
            />
            <span className="text-sm">{t("resize.maintainAspect")}</span>
          </label>

          {processing && (
            <p className="text-sm text-text-secondary">
              {t("resize.progress", { success: successCount, total: assetIds.length })}
            </p>
          )}

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-bg-tertiary transition-colors"
          >
            {t("common.cancel")}
          </button>
          <button
            onClick={handleResize}
            disabled={processing || assetIds.length === 0}
            className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50"
          >
            {processing ? t("common.loading") : t("resize.resize")}
          </button>
        </div>
      </div>
    </div>
  );
}
