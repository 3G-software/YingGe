# YingGe 影阁

A cross-platform desktop application for game asset management with AI-powered tagging and semantic search.

## Features

- **Asset Management**: Import and organize images, audio, and other game assets in a local library
- **AI Auto-Tagging**: Automatically analyze assets using vision AI models (OpenAI-compatible API) to generate tags and descriptions
- **Semantic Search**: Find assets using natural language queries (e.g., "assets for a parkour game")
- **Tag System**: Create, manage, and filter assets by tags with full-text search
- **Processing Tools**:
  - Remove image background (color-key method)
  - Merge images into sprite sheets with game engine descriptors (Unity, Godot, Cocos2d)
  - Split images into grid sub-images
- **Plugin System**: Extend functionality with JavaScript/TypeScript plugins
- **Folder Browsing**: Organize assets in virtual folders

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop Framework | Tauri v2 (Rust backend) |
| Frontend | React 19 + TypeScript + Vite |
| UI | Tailwind CSS v4 + Lucide Icons |
| State Management | Zustand + TanStack Query |
| Database | SQLite (sqlx) + FTS5 |
| AI Integration | OpenAI-compatible API (configurable) |

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- [Rust](https://www.rust-lang.org/tools/install) >= 1.70
- Platform-specific dependencies for [Tauri v2](https://v2.tauri.app/start/prerequisites/)

### Setup

```bash
# Install dependencies
npm install

# Run in development mode
npm run tauri dev

# Build for production
npm run tauri build
```

### Project Structure

```
YingGe/
├── src-tauri/          # Rust backend (Tauri commands, DB, AI, processing)
│   ├── src/
│   │   ├── commands/   # Tauri command handlers
│   │   ├── db/         # SQLite database layer
│   │   ├── ai/         # AI provider abstraction
│   │   ├── processing/ # Image processing tools
│   │   ├── storage/    # File operations, thumbnails
│   │   └── plugin_system/
│   └── migrations/     # SQL migration scripts
├── src/                # React frontend
│   ├── components/     # UI components
│   ├── hooks/          # React hooks (data fetching)
│   ├── stores/         # Zustand state stores
│   ├── services/       # Tauri invoke wrappers
│   └── types/          # TypeScript type definitions
└── plugins/            # Built-in example plugins
```

## AI Configuration

YingGe supports any OpenAI-compatible API endpoint. Configure in Settings:

1. API Endpoint (e.g., `https://api.openai.com/v1`)
2. API Key
3. Vision Model (e.g., `gpt-4o`) for asset tagging
4. Embedding Model (e.g., `text-embedding-3-small`) for semantic search

## Contributing

Contributions are welcome. All contributors must agree to the [Contributor License Agreement](CLA.md) by signing off their commits.

```bash
git commit -s -m "Your commit message"
```

## License

This project is licensed under [CC BY-NC-SA 4.0](LICENSE).

The original author reserves the right to offer this software under alternative commercial licenses.
