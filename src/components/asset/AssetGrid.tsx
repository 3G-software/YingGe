import { useState, useRef, useEffect, MouseEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { AssetCard } from "./AssetCard";
import { AssetContextMenu } from "./AssetContextMenu";
import type { Asset } from "../../types/asset";
import { useAppStore } from "../../stores/appStore";
import { duplicateAssets, moveAssets } from "../../services/tauriBridge";

interface AssetGridProps {
  assets: Asset[];
  onAssetClick: (asset: Asset) => void;
  onRemoveBackground: () => void;
  onImageEditor: () => void;
  onCompress: () => void;
  onResize: () => void;
  onMergeSpritesheet: () => void;
  onSplitImage: () => void;
  onCopyImage: () => void;
}

interface SelectionBox {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export function AssetGrid({
  assets,
  onAssetClick,
  onRemoveBackground,
  onImageEditor,
  onCompress,
  onResize,
  onMergeSpritesheet,
  onSplitImage,
  onCopyImage,
}: AssetGridProps) {
  const viewMode = useAppStore((s) => s.viewMode);
  const { selectedAssetIds, setSelectedAssetIds, currentFolder } = useAppStore();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [copiedAssetIds, setCopiedAssetIds] = useState<string[]>([]);
  const [cutAssetIds, setCutAssetIds] = useState<string[]>([]);
  const gridRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      // Ctrl/Cmd + A: Select all
      if (modKey && e.key === 'a') {
        e.preventDefault();
        const allIds = assets.map(a => a.id);
        setSelectedAssetIds(allIds);
        console.log('[AssetGrid] Select all:', allIds.length, 'assets');
      }

      // Ctrl/Cmd + C: Copy
      if (modKey && e.key === 'c' && selectedAssetIds.length > 0) {
        e.preventDefault();
        setCopiedAssetIds([...selectedAssetIds]);
        setCutAssetIds([]); // Clear cut when copying
        console.log('[AssetGrid] Copied:', selectedAssetIds.length, 'assets');
        // Also copy to system clipboard
        onCopyImage();
      }

      // Ctrl/Cmd + X: Cut (for moving)
      if (modKey && e.key === 'x' && selectedAssetIds.length > 0) {
        e.preventDefault();
        setCutAssetIds([...selectedAssetIds]);
        setCopiedAssetIds([]); // Clear copy when cutting
        console.log('[AssetGrid] Cut:', selectedAssetIds.length, 'assets');
      }

      // Ctrl/Cmd + V: Paste (duplicate or move assets)
      if (modKey && e.key === 'v' && (copiedAssetIds.length > 0 || cutAssetIds.length > 0)) {
        e.preventDefault();

        if (cutAssetIds.length > 0) {
          // Move assets (cut + paste)
          console.log('[AssetGrid] Moving:', cutAssetIds.length, 'assets', 'to folder:', currentFolder);
          try {
            await moveAssets(cutAssetIds, currentFolder);
            console.log('[AssetGrid] Moved:', cutAssetIds.length, 'assets');

            // Refresh queries
            queryClient.invalidateQueries({ queryKey: ["assets"], refetchType: "all" });
            queryClient.invalidateQueries({ queryKey: ["folders"], refetchType: "all" });
            queryClient.invalidateQueries({ queryKey: ["root-assets-count"], refetchType: "all" });

            // Clear cut list and keep selection
            setCutAssetIds([]);
          } catch (error) {
            console.error('[AssetGrid] Failed to move assets:', error);
            alert(`移动资源失败: ${error}`);
          }
        } else if (copiedAssetIds.length > 0) {
          // Duplicate assets (copy + paste)
          console.log('[AssetGrid] Pasting:', copiedAssetIds.length, 'assets', 'to folder:', currentFolder);
          try {
            const copySuffix = t('asset.copySuffix');
            const duplicated = await duplicateAssets(copiedAssetIds, copySuffix, currentFolder);
            console.log('[AssetGrid] Duplicated:', duplicated.length, 'assets');

            // Refresh queries
            queryClient.invalidateQueries({ queryKey: ["assets"], refetchType: "all" });
            queryClient.invalidateQueries({ queryKey: ["folders"], refetchType: "all" });
            queryClient.invalidateQueries({ queryKey: ["root-assets-count"], refetchType: "all" });

            // Select the newly duplicated assets
            const newIds = duplicated.map(a => a.id);
            setSelectedAssetIds(newIds);
          } catch (error) {
            console.error('[AssetGrid] Failed to duplicate assets:', error);
            alert(`复制资源失败: ${error}`);
          }
        }
      }
    };

    // Global dragend listener to ensure flag is always cleared
    const handleDragEnd = () => {
      // Don't clear immediately - let drop handlers clear it
      // Set a longer timeout as fallback
      setTimeout(() => {
        if ((window as any).__internalDragInProgress) {
          (window as any).__internalDragInProgress = false;
          console.log('[AssetGrid] Global dragend - cleared internal drag flag (timeout fallback)');
        }
      }, 1000);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('dragend', handleDragEnd);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('dragend', handleDragEnd);
    };
  }, [assets, selectedAssetIds, copiedAssetIds, setSelectedAssetIds, onCopyImage, queryClient]);

  const handleMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    // Only start selection on left click and not on a card
    if (e.button !== 0 || (e.target as HTMLElement).closest('[data-asset-card]')) {
      return;
    }

    const rect = gridRef.current?.getBoundingClientRect();
    if (!rect) return;

    const startX = e.clientX - rect.left + (gridRef.current?.scrollLeft || 0);
    const startY = e.clientY - rect.top + (gridRef.current?.scrollTop || 0);

    setIsSelecting(true);
    setSelectionBox({ startX, startY, endX: startX, endY: startY });
  };

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!isSelecting || !selectionBox) return;

    const rect = gridRef.current?.getBoundingClientRect();
    if (!rect) return;

    const endX = e.clientX - rect.left + (gridRef.current?.scrollLeft || 0);
    const endY = e.clientY - rect.top + (gridRef.current?.scrollTop || 0);

    setSelectionBox({ ...selectionBox, endX, endY });

    // Check which cards intersect with selection box
    const selectedIds: string[] = [];
    const boxLeft = Math.min(selectionBox.startX, endX);
    const boxRight = Math.max(selectionBox.startX, endX);
    const boxTop = Math.min(selectionBox.startY, endY);
    const boxBottom = Math.max(selectionBox.startY, endY);

    cardRefs.current.forEach((cardEl, assetId) => {
      const cardRect = cardEl.getBoundingClientRect();
      const gridRect = gridRef.current?.getBoundingClientRect();
      if (!gridRect) return;

      const cardLeft = cardRect.left - gridRect.left + (gridRef.current?.scrollLeft || 0);
      const cardRight = cardLeft + cardRect.width;
      const cardTop = cardRect.top - gridRect.top + (gridRef.current?.scrollTop || 0);
      const cardBottom = cardTop + cardRect.height;

      // Check intersection
      if (
        boxLeft < cardRight &&
        boxRight > cardLeft &&
        boxTop < cardBottom &&
        boxBottom > cardTop
      ) {
        selectedIds.push(assetId);
      }
    });

    setSelectedAssetIds(selectedIds);
  };

  const handleMouseUp = () => {
    setIsSelecting(false);
    setSelectionBox(null);
  };

  const handleContextMenu = (e: MouseEvent<HTMLDivElement>) => {
    e.preventDefault();

    // Only show context menu if there are selected assets
    if (selectedAssetIds.length > 0) {
      setContextMenu({ x: e.clientX, y: e.clientY });
    }
  };

  useEffect(() => {
    if (isSelecting) {
      document.addEventListener('mouseup', handleMouseUp);
      return () => document.removeEventListener('mouseup', handleMouseUp);
    }
  }, [isSelecting]);

  const setCardRef = (assetId: string, el: HTMLDivElement | null) => {
    if (el) {
      cardRefs.current.set(assetId, el);
    } else {
      cardRefs.current.delete(assetId);
    }
  };

  if (assets.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-secondary">
        <div className="text-center">
          <p className="text-lg mb-2">No assets found</p>
          <p className="text-sm">Import files to get started</p>
        </div>
      </div>
    );
  }

  if (viewMode === "list") {
    return (
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-text-secondary border-b border-border">
              <th className="pb-2 font-medium">Name</th>
              <th className="pb-2 font-medium">Type</th>
              <th className="pb-2 font-medium">Size</th>
              <th className="pb-2 font-medium">Dimensions</th>
              <th className="pb-2 font-medium">Imported</th>
            </tr>
          </thead>
          <tbody>
            {assets.map((asset) => (
              <tr
                key={asset.id}
                onClick={() => onAssetClick(asset)}
                className="border-b border-border/50 hover:bg-bg-secondary cursor-pointer transition-colors"
              >
                <td className="py-2 pr-4 truncate max-w-xs">
                  {asset.file_name}
                </td>
                <td className="py-2 pr-4 text-text-secondary">
                  {asset.file_type}
                </td>
                <td className="py-2 pr-4 text-text-secondary">
                  {(asset.file_size / 1024).toFixed(1)} KB
                </td>
                <td className="py-2 pr-4 text-text-secondary">
                  {asset.width && asset.height
                    ? `${asset.width}x${asset.height}`
                    : "-"}
                </td>
                <td className="py-2 text-text-secondary">
                  {new Date(asset.imported_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div
      ref={gridRef}
      className="flex-1 overflow-y-auto relative select-none"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onContextMenu={handleContextMenu}
    >
      <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
        {assets.map((asset) => (
          <div
            key={asset.id}
            ref={(el) => setCardRef(asset.id, el)}
            data-asset-card
          >
            <AssetCard
              asset={asset}
              onClick={() => onAssetClick(asset)}
            />
          </div>
        ))}
      </div>

      {/* Selection box overlay */}
      {isSelecting && selectionBox && (
        <div
          className="absolute border-2 border-primary bg-primary/10 pointer-events-none"
          style={{
            left: Math.min(selectionBox.startX, selectionBox.endX),
            top: Math.min(selectionBox.startY, selectionBox.endY),
            width: Math.abs(selectionBox.endX - selectionBox.startX),
            height: Math.abs(selectionBox.endY - selectionBox.startY),
          }}
        />
      )}

      {/* Context Menu */}
      {contextMenu && (
        <AssetContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          assetCount={selectedAssetIds.length}
          onClose={() => setContextMenu(null)}
          onRemoveBackground={onRemoveBackground}
          onImageEditor={onImageEditor}
          onCompress={onCompress}
          onResize={onResize}
          onMergeSpritesheet={onMergeSpritesheet}
          onSplitImage={onSplitImage}
          onCopyImage={onCopyImage}
        />
      )}
    </div>
  );
}
