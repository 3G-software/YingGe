import { useState } from "react";
import { X, Grid3x3, Download } from "lucide-react";
import { useTranslation } from "react-i18next";
import { mergeSpritesheet } from "../../services/tauriBridge";
import { useQueryClient } from "@tanstack/react-query";

interface SpritesheetDialogProps {
  open: boolean;
  assetIds: string[];
  onClose: () => void;
}

export function SpritesheetDialog({ open, assetIds, onClose }: SpritesheetDialogProps) {
  const { t } = useTranslation();
  const [columns, setColumns] = useState(4);
  const [padding, setPadding] = useState(2);
  const [outputName, setOutputName] = useState("spritesheet");
  const [descriptorFormat, setDescriptorFormat] = useState("json");
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    descriptorContent?: string;
    errorMessage?: string;
  } | null>(null);
  const queryClient = useQueryClient();

  if (!open) return null;

  const maxColumns = Math.max(1, assetIds.length);
  const actualColumns = Math.min(columns, maxColumns);
  const rows = Math.ceil(assetIds.length / actualColumns);

  const handleMerge = async () => {
    if (assetIds.length === 0) return;

    setProcessing(true);
    setResult(null);

    try {
      const res = await mergeSpritesheet({
        assetIds,
        columns: actualColumns,
        padding,
        outputName,
        descriptorFormat,
      });

      setResult({
        success: true,
        descriptorContent: res.descriptor_content,
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
    setOutputName("spritesheet");
    setColumns(4);
    setPadding(2);
    setDescriptorFormat("json");
    onClose();
  };

  const handleDownloadDescriptor = () => {
    if (!result?.descriptorContent) return;

    const extension = descriptorFormat === "json" ? "json" : "xml";
    const blob = new Blob([result.descriptorContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${outputName}.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />
      <div className="relative rounded-lg shadow-xl w-full max-w-md mx-4 border border-border" style={{ backgroundColor: "var(--color-bg-secondary, #1e1e1e)" }}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Grid3x3 size={20} className="text-primary" />
            <h2 className="text-lg font-semibold">{t("spritesheet.title")}</h2>
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
              t("spritesheet.selectAsset")
            ) : (
              <>
                {assetIds.length} {t("spritesheet.assetsSelected")}
              </>
            )}
          </div>

          {/* Output name */}
          <div>
            <label className="block text-sm font-medium mb-2">
              {t("spritesheet.outputName")}
            </label>
            <input
              type="text"
              value={outputName}
              onChange={(e) => setOutputName(e.target.value)}
              className="w-full px-3 py-2 bg-bg-tertiary border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
              disabled={processing}
              placeholder="spritesheet"
            />
          </div>

          {/* Columns */}
          <div>
            <label className="block text-sm font-medium mb-2">
              {t("spritesheet.columns")} ({actualColumns})
            </label>
            <input
              type="range"
              min="1"
              max={maxColumns}
              value={columns}
              onChange={(e) => setColumns(parseInt(e.target.value))}
              className="w-full"
              disabled={processing}
            />
            <div className="text-xs text-text-secondary mt-1">
              {t("spritesheet.gridSize")}: {actualColumns} × {rows}
            </div>
          </div>

          {/* Padding */}
          <div>
            <label className="block text-sm font-medium mb-2">
              {t("spritesheet.padding")} ({padding}px)
            </label>
            <input
              type="range"
              min="0"
              max="20"
              value={padding}
              onChange={(e) => setPadding(parseInt(e.target.value))}
              className="w-full"
              disabled={processing}
            />
          </div>

          {/* Descriptor format */}
          <div>
            <label className="block text-sm font-medium mb-2">
              {t("spritesheet.descriptorFormat")}
            </label>
            <select
              value={descriptorFormat}
              onChange={(e) => setDescriptorFormat(e.target.value)}
              className="w-full px-3 py-2 bg-bg-tertiary border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
              disabled={processing}
            >
              <option value="json">JSON</option>
              <option value="xml_unity">Unity XML</option>
              <option value="xml_cocos">Cocos2d XML</option>
            </select>
          </div>

          {/* Results */}
          {result && (
            <div className={`p-3 rounded-lg border ${result.success ? "border-green-500/50 bg-green-500/10" : "border-red-500/50 bg-red-500/10"}`}>
              <p className={`text-sm font-medium mb-1 ${result.success ? "text-green-500" : "text-red-500"}`}>
                {result.success ? t("spritesheet.success") : t("common.error")}
              </p>
              {result.success && (
                <>
                  <p className="text-sm text-text-secondary mb-2">
                    {t("spritesheet.successMessage")}
                  </p>
                  <button
                    onClick={handleDownloadDescriptor}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
                  >
                    <Download size={14} />
                    {t("spritesheet.downloadDescriptor")}
                  </button>
                </>
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
              onClick={handleMerge}
              disabled={assetIds.length === 0 || processing || !outputName.trim()}
              className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {processing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {t("spritesheet.processing")}
                </>
              ) : (
                <>
                  <Grid3x3 size={16} />
                  {t("spritesheet.merge")}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
