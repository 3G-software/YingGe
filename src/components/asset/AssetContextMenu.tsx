import { useTranslation } from "react-i18next";
import {
  Eraser,
  Paintbrush,
  Minimize2,
  Maximize2,
  Grid3x3,
  Scissors,
  Copy
} from "lucide-react";

interface AssetContextMenuProps {
  x: number;
  y: number;
  assetCount: number;
  onClose: () => void;
  onRemoveBackground: () => void;
  onImageEditor: () => void;
  onCompress: () => void;
  onResize: () => void;
  onMergeSpritesheet: () => void;
  onSplitImage: () => void;
  onCopyImage: () => void;
}

export function AssetContextMenu({
  x,
  y,
  assetCount,
  onClose,
  onRemoveBackground,
  onImageEditor,
  onCompress,
  onResize,
  onMergeSpritesheet,
  onSplitImage,
  onCopyImage,
}: AssetContextMenuProps) {
  const { t } = useTranslation();
  const isSingleAsset = assetCount === 1;
  const isMultipleAssets = assetCount > 1;

  const menuItems = [
    {
      icon: Copy,
      label: t("tools.copyImage"),
      onClick: onCopyImage,
      show: isSingleAsset,
    },
    {
      icon: Eraser,
      label: t("tools.removeBackground"),
      onClick: onRemoveBackground,
      show: isSingleAsset,
    },
    {
      icon: Paintbrush,
      label: t("tools.imageEditor"),
      onClick: onImageEditor,
      show: isSingleAsset,
    },
    {
      icon: Scissors,
      label: t("tools.splitImage"),
      onClick: onSplitImage,
      show: isSingleAsset,
    },
    {
      icon: Grid3x3,
      label: t("tools.spritesheet"),
      onClick: onMergeSpritesheet,
      show: isMultipleAssets,
    },
    {
      icon: Minimize2,
      label: t("tools.compressImage"),
      onClick: onCompress,
      show: true,
    },
    {
      icon: Maximize2,
      label: t("tools.resizeImage"),
      onClick: onResize,
      show: true,
    },
  ].filter(item => item.show);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
      />

      {/* Menu */}
      <div
        className="fixed z-50 min-w-[200px] rounded-lg border border-border shadow-xl py-1"
        style={{
          left: `${x}px`,
          top: `${y}px`,
          backgroundColor: "var(--color-bg-secondary, #1e1e1e)",
        }}
      >
        {menuItems.map((item, index) => (
          <button
            key={index}
            onClick={() => {
              item.onClick();
              onClose();
            }}
            className="w-full px-4 py-2 text-left text-sm hover:bg-bg-tertiary transition-colors flex items-center gap-3"
          >
            <item.icon size={16} className="text-primary" />
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </>
  );
}
