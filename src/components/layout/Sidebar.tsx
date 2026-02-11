import { useState, useEffect } from "react";
import { FolderOpen, Plus, ChevronDown, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { open } from "@tauri-apps/plugin-dialog";
import { useAppStore } from "../../stores/appStore";
import { useFolders, useImportAssets } from "../../hooks/useAssets";
import { useLibraries, useCreateLibrary } from "../../hooks/useLibrary";
import type { Library as LibraryType } from "../../types/asset";
import { ContextMenu, type ContextMenuItem } from "../common/ContextMenu";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "../../services/tauriBridge";

export function Sidebar() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const {
    currentLibrary,
    setCurrentLibrary,
    currentFolder,
    setCurrentFolder,
    sidebarOpen,
  } = useAppStore();
  const { data: libraries } = useLibraries();
  const { data: folders } = useFolders();
  const createLibrary = useCreateLibrary();
  const importAssets = useImportAssets();

  const [showNewLibrary, setShowNewLibrary] = useState(false);
  const [newLibName, setNewLibName] = useState("");
  const [newLibPath, setNewLibPath] = useState("");

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    folderPath: string;
  } | null>(null);

  // Folder management state
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderParent, setNewFolderParent] = useState<string>("/");
  const [renamingFolder, setRenamingFolder] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [rootExpanded, setRootExpanded] = useState(true);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  // Folder mutations
  const createFolderMutation = useMutation({
    mutationFn: ({ folderName, parentPath }: { folderName: string; parentPath: string }) =>
      api.createFolder(currentLibrary!.id, folderName, parentPath),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["folders"] });
      setShowNewFolder(false);
      setNewFolderName("");
      setNewFolderParent("/");
    },
    onError: (error) => {
      console.error("Failed to create folder:", error);
      alert(`创建文件夹失败: ${error}`);
    },
  });

  const renameFolderMutation = useMutation({
    mutationFn: ({ oldPath, newName }: { oldPath: string; newName: string }) =>
      api.renameFolder(currentLibrary!.id, oldPath, newName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["folders"] });
      setRenamingFolder(null);
      setRenameValue("");
    },
    onError: (error) => {
      console.error("Failed to rename folder:", error);
      alert(`重命名文件夹失败: ${error}`);
    },
  });

  if (!sidebarOpen) return null;

  // Auto-select first library if no library is selected
  useEffect(() => {
    if (libraries && libraries.length > 0 && !currentLibrary) {
      setCurrentLibrary(libraries[0]);
    }
  }, [libraries, currentLibrary, setCurrentLibrary]);

  const handleCreateLibrary = () => {
    if (newLibName && newLibPath) {
      createLibrary.mutate(
        { name: newLibName, rootPath: newLibPath },
        {
          onSuccess: () => {
            setShowNewLibrary(false);
            setNewLibName("");
            setNewLibPath("");
          },
        }
      );
    }
  };

  const handleContextMenu = (e: React.MouseEvent, folderPath?: string) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      folderPath: folderPath || "",
    });
  };

  const handleCreateFolder = () => {
    const trimmedName = newFolderName.trim();
    console.log("handleCreateFolder called, trimmedName:", trimmedName, "parent:", newFolderParent);
    if (trimmedName && currentLibrary) {
      console.log("Creating folder:", trimmedName, "in parent:", newFolderParent);
      createFolderMutation.mutate({ folderName: trimmedName, parentPath: newFolderParent });
    } else {
      console.log("Closing input, no name provided");
      // Close input if no name provided
      setShowNewFolder(false);
      setNewFolderName("");
      setNewFolderParent("/");
    }
  };

  const handleRenameFolder = () => {
    const trimmedName = renameValue.trim();
    if (trimmedName && renamingFolder && currentLibrary) {
      renameFolderMutation.mutate({ oldPath: renamingFolder, newName: trimmedName });
    } else {
      // Close input if no name provided
      setRenamingFolder(null);
      setRenameValue("");
    }
  };

  const getContextMenuItems = (folderPath: string): ContextMenuItem[] => {
    const items: ContextMenuItem[] = [
      {
        label: t("folder.import", "Import"),
        onClick: async () => {
          setContextMenu(null);
          const SUPPORTED_EXTENSIONS = [
            "png", "jpg", "jpeg", "gif", "bmp", "webp", "svg", "tiff",
            "mp3", "wav", "ogg", "flac", "aac", "m4a",
            "mp4", "avi", "mov", "webm",
          ];

          const selected = await open({
            multiple: true,
            directory: false,
            filters: [
              {
                name: "Assets",
                extensions: SUPPORTED_EXTENSIONS,
              },
            ],
          });

          if (selected && currentLibrary) {
            const paths = Array.isArray(selected) ? selected : [selected];
            try {
              await importAssets.mutateAsync({
                libraryId: currentLibrary.id,
                filePaths: paths,
                folderPath: folderPath || "/",
              });
            } catch (e) {
              console.error("Import failed:", e);
              alert(`导入失败: ${e}`);
            }
          }
        },
      },
      {
        label: t("folder.create", "Create Folder"),
        onClick: () => {
          setContextMenu(null);
          setNewFolderParent(folderPath || "/");
          setShowNewFolder(true);
        },
      },
    ];

    // Only show rename option if a specific folder is selected
    if (folderPath) {
      items.push({
        label: t("folder.rename", "Rename"),
        onClick: () => {
          setRenamingFolder(folderPath);
          const folder = folders?.find((f) => f.path === folderPath);
          setRenameValue(folder?.name || "");
        },
      });
    }

    return items;
  };

  const toggleFolderExpanded = (folderPath: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderPath)) {
        next.delete(folderPath);
      } else {
        next.add(folderPath);
      }
      return next;
    });
  };

  const isFolderVisible = (folderPath: string): boolean => {
    if (!folderPath.includes("/")) {
      // Top-level folder, always visible if root is expanded
      return rootExpanded;
    }

    // Check if all parent folders are expanded
    const parts = folderPath.split("/");
    for (let i = 1; i < parts.length; i++) {
      const parentPath = parts.slice(0, i).join("/");
      if (!expandedFolders.has(parentPath)) {
        return false;
      }
    }
    return rootExpanded;
  };

  return (
    <aside className="w-60 h-full flex flex-col border-r border-border bg-bg-secondary">
      {/* Library Selector */}
      <div className="p-3 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">
            {t('library.title')}
          </span>
          <button
            onClick={() => setShowNewLibrary(!showNewLibrary)}
            className="p-1 rounded hover:bg-bg-tertiary text-text-secondary hover:text-text-primary transition-colors"
            title={t('library.create')}
          >
            <Plus size={14} />
          </button>
        </div>
        {showNewLibrary && (
          <div className="mb-2 space-y-2">
            <input
              type="text"
              placeholder={t('library.name')}
              value={newLibName}
              onChange={(e) => setNewLibName(e.target.value)}
              className="w-full px-2 py-1 text-sm bg-bg rounded border border-border focus:border-primary focus:outline-none"
            />
            <input
              type="text"
              placeholder={t('library.path')}
              value={newLibPath}
              onChange={(e) => setNewLibPath(e.target.value)}
              className="w-full px-2 py-1 text-sm bg-bg rounded border border-border focus:border-primary focus:outline-none"
            />
            <button
              onClick={handleCreateLibrary}
              disabled={!newLibName || !newLibPath}
              className="w-full px-2 py-1 text-sm bg-primary text-white rounded hover:bg-primary-hover disabled:opacity-50 transition-colors"
            >
              {t('library.create')}
            </button>
          </div>
        )}
        <select
          value={currentLibrary?.id || ""}
          onChange={(e) => {
            const lib = libraries?.find((l: LibraryType) => l.id === e.target.value);
            setCurrentLibrary(lib || null);
          }}
          className="w-full px-2 py-1.5 text-sm bg-bg rounded border border-border focus:border-primary focus:outline-none"
        >
          {(!libraries || libraries.length === 0) && (
            <option value="">{t('library.noLibraries')}</option>
          )}
          {libraries?.map((lib: LibraryType) => (
            <option key={lib.id} value={lib.id}>
              {lib.name}
            </option>
          ))}
        </select>
      </div>

      {/* Folders */}
      {currentLibrary && (
        <div
          className="flex-1 overflow-y-auto p-2"
          onContextMenu={(e) => handleContextMenu(e)}
        >
          <div className="flex items-center justify-between px-2 mb-2">
            <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">
              {t("sidebar.folders", "Folders")}
            </span>
            <button
              onClick={() => setShowNewFolder(true)}
              className="p-1 rounded hover:bg-bg-tertiary text-text-secondary hover:text-text-primary transition-colors"
              title={t("folder.create", "Create Folder")}
            >
              <Plus size={14} />
            </button>
          </div>

          <button
            onClick={() => setCurrentFolder("/")}
            className={`w-full flex items-center gap-1 px-2 py-1.5 text-sm rounded transition-colors ${
              currentFolder === "/"
                ? "bg-primary/20 text-primary"
                : "text-text-secondary hover:text-text-primary hover:bg-bg-tertiary"
            }`}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                setRootExpanded(!rootExpanded);
              }}
              className="p-0 hover:bg-transparent"
            >
              {rootExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
            <FolderOpen size={14} />
            /
          </button>

          {/* New Folder Dialog under root */}
          {rootExpanded && showNewFolder && newFolderParent === "/" && (
            <div className="mb-2">
              <input
                type="text"
                placeholder={t("folder.name", "Folder Name")}
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateFolder();
                  if (e.key === "Escape") {
                    setShowNewFolder(false);
                    setNewFolderName("");
                  }
                }}
                onBlur={handleCreateFolder}
                autoFocus
                className="w-full px-2 py-1 text-sm bg-bg rounded border border-border focus:border-primary focus:outline-none"
              />
            </div>
          )}

          {folders?.map((folder, index) => {
            const depth = folder.path.split("/").filter(p => p).length;
            const indentPx = depth * 15;
            const hasChildren = folders.some(f => f.path.startsWith(folder.path + "/"));
            const isExpanded = expandedFolders.has(folder.path);
            const isVisible = isFolderVisible(folder.path);

            if (!isVisible) return null;

            return (
              <div key={folder.path}>
                <div style={{ marginLeft: `${indentPx}px` }}>
                  {renamingFolder === folder.path ? (
                    <input
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRenameFolder();
                        if (e.key === "Escape") {
                          setRenamingFolder(null);
                          setRenameValue("");
                        }
                      }}
                      onBlur={handleRenameFolder}
                      autoFocus
                      className="w-full px-2 py-1.5 text-sm bg-bg rounded border border-primary focus:outline-none"
                    />
                  ) : (
                    <button
                      onClick={() => setCurrentFolder(folder.path)}
                      onContextMenu={(e) => {
                        e.stopPropagation();
                        handleContextMenu(e, folder.path);
                      }}
                      className={`w-full flex items-center justify-between gap-1 px-2 py-1.5 text-sm rounded transition-colors ${
                        currentFolder === folder.path
                          ? "bg-primary/20 text-primary"
                          : "text-text-secondary hover:text-text-primary hover:bg-bg-tertiary"
                      }`}
                    >
                      <span className="flex items-center gap-1 truncate">
                        {hasChildren ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFolderExpanded(folder.path);
                            }}
                            className="p-0 hover:bg-transparent flex-shrink-0"
                          >
                            {isExpanded ? (
                              <ChevronDown size={14} />
                            ) : (
                              <ChevronRight size={14} />
                            )}
                          </button>
                        ) : (
                          <span className="w-3.5 flex-shrink-0" />
                        )}
                        <FolderOpen size={14} className="flex-shrink-0" />
                        {folder.name}
                      </span>
                      <span className="text-xs opacity-60">{folder.asset_count}</span>
                    </button>
                  )}
                </div>

                {/* New Folder Dialog under this folder */}
                {showNewFolder && newFolderParent === folder.path && (
                  <div className="mb-2" style={{ marginLeft: `${(depth + 1) * 15}px` }}>
                    <input
                      type="text"
                      placeholder={t("folder.name", "Folder Name")}
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleCreateFolder();
                        if (e.key === "Escape") {
                          setShowNewFolder(false);
                          setNewFolderName("");
                        }
                      }}
                      onBlur={handleCreateFolder}
                      autoFocus
                      className="w-full px-2 py-1 text-sm bg-bg rounded border border-border focus:border-primary focus:outline-none"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={getContextMenuItems(contextMenu.folderPath)}
          onClose={() => setContextMenu(null)}
        />
      )}
    </aside>
  );
}
