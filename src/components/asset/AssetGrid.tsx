import { AssetCard } from "./AssetCard";
import type { Asset } from "../../types/asset";
import { useAppStore } from "../../stores/appStore";

interface AssetGridProps {
  assets: Asset[];
  onAssetClick: (asset: Asset) => void;
}

export function AssetGrid({ assets, onAssetClick }: AssetGridProps) {
  const viewMode = useAppStore((s) => s.viewMode);

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
      <div className="flex-1 overflow-y-auto p-4">
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
    <div className="flex-1 overflow-y-auto p-4">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
        {assets.map((asset) => (
          <AssetCard
            key={asset.id}
            asset={asset}
            onClick={() => onAssetClick(asset)}
          />
        ))}
      </div>
    </div>
  );
}
