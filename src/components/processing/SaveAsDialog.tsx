import { useState, useEffect } from "react";
import { X, Save } from "lucide-react";
import { useTranslation } from "react-i18next";
import { save } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "../../stores/appStore";

interface SaveAsDialogProps {
  open: boolean;
  onClose: () => void;
}

type ImageFormat = "png" | "jpeg" | "ico" | "icns";

interface FormatOption {
  value: ImageFormat;
  label: string;
  extension: string;
}

export function SaveAsDialog({ open, onClose }: SaveAsDialogProps) {
  const { t } = useTranslation();
  const { selectedAssetIds } = useAppStore();
  const [format, setFormat] = useState<ImageFormat>("png");
  const [quality, setQuality] = useState(90);
  const [saving, setSaving] = useState(false);

  const formats: FormatOption[] = [
    { value: "png", label: "PNG", extension: "png" },
    { value: "jpeg", label: "JPEG", extension: "jpg" },
    { value: "ico", label: "ICO (Windows Icon)", extension: "ico" },
    { value: "icns", label: "ICNS (macOS Icon)", extension: "icns" },
  ];

  useEffect(() => {
    if (open) {
      setFormat("png");
      setQuality(90);
      setSaving(false);
    }
  }, [open]);

  const handleSave = async () => {
    if (selectedAssetIds.length !== 1) {
      alert(t("saveAs.selectOneAsset"));
      return;
    }

    const assetId = selectedAssetIds[0];
    const selectedFormat = formats.find((f) => f.value === format);
    if (!selectedFormat) return;

    try {
      const outputPath = await save({
        filters: [
          {
            name: selectedFormat.label,
            extensions: [selectedFormat.extension],
          },
        ],
      });

      if (!outputPath) {
        return;
      }

      setSaving(true);

      await invoke("save_as", {
        assetId,
        outputPath,
        format,
        quality: format === "jpeg" ? quality : undefined,
      });

      alert(t("saveAs.success"));
      onClose();
    } catch (error) {
      console.error("Failed to save as:", error);
      alert(t("saveAs.error") + ": " + error);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative rounded-lg shadow-xl w-full max-w-md mx-4 border border-border" style={{ backgroundColor: "var(--color-bg-secondary, #1e1e1e)" }}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Save size={20} className="text-primary" />
            <h2 className="text-lg font-semibold">{t("saveAs.title")}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-bg-tertiary text-text-secondary"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {selectedAssetIds.length !== 1 ? (
            <div className="text-sm text-text-secondary">
              {t("saveAs.selectOneAsset")}
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium mb-2">
                  {t("saveAs.format")}
                </label>
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value as ImageFormat)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  disabled={saving}
                >
                  {formats.map((fmt) => (
                    <option key={fmt.value} value={fmt.value}>
                      {fmt.label}
                    </option>
                  ))}
                </select>
              </div>

              {format === "jpeg" && (
                <div>
                  <label className="block text-sm font-medium mb-2">
                    {t("saveAs.quality")} ({quality}%)
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="100"
                    value={quality}
                    onChange={(e) => setQuality(parseInt(e.target.value))}
                    className="w-full"
                    disabled={saving}
                  />
                  <div className="flex justify-between text-xs text-text-secondary mt-1">
                    <span>{t("compress.smaller")}</span>
                    <span>{t("compress.better")}</span>
                  </div>
                </div>
              )}

              <div className="text-sm text-text-secondary">
                {format === "ico" && t("saveAs.icoNote")}
                {format === "icns" && t("saveAs.icnsNote")}
                {format === "jpeg" && t("saveAs.jpegNote")}
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-border">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-bg-tertiary transition-colors disabled:opacity-50"
          >
            {t("common.cancel")}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || selectedAssetIds.length !== 1}
            className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {t("saveAs.saving")}
              </>
            ) : (
              <>
                <Save size={16} />
                {t("saveAs.save")}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
