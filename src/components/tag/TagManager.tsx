import { useState } from "react";
import { Plus, Trash2, Edit2, Save, X } from "lucide-react";
import { useTags, useCreateTag, useDeleteTag } from "../../hooks/useTags";
import { useAppStore } from "../../stores/appStore";
import { renameTag as renameTagApi } from "../../services/tauriBridge";
import { useQueryClient } from "@tanstack/react-query";

export function TagManager() {
  const currentLibrary = useAppStore((s) => s.currentLibrary);
  const { data: tags } = useTags();
  const createTag = useCreateTag();
  const deleteTag = useDeleteTag();
  const queryClient = useQueryClient();

  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#6366f1");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const handleCreate = () => {
    if (newTagName && currentLibrary) {
      createTag.mutate({
        libraryId: currentLibrary.id,
        name: newTagName,
        color: newTagColor,
      });
      setNewTagName("");
    }
  };

  const handleRename = async (id: string) => {
    await renameTagApi(id, editName);
    queryClient.invalidateQueries({ queryKey: ["tags"] });
    setEditingId(null);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-2xl">
      <h1 className="text-xl font-semibold mb-6">Tag Manager</h1>

      {/* Create new tag */}
      <div className="flex gap-2 mb-6">
        <input
          type="text"
          placeholder="New tag name"
          value={newTagName}
          onChange={(e) => setNewTagName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          className="flex-1 px-3 py-2 text-sm bg-bg rounded border border-border focus:border-primary focus:outline-none"
        />
        <input
          type="color"
          value={newTagColor}
          onChange={(e) => setNewTagColor(e.target.value)}
          className="w-10 h-10 rounded border border-border cursor-pointer"
        />
        <button
          onClick={handleCreate}
          disabled={!newTagName || !currentLibrary}
          className="flex items-center gap-1.5 px-4 py-2 text-sm bg-primary text-white rounded hover:bg-primary-hover disabled:opacity-50 transition-colors"
        >
          <Plus size={14} />
          Add
        </button>
      </div>

      {/* Tag list */}
      {!currentLibrary ? (
        <p className="text-text-secondary">Select a library to manage tags</p>
      ) : (
        <div className="space-y-1">
          {tags?.map((tag) => (
            <div
              key={tag.id}
              className="flex items-center justify-between px-3 py-2 rounded hover:bg-bg-secondary transition-colors"
            >
              <div className="flex items-center gap-3">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: tag.color }}
                />
                {editingId === tag.id ? (
                  <div className="flex items-center gap-1">
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="px-2 py-0.5 text-sm bg-bg rounded border border-border focus:border-primary focus:outline-none"
                      autoFocus
                    />
                    <button
                      onClick={() => handleRename(tag.id)}
                      className="p-0.5 rounded text-primary"
                    >
                      <Save size={14} />
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="p-0.5 rounded text-text-secondary"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <span className="text-sm">{tag.name}</span>
                )}
                {tag.is_ai && (
                  <span className="text-xs text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                    AI
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-text-secondary">
                  {tag.asset_count} assets
                </span>
                <button
                  onClick={() => {
                    setEditingId(tag.id);
                    setEditName(tag.name);
                  }}
                  className="p-1 rounded hover:bg-bg-tertiary text-text-secondary"
                >
                  <Edit2 size={14} />
                </button>
                <button
                  onClick={() => deleteTag.mutate(tag.id)}
                  className="p-1 rounded hover:bg-bg-tertiary text-text-secondary hover:text-red-400"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
          {tags?.length === 0 && (
            <p className="text-text-secondary text-sm py-4 text-center">
              No tags yet. Create one above or import assets with AI tagging.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
