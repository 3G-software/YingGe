import { Eraser, Grid3x3, Scissors } from "lucide-react";

export function ToolsPage() {
  const tools = [
    {
      icon: Eraser,
      name: "Remove Background",
      description: "Remove image background using color-key method",
      hash: "#/tools/bg-remove",
    },
    {
      icon: Grid3x3,
      name: "Sprite Sheet",
      description:
        "Merge multiple images into a sprite sheet with game engine descriptors",
      hash: "#/tools/spritesheet",
    },
    {
      icon: Scissors,
      name: "Split Image",
      description: "Split an image into a grid of sub-images",
      hash: "#/tools/split",
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto max-w-3xl">
      <h1 className="text-xl font-semibold mb-6">Processing Tools</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {tools.map((tool) => (
          <a
            key={tool.name}
            href={tool.hash}
            className="p-4 rounded-lg border border-border bg-bg-secondary hover:border-primary/50 transition-colors"
          >
            <tool.icon size={24} className="text-primary mb-3" />
            <h3 className="text-sm font-medium mb-1">{tool.name}</h3>
            <p className="text-xs text-text-secondary">{tool.description}</p>
          </a>
        ))}
      </div>
    </div>
  );
}
