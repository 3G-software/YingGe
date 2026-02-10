import { useState } from "react";
import { FolderOpen, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAppStore } from "../../stores/appStore";
import { useFolders } from "../../hooks/useAssets";
import { useLibraries, useCreateLibrary } from "../../hooks/useLibrary";
import type { Library as LibraryType } from "../../types/asset";

export function Sidebar() {
  const { t } = useTranslation();
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

  const [showNewLibrary, setShowNewLibrary] = useState(false);
  const [newLibName, setNewLibName] = useState("");
  const [newLibPath, setNewLibPath] = useState("");

  if (!sidebarOpen) return null;

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
          <option value="">{t('library.noLibraries')}</option>
          {libraries?.map((lib: LibraryType) => (
            <option key={lib.id} value={lib.id}>
              {lib.name}
            </option>
          ))}
        </select>
      </div>

      {/* Folders */}
      {currentLibrary && (
        <div className="flex-1 overflow-y-auto p-2">
          <div className="text-xs font-medium text-text-secondary uppercase tracking-wider px-2 mb-2">
            {t('sidebar.folders', 'Folders')}
          </div>
          <button
            onClick={() => setCurrentFolder("/")}
            className={`w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded transition-colors ${
              currentFolder === "/"
                ? "bg-primary/20 text-primary"
                : "text-text-secondary hover:text-text-primary hover:bg-bg-tertiary"
            }`}
          >
            <FolderOpen size={14} />
            {t('sidebar.root', 'Root')}
          </button>
          {folders?.map((folder) => (
            <button
              key={folder.path}
              onClick={() => setCurrentFolder(folder.path)}
              className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 text-sm rounded transition-colors ${
                currentFolder === folder.path
                  ? "bg-primary/20 text-primary"
                  : "text-text-secondary hover:text-text-primary hover:bg-bg-tertiary"
              }`}
            >
              <span className="flex items-center gap-2 truncate">
                <FolderOpen size={14} />
                {folder.name}
              </span>
              <span className="text-xs opacity-60">{folder.asset_count}</span>
            </button>
          ))}
        </div>
      )}
    </aside>
  );
}
