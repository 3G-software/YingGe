import { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MainLayout } from "./components/layout/MainLayout";
import { TopBar } from "./components/layout/TopBar";
import { AssetGrid } from "./components/asset/AssetGrid";
import { AssetDetail } from "./components/asset/AssetDetail";
import { AssetImport } from "./components/asset/AssetImport";
import { TagManager } from "./components/tag/TagManager";
import { SettingsPage } from "./components/settings/SettingsPage";
import { ToolsPage } from "./components/processing/ToolsPage";
import { useAssets } from "./hooks/useAssets";
import { useAppStore } from "./stores/appStore";
import { useKeywordSearch, useSemanticSearch } from "./hooks/useSearch";
import type { Asset } from "./types/asset";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

function AppContent() {
  const currentLibrary = useAppStore((s) => s.currentLibrary);
  const [route, setRoute] = useState("/");
  const [showImport, setShowImport] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<Asset[] | null>(null);

  const { data: assetsData } = useAssets();
  const keywordSearch = useKeywordSearch();
  const semanticSearch = useSemanticSearch();

  useEffect(() => {
    const handleHashChange = () => {
      setRoute(window.location.hash.slice(1) || "/");
    };
    window.addEventListener("hashchange", handleHashChange);
    handleHashChange();
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const handleSearch = (query: string, mode: "keyword" | "semantic") => {
    if (!currentLibrary) return;

    if (mode === "semantic") {
      semanticSearch.mutate(
        { libraryId: currentLibrary.id, query, topK: 50 },
        {
          onSuccess: (results) => {
            setSearchResults(results.map((r) => r.asset));
          },
        }
      );
    } else {
      keywordSearch.mutate(
        {
          libraryId: currentLibrary.id,
          query,
          page: 1,
          pageSize: 100,
        },
        {
          onSuccess: (results) => {
            setSearchResults(results.assets);
          },
        }
      );
    }
  };

  const handleAssetClick = (asset: Asset) => {
    setSelectedAssetId(asset.id);
  };

  const renderPage = () => {
    switch (route) {
      case "/tags":
        return <TagManager />;
      case "/settings":
        return <SettingsPage />;
      case "/tools":
        return <ToolsPage />;
      default:
        return renderAssetBrowser();
    }
  };

  const renderAssetBrowser = () => {
    const displayAssets = searchResults || assetsData?.assets || [];

    return (
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">
          <AssetGrid assets={displayAssets} onAssetClick={handleAssetClick} />
          {assetsData && !searchResults && (
            <div className="px-4 py-2 border-t border-border text-xs text-text-secondary">
              {assetsData.total} assets total
            </div>
          )}
          {searchResults && (
            <div className="px-4 py-2 border-t border-border text-xs text-text-secondary flex items-center justify-between">
              <span>{searchResults.length} results</span>
              <button
                onClick={() => setSearchResults(null)}
                className="text-primary hover:underline"
              >
                Clear search
              </button>
            </div>
          )}
        </div>
        {selectedAssetId && (
          <AssetDetail
            assetId={selectedAssetId}
            onClose={() => setSelectedAssetId(null)}
          />
        )}
      </div>
    );
  };

  return (
    <MainLayout>
      <TopBar onImportClick={() => setShowImport(true)} onSearch={handleSearch} />
      {!currentLibrary ? (
        <div className="flex-1 flex items-center justify-center text-text-secondary">
          <div className="text-center">
            <h2 className="text-2xl font-semibold mb-2 text-text-primary">
              Welcome to YingGe
            </h2>
            <p className="text-sm mb-4">
              Create or select a library from the sidebar to get started
            </p>
          </div>
        </div>
      ) : (
        renderPage()
      )}
      <AssetImport open={showImport} onClose={() => setShowImport(false)} />
    </MainLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}

export default App;
