# Crop Image Plugin

A demo plugin for YingGe that adds image cropping functionality.

## Features

- Select a region on an image by dragging
- Crop the image to the selected region
- Replace the original image with the cropped version

## Installation

1. Copy the `crop-image-plugin` folder to YingGe's plugins directory
2. Restart YingGe
3. The plugin will be automatically loaded

## Usage

1. Select an image in the asset library
2. Right-click and choose "Crop Image" from the context menu
3. Drag to select the region you want to keep
4. Click "Save" to apply the crop

## Plugin Structure

```
crop-image-plugin/
├── manifest.json    # Plugin metadata and configuration
├── index.js         # Main plugin code
└── README.md        # This file
```

## Development Guide

### manifest.json

The manifest file defines the plugin's metadata and configuration:

```json
{
  "name": "crop-image-plugin",
  "version": "1.0.0",
  "description": "A plugin that adds image cropping functionality",
  "author": "YingGe Team",
  "license": "MIT",
  "entry": "index.js",
  "permissions": [
    "asset:read",
    "asset:write",
    "processing:crop"
  ],
  "actions": [
    {
      "id": "crop-image",
      "label": "Crop Image",
      "icon": "crop",
      "context": "asset-single"
    }
  ]
}
```

### Key Fields

- **name**: Unique plugin identifier
- **version**: Plugin version (semver)
- **entry**: Main JavaScript file
- **permissions**: Required permissions for the plugin
- **actions**: UI actions that the plugin provides

### Plugin API

The plugin has access to the following APIs:

#### context.api

- `getAssetFilePath(assetId)`: Get the file path of an asset
- `invoke(command, args)`: Call a Tauri command
- `refreshAssets()`: Refresh the asset list

#### context.ui

- `showCropDialog(filePath)`: Show the crop dialog
- `showNotification(options)`: Show a notification

### Permissions

Plugins must declare the permissions they need:

- `asset:read`: Read asset information
- `asset:write`: Modify assets
- `processing:crop`: Use the crop processing command

### Action Context

Actions can specify when they should be available:

- `asset-single`: Single asset selected
- `asset-multiple`: Multiple assets selected
- `asset-any`: Any number of assets selected

## License

MIT
