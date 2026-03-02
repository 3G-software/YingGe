import { useTranslation } from "react-i18next";
import {
  Eraser,
  Paintbrush,
  Minimize2,
  Maximize2,
  Grid3x3,
  Scissors,
  Copy,
} from "lucide-react";
import { usePlugins } from "../../contexts/PluginContext";

interface AssetContextMenuProps {
  x: number;
  y: number;
  assetCount: number;
  selectedAssetId?: string;
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
  selectedAssetId,
  onClose,
  onRemoveBackground,
  onImageEditor,
  onCompress,
  onResize,
  onMergeSpritesheet,
  onSplitImage,
  onCopyImage,
}: AssetContextMenuProps) {
  const { t, i18n } = useTranslation();
  const { getActionsForContext } = usePlugins();
  const isSingleAsset = assetCount === 1;
  const isMultipleAssets = assetCount > 1;

  // Get plugin actions based on context
  const pluginActions = getActionsForContext(
    isSingleAsset ? 'asset-single' : isMultipleAssets ? 'asset-multiple' : 'global'
  );

  const builtInMenuItems = [
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

  // Convert plugin actions to menu items
  const pluginMenuItems = pluginActions.map(action => {
    const label = typeof action.label === 'string'
      ? action.label
      : action.label[i18n.language] || action.label['en'];

    return {
      label,
      onClick: () => action.handler(selectedAssetId),
      isPlugin: true,
    };
  });

  const allMenuItems = [...builtInMenuItems, ...pluginMenuItems];

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
        {allMenuItems.map((item, index) => (
          <button
            key={index}
            onClick={() => {
              item.onClick();
              onClose();
            }}
            className="w-full px-4 py-2 text-left text-sm hover:bg-bg-tertiary transition-colors flex items-center gap-3"
          >
            {'icon' in item && <item.icon size={16} className="text-primary" />}
            <span>{item.label}</span>
            {'isPlugin' in item && item.isPlugin && (
              <span className="ml-auto text-xs text-text-secondary">Plugin</span>
            )}
          </button>
        ))}
      </div>
    </>
  );
}
