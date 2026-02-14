import { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { MainLayout } from "./components/layout/MainLayout";
import { TopBar } from "./components/layout/TopBar";
import { AssetGrid } from "./components/asset/AssetGrid";
import { AssetDetail } from "./components/asset/AssetDetail";
import { AssetImport } from "./components/asset/AssetImport";
import { DropZone } from "./components/asset/DropZone";
import { TagManager } from "./components/tag/TagManager";
import { SettingsPage } from "./components/settings/SettingsPage";
import { ToolsPage } from "./components/processing/ToolsPage";
import { CompressDialog } from "./components/processing/CompressDialog";
import { CreateLibraryModal } from "./components/library/CreateLibraryModal";
import { LibraryManagementDialog } from "./components/library/LibraryManagementDialog";
import { useAssets } from "./hooks/useAssets";
import { useLibraries } from "./hooks/useLibrary";
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
  const { currentLibrary, setCurrentLibrary, selectedAssetIds } = useAppStore();
  const [route, setRoute] = useState("/");
  const [showImport, setShowImport] = useState(false);
  const [showCreateLibrary, setShowCreateLibrary] = useState(false);
  const [showCompress, setShowCompress] = useState(false);
  const [showLibraryMgmt, setShowLibraryMgmt] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<Asset[] | null>(null);

  const { data: libraries } = useLibraries();
  const { data: assetsData } = useAssets();
  const keywordSearch = useKeywordSearch();
  const semanticSearch = useSemanticSearch();

  // Close asset detail if the asset is deleted
  useEffect(() => {
    if (selectedAssetId && assetsData) {
      const assetExists = assetsData.assets.some(a => a.id === selectedAssetId);
      if (!assetExists) {
        setSelectedAssetId(null);
      }
    }
  }, [assetsData, selectedAssetId]);

  // Auto-show create library modal when no libraries exist
  useEffect(() => {
    if (libraries && libraries.length === 0) {
      setShowCreateLibrary(true);
    }
    // Auto-select first library if none selected
    if (libraries && libraries.length > 0 && !currentLibrary) {
      setCurrentLibrary(libraries[0]);
    }
  }, [libraries, currentLibrary, setCurrentLibrary]);

  useEffect(() => {
    const handleHashChange = () => {
      setRoute(window.location.hash.slice(1) || "/");
    };
    window.addEventListener("hashchange", handleHashChange);
    handleHashChange();
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  // Listen for menu events
  useEffect(() => {
    let unlistenImport: (() => void) | undefined;
    let unlistenCompress: (() => void) | undefined;
    let unlistenLibraryMgmt: (() => void) | undefined;

    const setupListener = async () => {
      const appWindow = getCurrentWebviewWindow();
      unlistenImport = await appWindow.listen("menu-import", () => {
        console.log("[App] menu-import event received");
        setShowImport(true);
      });
      unlistenCompress = await appWindow.listen("menu-compress-image", () => {
        console.log("[App] menu-compress-image event received");
        setShowCompress(true);
      });
      unlistenLibraryMgmt = await appWindow.listen("menu-library-management", () => {
        console.log("[App] menu-library-management event received");
        setShowLibraryMgmt(true);
      });
    };

    setupListener();

    return () => {
      unlistenImport?.();
      unlistenCompress?.();
      unlistenLibraryMgmt?.();
    };
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
    console.log("[App] renderPage called, route:", route);
    switch (route) {
      case "/tags":
        return (
          <div className="flex flex-1 overflow-hidden p-6">
            <TagManager />
          </div>
        );
      case "/settings":
        return (
          <div className="flex flex-1 overflow-hidden p-6">
            <SettingsPage />
          </div>
        );
      case "/tools":
        console.log("[App] Rendering ToolsPage");
        return (
          <div className="flex flex-1 overflow-hidden p-6">
            <ToolsPage />
          </div>
        );
      default:
        return renderAssetBrowser();
    }
  };

  const renderAssetBrowser = () => {
    const displayAssets = searchResults || assetsData?.assets || [];

    return (
      <div className="flex flex-1 overflow-hidden p-6">
        <DropZone onOpenSettings={() => { window.location.hash = "#/settings"; }}>
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
        </DropZone>
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
      <TopBar onSearch={handleSearch} />
      {!currentLibrary ? (
        <div className="flex-1 flex items-center justify-center text-text-secondary">
          <div className="text-center">
            <h2 className="text-2xl font-semibold mb-2 text-text-primary">
              Welcome to YingGe
            </h2>
            <p className="text-sm mb-4">
              Create or select a library to get started
            </p>
            <button
              onClick={() => setShowCreateLibrary(true)}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
            >
              Create Library
            </button>
          </div>
        </div>
      ) : (
        renderPage()
      )}
      <AssetImport
        open={showImport}
        onClose={() => setShowImport(false)}
        onOpenSettings={() => {
          window.location.hash = "#/settings";
        }}
      />
      <CompressDialog
        open={showCompress}
        assetIds={selectedAssetIds}
        onClose={() => setShowCompress(false)}
      />
      <CreateLibraryModal
        open={showCreateLibrary}
        onClose={() => setShowCreateLibrary(false)}
      />
      <LibraryManagementDialog
        open={showLibraryMgmt}
        onClose={() => setShowLibraryMgmt(false)}
      />
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
