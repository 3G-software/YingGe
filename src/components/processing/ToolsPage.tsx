import { useState } from "react";
import { Eraser, Grid3x3, Scissors, Minimize2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAppStore } from "../../stores/appStore";
import { CompressDialog } from "./CompressDialog";

export function ToolsPage() {
  const { t } = useTranslation();
  const selectedAssetIds = useAppStore((s) => s.selectedAssetIds);
  const [showCompressDialog, setShowCompressDialog] = useState(false);

  console.log("[ToolsPage] Render, selectedAssetIds:", selectedAssetIds, "showCompressDialog:", showCompressDialog);

  const handleCompressClick = () => {
    console.log("[ToolsPage] Compress button clicked, setting showCompressDialog to true");
    setShowCompressDialog(true);
  };

  const tools = [
    {
      icon: Eraser,
      name: t("tools.removeBackground"),
      description: t("tools.removeBackgroundDesc"),
      enabled: false,
      onClick: () => {},
    },
    {
      icon: Grid3x3,
      name: t("tools.spritesheet"),
      description: t("tools.spritesheetDesc"),
      enabled: false,
      onClick: () => {},
    },
    {
      icon: Scissors,
      name: t("tools.splitImage"),
      description: t("tools.splitImageDesc"),
      enabled: false,
      onClick: () => {},
    },
    {
      icon: Minimize2,
      name: t("tools.compressImage"),
      description: t("tools.compressImageDesc"),
      enabled: true,
      onClick: handleCompressClick,
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto max-w-3xl">
      <h1 className="text-xl font-semibold mb-6">{t("tools.title")}</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {tools.map((tool, index) => (
          <button
            key={index}
            onClick={tool.onClick}
            disabled={!tool.enabled}
            className={`p-4 rounded-lg border text-left transition-colors ${
              tool.enabled
                ? "border-border bg-bg-secondary hover:border-primary/50 cursor-pointer"
                : "border-border/50 bg-bg-secondary/50 cursor-not-allowed opacity-50"
            }`}
          >
            <tool.icon size={24} className="text-primary mb-3" />
            <h3 className="text-sm font-medium mb-1">{tool.name}</h3>
            <p className="text-xs text-text-secondary">{tool.description}</p>
            {!tool.enabled && (
              <span className="text-xs text-text-secondary mt-2 block">
                {t("common.comingSoon")}
              </span>
            )}
          </button>
        ))}
      </div>

      <CompressDialog
        open={showCompressDialog}
        assetIds={selectedAssetIds}
        onClose={() => setShowCompressDialog(false)}
      />
    </div>
  );
}
