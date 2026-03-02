import { useState, useRef, useEffect } from "react";
import { X, Crop, RotateCcw, Save } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getAssetFilePath } from "../../services/tauriBridge";
import { useQueryClient } from "@tanstack/react-query";
import { convertFileSrc } from "@tauri-apps/api/core";
import { invoke } from "@tauri-apps/api/core";

interface CropImageDialogProps {
  open: boolean;
  assetId: string | null;
  onClose: () => void;
}

interface CropRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function CropImageDialog({ open, assetId, onClose }: CropImageDialogProps) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [originalImage, setOriginalImage] = useState<HTMLImageElement | null>(null);
  const [cropRegion, setCropRegion] = useState<CropRegion | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    errorMessage?: string;
  } | null>(null);
  const queryClient = useQueryClient();

  // Load image when dialog opens
  useEffect(() => {
    if (open && assetId) {
      loadImage();
      setCropRegion(null);
      setResult(null);
    }
  }, [open, assetId]);

  const loadImage = async () => {
    if (!assetId) return;

    try {
      const filePath = await getAssetFilePath(assetId);
      const assetUrl = convertFileSrc(filePath);

      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        setOriginalImage(img);
        drawImageToCanvas(img);
      };
      img.src = assetUrl;
    } catch (error) {
      console.error("Failed to load image:", error);
    }
  };

  const drawImageToCanvas = (img: HTMLImageElement, region?: CropRegion) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = img.width;
    canvas.height = img.height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);

    // Draw crop region overlay
    if (region) {
      // Darken outside crop region
      ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
      ctx.fillRect(0, 0, canvas.width, region.y);
      ctx.fillRect(0, region.y, region.x, region.height);
      ctx.fillRect(region.x + region.width, region.y, canvas.width - region.x - region.width, region.height);
      ctx.fillRect(0, region.y + region.height, canvas.width, canvas.height - region.y - region.height);

      // Draw crop region border
      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 2;
      ctx.strokeRect(region.x, region.y, region.width, region.height);
    }
  };

  const getCanvasPoint = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    return { x, y };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const point = getCanvasPoint(e);
    if (!point) return;

    setIsDragging(true);
    setDragStart(point);
    setCropRegion({ x: point.x, y: point.y, width: 0, height: 0 });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || !dragStart || !originalImage) return;

    const point = getCanvasPoint(e);
    if (!point) return;

    const x = Math.min(dragStart.x, point.x);
    const y = Math.min(dragStart.y, point.y);
    const width = Math.abs(point.x - dragStart.x);
    const height = Math.abs(point.y - dragStart.y);

    const newRegion = { x, y, width, height };
    setCropRegion(newRegion);
    drawImageToCanvas(originalImage, newRegion);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragStart(null);
  };

  const handleReset = () => {
    setCropRegion(null);
    if (originalImage) {
      drawImageToCanvas(originalImage);
    }
  };

  const handleSave = async () => {
    if (!assetId || !cropRegion || cropRegion.width === 0 || cropRegion.height === 0) {
      return;
    }

    setProcessing(true);
    setResult(null);

    try {
      await invoke("crop_image", {
        assetId,
        x: Math.round(cropRegion.x),
        y: Math.round(cropRegion.y),
        width: Math.round(cropRegion.width),
        height: Math.round(cropRegion.height),
      });

      setResult({ success: true });
      queryClient.invalidateQueries({ queryKey: ["assets"] });

      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error) {
      console.error("Failed to crop image:", error);
      setResult({
        success: false,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setProcessing(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface rounded-lg shadow-xl w-[90vw] h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-gray-800">
          <div className="flex items-center gap-2">
            <Crop className="w-5 h-5" />
            <h2 className="text-lg font-semibold">{t("tools.cropImage")}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-hover rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Canvas Area */}
        <div
          ref={containerRef}
          className="flex-1 overflow-auto bg-gray-900 flex items-center justify-center p-4"
        >
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className="max-w-full max-h-full cursor-crosshair"
            style={{ imageRendering: "pixelated" }}
          />
        </div>

        {/* Controls */}
        <div className="p-4 border-t border-border bg-gray-800">
          <div className="flex items-center justify-between">
            <div className="text-sm text-text-secondary">
              {cropRegion && cropRegion.width > 0 && cropRegion.height > 0 ? (
                <span>
                  {t("tools.cropRegion")}: {Math.round(cropRegion.width)} x {Math.round(cropRegion.height)} px
                </span>
              ) : (
                <span>{t("tools.selectCropRegion")}</span>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleReset}
                disabled={!cropRegion || processing}
                className="px-4 py-2 bg-surface hover:bg-hover rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RotateCcw className="w-4 h-4" />
                {t("common.reset")}
              </button>

              <button
                onClick={handleSave}
                disabled={!cropRegion || cropRegion.width === 0 || cropRegion.height === 0 || processing}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" />
                {processing ? t("common.processing") : t("common.save")}
              </button>
            </div>
          </div>

          {/* Result Message */}
          {result && (
            <div
              className={`mt-3 p-3 rounded-lg ${
                result.success
                  ? "bg-green-500/10 text-green-500"
                  : "bg-red-500/10 text-red-500"
              }`}
            >
              {result.success
                ? t("tools.cropSuccess")
                : `${t("tools.cropFailed")}: ${result.errorMessage}`}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

