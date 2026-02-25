import { useState, useRef, useEffect } from "react";
import { X, Paintbrush, Eraser, ZoomIn, ZoomOut, RotateCcw, Save, Pipette } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getAssetFilePath, saveEditedImage } from "../../services/tauriBridge";
import { useQueryClient } from "@tanstack/react-query";
import { convertFileSrc } from "@tauri-apps/api/core";

interface ImageEditorDialogProps {
  open: boolean;
  assetId: string | null;
  onClose: () => void;
}

type Tool = "brush" | "eraser" | "eyedropper";

export function ImageEditorDialog({ open, assetId, onClose }: ImageEditorDialogProps) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<Tool>("brush");
  const [brushColor, setBrushColor] = useState("#000000");
  const [brushSize, setBrushSize] = useState(5);
  const [zoom, setZoom] = useState(1);
  const [isDrawing, setIsDrawing] = useState(false);
  const [originalImage, setOriginalImage] = useState<HTMLImageElement | null>(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    errorMessage?: string;
  } | null>(null);
  const queryClient = useQueryClient();
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);

  // Load image when dialog opens
  useEffect(() => {
    if (open && assetId) {
      loadImage();
    }
  }, [open, assetId]);

  // Add wheel event listener for zoom with trackpad/mouse wheel
  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      // Support both Ctrl+wheel (pinch gesture on trackpad) and plain wheel on Windows
      if (e.ctrlKey || Math.abs(e.deltaY) > 0) {
        e.preventDefault();

        // Calculate zoom delta
        const delta = -e.deltaY * 0.01;
        setZoom((prevZoom) => {
          const newZoom = prevZoom + delta;
          return Math.max(0.25, Math.min(5, newZoom));
        });
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, []);

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

  const drawImageToCanvas = (img: HTMLImageElement) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = img.width;
    canvas.height = img.height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
  };

  const getCanvasPoint = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const point = getCanvasPoint(e);
    if (!point) return;

    if (tool === "eyedropper") {
      // Pick color from canvas
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const imageData = ctx.getImageData(point.x, point.y, 1, 1);
      const [r, g, b] = imageData.data;
      const hexColor = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
      setBrushColor(hexColor);
      setTool("brush"); // Switch back to brush after picking color
    } else {
      setIsDrawing(true);
      draw(point.x, point.y);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Update cursor position for custom cursor (relative to container, not canvas)
    const container = canvasContainerRef.current;
    if (container) {
      const rect = container.getBoundingClientRect();
      setCursorPos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }

    const point = getCanvasPoint(e);
    if (point && isDrawing && tool !== "eyedropper") {
      draw(point.x, point.y);
    }
  };

  const handleMouseLeave = () => {
    setIsDrawing(false);
    setCursorPos(null);
  };

  const draw = (x: number, y: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.beginPath();
    ctx.arc(x, y, brushSize / zoom, 0, Math.PI * 2);

    if (tool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "rgba(0,0,0,1)";
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = brushColor;
    }

    ctx.fill();
  };

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 0.25, 5));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 0.25, 0.25));
  };

  const handleReset = () => {
    if (originalImage) {
      drawImageToCanvas(originalImage);
      setZoom(1);
    }
  };

  const handleSave = async () => {
    if (!assetId || !canvasRef.current) return;

    setProcessing(true);
    setResult(null);

    try {
      const canvas = canvasRef.current;
      const dataUrl = canvas.toDataURL("image/png");

      // Remove the data URL prefix to get base64 data
      const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");

      await saveEditedImage(assetId, base64Data);

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
    setOriginalImage(null);
    setZoom(1);
    setTool("brush");
    setBrushColor("#000000");
    setBrushSize(5);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />
      <div className="relative rounded-lg shadow-xl w-full max-w-6xl mx-4 border border-border" style={{ backgroundColor: "var(--color-bg-secondary, #1e1e1e)", maxHeight: "90vh" }}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Paintbrush size={20} className="text-primary" />
            <h2 className="text-lg font-semibold">{t("imageEditor.title")}</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-1 rounded hover:bg-bg-tertiary text-text-secondary"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex" style={{ height: "calc(90vh - 140px)" }}>
          {/* Toolbar */}
          <div className="w-64 p-4 border-r border-border overflow-y-auto">
            <div className="space-y-4">
              {/* Tool Selection */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  {t("imageEditor.tool")}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setTool("brush")}
                    className={`p-3 rounded-lg border flex flex-col items-center gap-2 transition-colors ${
                      tool === "brush"
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <Paintbrush size={20} />
                    <span className="text-xs">{t("imageEditor.brush")}</span>
                  </button>
                  <button
                    onClick={() => setTool("eraser")}
                    className={`p-3 rounded-lg border flex flex-col items-center gap-2 transition-colors ${
                      tool === "eraser"
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <Eraser size={20} />
                    <span className="text-xs">{t("imageEditor.eraser")}</span>
                  </button>
                  <button
                    onClick={() => setTool("eyedropper")}
                    className={`p-3 rounded-lg border flex flex-col items-center gap-2 transition-colors ${
                      tool === "eyedropper"
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <Pipette size={20} />
                    <span className="text-xs">{t("imageEditor.eyedropper")}</span>
                  </button>
                </div>
              </div>

              {/* Brush Color */}
              {tool === "brush" && (
                <div>
                  <label className="block text-sm font-medium mb-2">
                    {t("imageEditor.color")}
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={brushColor}
                      onChange={(e) => setBrushColor(e.target.value)}
                      className="w-16 h-10 rounded border border-border cursor-pointer"
                    />
                    <input
                      type="text"
                      value={brushColor}
                      onChange={(e) => setBrushColor(e.target.value)}
                      className="flex-1 px-3 py-2 bg-bg-tertiary border border-border rounded-lg text-sm focus:outline-none focus:border-primary font-mono"
                      placeholder="#000000"
                    />
                  </div>
                </div>
              )}

              {/* Brush Size */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  {t("imageEditor.brushSize")} ({brushSize}px)
                </label>
                <input
                  type="range"
                  min="1"
                  max="50"
                  value={brushSize}
                  onChange={(e) => setBrushSize(parseInt(e.target.value))}
                  className="w-full"
                />
              </div>

              {/* Zoom Controls */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  {t("imageEditor.zoom")} ({Math.round(zoom * 100)}%)
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={handleZoomOut}
                    className="flex-1 p-2 rounded-lg border border-border hover:border-primary/50 transition-colors flex items-center justify-center gap-2"
                  >
                    <ZoomOut size={16} />
                    <span className="text-xs">{t("imageEditor.zoomOut")}</span>
                  </button>
                  <button
                    onClick={handleZoomIn}
                    className="flex-1 p-2 rounded-lg border border-border hover:border-primary/50 transition-colors flex items-center justify-center gap-2"
                  >
                    <ZoomIn size={16} />
                    <span className="text-xs">{t("imageEditor.zoomIn")}</span>
                  </button>
                </div>
              </div>

              {/* Reset Button */}
              <button
                onClick={handleReset}
                className="w-full p-2 rounded-lg border border-border hover:border-primary/50 transition-colors flex items-center justify-center gap-2"
              >
                <RotateCcw size={16} />
                {t("imageEditor.reset")}
              </button>
            </div>
          </div>

          {/* Canvas Area */}
          <div
            ref={canvasContainerRef}
            className="flex-1 overflow-auto bg-bg-tertiary/30 flex items-center justify-center p-4"
            style={{ position: "relative" }}
          >
            <div
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: "center",
                transition: "transform 0.2s",
              }}
            >
              <canvas
                ref={canvasRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={() => setIsDrawing(false)}
                onMouseLeave={handleMouseLeave}
                className="border border-border shadow-lg"
                style={{
                  imageRendering: zoom > 2 ? "pixelated" : "auto",
                  cursor: "none",
                }}
              />
            </div>
            {/* Custom cursor - outside scaled div so it doesn't scale */}
            {cursorPos && (
              <>
                {tool === "eyedropper" ? (
                  // Eyedropper icon cursor
                  <div
                    style={{
                      position: "absolute",
                      left: cursorPos.x,
                      top: cursorPos.y,
                      transform: "translate(-50%, -50%)",
                      pointerEvents: "none",
                    }}
                  >
                    <Pipette size={32} color="#3b82f6" strokeWidth={2.5} />
                  </div>
                ) : (
                  // Brush/Eraser square cursor
                  <div
                    style={{
                      position: "absolute",
                      left: cursorPos.x,
                      top: cursorPos.y,
                      width: brushSize * zoom,
                      height: brushSize * zoom,
                      border: `2px solid ${tool === "eraser" ? "#ef4444" : brushColor}`,
                      transform: "translate(-50%, -50%)",
                      pointerEvents: "none",
                      backgroundColor: `${tool === "eraser" ? "rgba(239, 68, 68, 0.1)" : brushColor}20`,
                    }}
                  />
                )}
              </>
            )}
          </div>
        </div>

        {/* Results */}
        {result && (
          <div className="p-4 border-t border-border">
            <div className={`p-3 rounded-lg border ${result.success ? "border-green-500/50 bg-green-500/10" : "border-red-500/50 bg-red-500/10"}`}>
              <p className={`text-sm font-medium ${result.success ? "text-green-500" : "text-red-500"}`}>
                {result.success ? t("imageEditor.success") : t("common.error")}
              </p>
              {result.success && (
                <p className="text-sm text-text-secondary mt-1">
                  {t("imageEditor.successMessage")}
                </p>
              )}
              {result.errorMessage && (
                <p className="text-sm text-red-400 mt-2 break-all">
                  {t("common.error")}: {result.errorMessage}
                </p>
              )}
            </div>
          </div>
        )}

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
              onClick={handleSave}
              disabled={!assetId || processing}
              className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {processing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {t("imageEditor.processing")}
                </>
              ) : (
                <>
                  <Save size={16} />
                  {t("imageEditor.save")}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
