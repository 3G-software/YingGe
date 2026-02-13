import { useState, useRef, useEffect, MouseEvent } from "react";
import { AssetCard } from "./AssetCard";
import type { Asset } from "../../types/asset";
import { useAppStore } from "../../stores/appStore";

interface AssetGridProps {
  assets: Asset[];
  onAssetClick: (asset: Asset) => void;
}

interface SelectionBox {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export function AssetGrid({ assets, onAssetClick }: AssetGridProps) {
  const viewMode = useAppStore((s) => s.viewMode);
  const { setSelectedAssetIds } = useAppStore();

  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

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
    </div>
  );
}
