import { useState } from "react";
import { X, FolderOpen } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { useCreateLibrary } from "../../hooks/useLibrary";

interface CreateLibraryModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CreateLibraryModal({ open: isOpen, onClose, onSuccess }: CreateLibraryModalProps) {
  const [name, setName] = useState("");
  const [path, setPath] = useState("");
  const [creating, setCreating] = useState(false);
  const createLibrary = useCreateLibrary();

  if (!isOpen) return null;

  const handleSelectFolder = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Select Library Location",
    });

    if (selected && typeof selected === "string") {
      setPath(selected);
      // Auto-fill name from folder name if empty
      if (!name) {
        const folderName = selected.split("/").pop() || selected.split("\\").pop();
        if (folderName) setName(folderName);
      }
    }
  };

  const handleCreate = async () => {
    if (!name || !path) return;

    setCreating(true);
    try {
      await createLibrary.mutateAsync({ name, rootPath: path });
      setName("");
      setPath("");
      onSuccess?.();
      onClose();
    } catch (e) {
      console.error("Failed to create library:", e);
    }
    setCreating(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-bg-secondary rounded-lg border border-border shadow-xl w-[440px]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-medium">Create Library</h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-bg-tertiary text-text-secondary"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <p className="text-sm text-text-secondary">
            A library is where your assets will be stored. Create one to get started.
          </p>

          <div>
            <label className="block text-sm font-medium mb-1.5">Library Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Game Assets"
              className="w-full px-3 py-2 text-sm bg-bg rounded-lg border border-border focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Location</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder="/path/to/library"
                className="flex-1 px-3 py-2 text-sm bg-bg rounded-lg border border-border focus:border-primary focus:outline-none"
              />
              <button
                onClick={handleSelectFolder}
                className="px-3 py-2 bg-bg-tertiary text-text-primary rounded-lg hover:bg-border transition-colors"
              >
                <FolderOpen size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-4 py-3 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!name || !path || creating}
            className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-hover disabled:opacity-50 transition-colors"
          >
            {creating ? "Creating..." : "Create Library"}
          </button>
        </div>
      </div>
    </div>
  );
}
