import { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { writeImage } from "@tauri-apps/plugin-clipboard-manager";
import { readFile } from "@tauri-apps/plugin-fs";
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
import { SpritesheetDialog } from "./components/processing/SpritesheetDialog";
import { ResizeDialog } from "./components/processing/ResizeDialog";
import { RemoveBackgroundDialog } from "./components/processing/RemoveBackgroundDialog";
import { ImageEditorDialog } from "./components/processing/ImageEditorDialog";
import { CreateLibraryModal } from "./components/library/CreateLibraryModal";
import { LibraryManagementDialog } from "./components/library/LibraryManagementDialog";
import { AboutDialog } from "./components/common/AboutDialog";
import { ResetAppDialog } from "./components/common/ResetAppDialog";
import { useAssets } from "./hooks/useAssets";
import { useLibraries } from "./hooks/useLibrary";
import { useAppStore } from "./stores/appStore";
import { useKeywordSearch, useSemanticSearch } from "./hooks/useSearch";
import { getAssetFilePath } from "./services/tauriBridge";
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
  const [showSpritesheet, setShowSpritesheet] = useState(false);
  const [showResize, setShowResize] = useState(false);
  const [showRemoveBackground, setShowRemoveBackground] = useState(false);
  const [showImageEditor, setShowImageEditor] = useState(false);
  const [showLibraryMgmt, setShowLibraryMgmt] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showResetApp, setShowResetApp] = useState(false);
  const [_showExportLibrary, setShowExportLibrary] = useState(false);
  const [_showImportLibrary, setShowImportLibrary] = useState(false);
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
    let unlistenSpritesheet: (() => void) | undefined;
    let unlistenResize: (() => void) | undefined;
    let unlistenRemoveBackground: (() => void) | undefined;
    let unlistenImageEditor: (() => void) | undefined;
    let unlistenLibraryMgmt: (() => void) | undefined;
    let unlistenAbout: (() => void) | undefined;
    let unlistenPluginDevGuide: (() => void) | undefined;
    let unlistenResetApp: (() => void) | undefined;
    let unlistenExportLibrary: (() => void) | undefined;
    let unlistenImportLibrary: (() => void) | undefined;

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
      unlistenSpritesheet = await appWindow.listen("menu-merge-spritesheet", () => {
        console.log("[App] menu-merge-spritesheet event received");
        setShowSpritesheet(true);
      });
      unlistenResize = await appWindow.listen("menu-resize-image", () => {
        console.log("[App] menu-resize-image event received");
        setShowResize(true);
      });
      unlistenRemoveBackground = await appWindow.listen("menu-remove-background", () => {
        console.log("[App] menu-remove-background event received");
        setShowRemoveBackground(true);
      });
      unlistenImageEditor = await appWindow.listen("menu-image-editor", () => {
        console.log("[App] menu-image-editor event received");
        setShowImageEditor(true);
      });
      unlistenLibraryMgmt = await appWindow.listen("menu-library-management", () => {
        console.log("[App] menu-library-management event received");
        setShowLibraryMgmt(true);
      });
      unlistenAbout = await appWindow.listen("menu-about", () => {
        console.log("[App] menu-about event received");
        setShowAbout(true);
      });
      unlistenPluginDevGuide = await appWindow.listen("menu-plugin-dev-guide", () => {
        console.log("[App] menu-plugin-dev-guide event received");
        alert("插件开发指导功能即将推出");
      });
      unlistenResetApp = await appWindow.listen("menu-reset-app", () => {
        console.log("[App] menu-reset-app event received");
        setShowResetApp(true);
      });
      unlistenExportLibrary = await appWindow.listen("menu-export-library", () => {
        console.log("[App] menu-export-library event received");
        setShowExportLibrary(true);
      });
      unlistenImportLibrary = await appWindow.listen("menu-import-library", () => {
        console.log("[App] menu-import-library event received");
        setShowImportLibrary(true);
      });
    };

    setupListener();

    return () => {
      unlistenImport?.();
      unlistenCompress?.();
      unlistenSpritesheet?.();
      unlistenResize?.();
      unlistenRemoveBackground?.();
      unlistenImageEditor?.();
      unlistenLibraryMgmt?.();
      unlistenAbout?.();
      unlistenPluginDevGuide?.();
      unlistenResetApp?.();
      unlistenExportLibrary?.();
      unlistenImportLibrary?.();
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

  const handleCopyImage = async () => {
    if (selectedAssetIds.length !== 1) return;

    try {
      const filePath = await getAssetFilePath(selectedAssetIds[0]);
      const imageData = await readFile(filePath);
      await writeImage(imageData);
      console.log("Image copied to clipboard");
    } catch (error) {
      console.error("Failed to copy image:", error);
    }
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
          <AssetGrid
            assets={displayAssets}
            onAssetClick={handleAssetClick}
            onRemoveBackground={() => setShowRemoveBackground(true)}
            onImageEditor={() => setShowImageEditor(true)}
            onCompress={() => setShowCompress(true)}
            onResize={() => setShowResize(true)}
            onMergeSpritesheet={() => setShowSpritesheet(true)}
            onSplitImage={() => {
              // Split image functionality - to be implemented
              console.log("Split image clicked");
            }}
            onCopyImage={handleCopyImage}
          />
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
      <SpritesheetDialog
        open={showSpritesheet}
        assetIds={selectedAssetIds}
        onClose={() => setShowSpritesheet(false)}
      />
      <ResizeDialog
        open={showResize}
        assetIds={selectedAssetIds}
        onClose={() => setShowResize(false)}
      />
      <RemoveBackgroundDialog
        open={showRemoveBackground}
        assetId={selectedAssetIds.length === 1 ? selectedAssetIds[0] : null}
        onClose={() => setShowRemoveBackground(false)}
      />
      <ImageEditorDialog
        open={showImageEditor}
        assetId={selectedAssetIds.length === 1 ? selectedAssetIds[0] : null}
        onClose={() => setShowImageEditor(false)}
      />
      <CreateLibraryModal
        open={showCreateLibrary}
        onClose={() => setShowCreateLibrary(false)}
      />
      <LibraryManagementDialog
        open={showLibraryMgmt}
        onClose={() => setShowLibraryMgmt(false)}
      />
      <AboutDialog
        open={showAbout}
        onClose={() => setShowAbout(false)}
      />
      <ResetAppDialog
        open={showResetApp}
        onClose={() => setShowResetApp(false)}
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
