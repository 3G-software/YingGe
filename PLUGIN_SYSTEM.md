# YingGe Plugin System

## Overview

YingGe supports a plugin system that allows you to extend the application's functionality without modifying the core codebase. Plugins are loaded dynamically at application startup.

## Plugin Loading

Plugins are loaded from two locations:

1. **Development Mode**: Plugins in the project's `plugins/` directory are automatically loaded
2. **Production Mode**: User-installed plugins from the application data directory

This allows developers to test plugins during development without needing to package and import them.

## Plugin Structure

A plugin is a ZIP file containing:

```
plugin-name.zip
├── manifest.json    # Plugin metadata and configuration
├── index.js         # Plugin entry point
└── ...             # Additional files (optional)
```

### manifest.json

```json
{
  "name": "plugin-name",
  "version": "1.0.0",
  "description": "Plugin description",
  "author": "Author Name",
  "license": "MIT",
  "entry": "index.js",
  "permissions": [
    "asset:read",
    "asset:write",
    "processing:crop"
  ],
  "actions": [
    {
      "id": "action-id",
      "label": {
        "en": "Action Label",
        "zh": "操作标签"
      },
      "description": {
        "en": "Action description",
        "zh": "操作描述"
      },
      "icon": "icon-name",
      "context": "asset-single"
    }
  ],
  "i18n": {
    "en": {
      "key": "English translation"
    },
    "zh": {
      "key": "中文翻译"
    }
  },
  "settings": []
}
```

### index.js

```javascript
// Plugin entry point
(function(context, exports) {
  const { api, ui, i18n } = context;

  // Define action handlers
  exports['action-id'] = async function(assetId) {
    try {
      // Get asset data
      const asset = await api.getAsset(assetId);

      // Perform operation
      const result = await api.invoke('your_command', {
        assetId,
        // ... other parameters
      });

      // Show success notification
      ui.showNotification({
        type: 'success',
        message: i18n.t('successKey')
      });
    } catch (error) {
      ui.showNotification({
        type: 'error',
        message: `${i18n.t('errorKey')}: ${error.message}`
      });
    }
  };
})(context, exports);
```

## Plugin API

### context.api

- `invoke(command, args)` - Call Tauri commands
- `getAsset(id)` - Get asset by ID
- `updateAsset(id, data)` - Update asset data

### context.ui

- `showNotification(options)` - Show notification
  - `type`: 'success' | 'error' | 'info' | 'warning'
  - `message`: Notification message

### context.i18n

- `t(key)` - Translate key to current locale
- `locale` - Current locale (en, zh, etc.)

## Action Contexts

- `asset-single` - Action available for single asset selection
- `asset-multiple` - Action available for multiple asset selection
- `global` - Action always available

## Installing Plugins

1. Go to **Plugins** → **Plugin Manager** in the menu
2. Click **Import Plugin**
3. Select the plugin ZIP file
4. The plugin will be extracted and loaded automatically

## Uninstalling Plugins

1. Go to **Plugins** → **Plugin Manager**
2. Find the plugin you want to remove
3. Click **Uninstall**

## Example: Crop Image Plugin

See `/plugins/crop-image-plugin/` for a complete example of a plugin that adds image cropping functionality.

## Packaging Plugins for Distribution

To package a plugin for distribution:

```bash
cd plugins
zip -r your-plugin-name.zip your-plugin-name/ -x "*.DS_Store"
```

The ZIP file can then be shared with users who can import it via the Plugin Manager.

## Development Workflow

1. Create your plugin in the `plugins/` directory
2. Restart the application to load the plugin
3. Test the plugin functionality
4. When ready, package as ZIP for distribution

## Development Tips

1. Test your plugin thoroughly before distribution
2. Use clear, descriptive action IDs and labels
3. Provide translations for all user-facing text
4. Handle errors gracefully and show meaningful error messages
5. Request only the permissions your plugin needs
6. Keep the plugin size small by including only necessary files

## Plugin Permissions

- `asset:read` - Read asset data
- `asset:write` - Modify asset data
- `processing:*` - Access to processing commands (crop, compress, etc.)

## Troubleshooting

- **Plugin not loading**: Check that manifest.json is valid JSON
- **Action not appearing**: Verify the action context matches your use case
- **Errors in console**: Check the browser console for JavaScript errors
- **Command not found**: Ensure the backend command is registered in Tauri
