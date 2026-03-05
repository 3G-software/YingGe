# YingGe 插件开发 API 文档

## 概述

YingGe 插件系统允许开发者通过 JavaScript 扩展应用功能。插件可以：
- 调用后端 API 操作资源（图片、标签等）
- 显示通知
- 触发自定义事件
- 访问国际化翻译

## 插件结构

```
my-plugin/
├── manifest.json    # 插件配置文件
├── index.js         # 插件入口文件
└── README.md        # 插件说明文档
```

## manifest.json 配置

```json
{
  "name": "my-plugin",
  "displayName": {
    "en": "My Plugin",
    "zh": "我的插件"
  },
  "version": "1.0.0",
  "description": "Plugin description",
  "author": "Your Name",
  "license": "MIT",
  "entry": "index.js",
  "permissions": [
    "asset:read",
    "asset:write",
    "processing:*"
  ],
  "actions": [
    {
      "id": "my-action",
      "label": {
        "en": "My Action",
        "zh": "我的操作"
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
      "success": "Operation successful",
      "failed": "Operation failed"
    },
    "zh": {
      "success": "操作成功",
      "failed": "操作失败"
    }
  }
}
```

### 字段说明

- `name`: 插件唯一标识符（必需）
- `displayName`: 插件显示名称，支持多语言（必需）
- `version`: 插件版本号（必需）
- `entry`: 入口文件路径（必需）
- `permissions`: 插件所需权限列表
- `actions`: 插件提供的操作列表
  - `context`: 操作上下文
    - `asset-single`: 单个资源选中时可用
    - `asset-multiple`: 多个资源选中时可用
    - `global`: 始终可用

## 插件入口文件 (index.js)

```javascript
/**
 * 插件入口文件
 * 通过 exports 导出操作处理函数
 */

// 定义操作处理函数
exports['my-action'] = async function(assetId) {
  const { api, ui, i18n } = context;

  try {
    // 1. 获取资源信息
    const asset = await api.getAsset(assetId);
    console.log('Asset:', asset);

    // 2. 调用后端 API 处理
    const result = await api.invoke('my_backend_command', {
      assetId: assetId,
      param1: 'value1'
    });

    // 3. 显示成功通知
    ui.showNotification({
      type: 'success',
      message: i18n.t('success')
    });

  } catch (error) {
    console.error('Error:', error);
    ui.showNotification({
      type: 'error',
      message: i18n.t('failed') + ': ' + error.message
    });
  }
};

// 全局操作（从菜单触发）
exports['global-action'] = async function() {
  const { ui } = context;

  // 触发自定义事件打开对话框
  window.dispatchEvent(new CustomEvent('plugin-open-dialog', {
    detail: {
      pluginName: 'my-plugin',
      // 可以传递额外参数
      customData: { foo: 'bar' }
    }
  }));
};

console.log('[MyPlugin] Plugin loaded successfully');
```

## Context API

插件通过 `context` 对象访问应用功能：

### 1. API 对象 (`context.api`)

#### `api.invoke(command, args)`
调用后端 Tauri 命令

```javascript
// 示例：调用自定义后端命令
const result = await api.invoke('my_command', {
  param1: 'value',
  param2: 123
});
```

#### `api.getAsset(id)`
获取资源详细信息

```javascript
const asset = await api.getAsset(assetId);
// 返回：
// {
//   id: number,
//   name: string,
//   file_path: string,
//   file_type: string,
//   file_size: number,
//   width: number,
//   height: number,
//   ...
// }
```

#### `api.updateAsset(id, data)`
更新资源信息

```javascript
await api.updateAsset(assetId, {
  name: 'new-name.png',
  description: 'Updated description'
});
```

### 2. UI 对象 (`context.ui`)

#### `ui.showNotification(options)`
显示通知消息

```javascript
ui.showNotification({
  type: 'success',  // 'success' | 'error' | 'info' | 'warning'
  message: 'Operation completed'
});
```

### 3. I18n 对象 (`context.i18n`)

#### `i18n.t(key)`
获取翻译文本

```javascript
const message = i18n.t('success');
// 根据当前语言返回对应翻译
```

#### `i18n.locale`
当前语言代码

```javascript
const currentLang = i18n.locale; // 'en' 或 'zh'
```

## 后端 API 命令

### 资源管理

#### `get_asset_detail`
获取资源详细信息

```javascript
const asset = await api.invoke('get_asset_detail', { id: assetId });
```

#### `get_asset_file_path`
获取资源文件路径

```javascript
const filePath = await api.invoke('get_asset_file_path', { id: assetId });
```

#### `rename_asset`
重命名资源

```javascript
await api.invoke('rename_asset', {
  id: assetId,
  newName: 'new-name.png'
});
```

#### `update_description`
更新资源描述

```javascript
await api.invoke('update_description', {
  id: assetId,
  description: 'New description'
});
```

#### `delete_assets`
删除资源

```javascript
await api.invoke('delete_assets', {
  libraryId: libraryId,
  assetIds: [assetId1, assetId2]
});
```

### 图片处理

#### `crop_image`
裁剪图片

```javascript
await api.invoke('crop_image', {
  assetId: assetId,
  x: 100,
  y: 100,
  width: 500,
  height: 500
});
```

#### `resize_image`
调整图片尺寸

```javascript
await api.invoke('resize_image', {
  assetIds: [assetId],
  width: 800,
  height: 600,
  maintainAspectRatio: true
});
```

#### `compress_image`
压缩图片

```javascript
await api.invoke('compress_image', {
  assetIds: [assetId],
  quality: 80
});
```

#### `remove_background`
移除背景

```javascript
await api.invoke('remove_background', {
  assetIds: [assetId]
});
```

#### `save_edited_image`
保存编辑后的图片

```javascript
await api.invoke('save_edited_image', {
  assetId: assetId,
  imageData: base64ImageData
});
```

### 标签管理

#### `create_tag`
创建标签

```javascript
const tag = await api.invoke('create_tag', {
  libraryId: libraryId,
  name: 'tag-name',
  color: '#FF0000'
});
```

#### `assign_tags`
为资源分配标签

```javascript
await api.invoke('assign_tags', {
  assetIds: [assetId],
  tagIds: [tagId1, tagId2]
});
```

#### `remove_tags`
移除资源标签

```javascript
await api.invoke('remove_tags', {
  assetIds: [assetId],
  tagIds: [tagId1]
});
```

## 事件系统

### 触发对话框

插件可以触发自定义事件来打开对话框：

```javascript
window.dispatchEvent(new CustomEvent('plugin-open-dialog', {
  detail: {
    pluginName: 'my-plugin',
    assetId: assetId,  // 可选
    customData: {}     // 可选的自定义数据
  }
}));
```

**注意**：对话框 UI 需要插件自己实现（HTML/CSS/JS），主应用只负责触发事件。

### 监听应用事件

```javascript
// 监听资源更新事件
window.addEventListener('asset-updated', (event) => {
  console.log('Asset updated:', event.detail);
});
```

## 完整示例：图片旋转插件

```javascript
// rotate-image-plugin/index.js

exports['rotate-90'] = async function(assetId) {
  const { api, ui, i18n } = context;

  try {
    // 获取资源文件路径
    const filePath = await api.invoke('get_asset_file_path', { id: assetId });

    // 调用后端旋转命令
    await api.invoke('rotate_image', {
      assetId: assetId,
      angle: 90
    });

    ui.showNotification({
      type: 'success',
      message: i18n.t('rotateSuccess')
    });

  } catch (error) {
    console.error('Rotate failed:', error);
    ui.showNotification({
      type: 'error',
      message: i18n.t('rotateFailed') + ': ' + error.message
    });
  }
};

exports['rotate-180'] = async function(assetId) {
  // 类似实现
};

exports['rotate-270'] = async function(assetId) {
  // 类似实现
};
```

## 权限系统

插件需要在 manifest.json 中声明所需权限：

```json
{
  "permissions": [
    "asset:read",      // 读取资源信息
    "asset:write",     // 修改资源
    "asset:delete",    // 删除资源
    "tag:read",        // 读取标签
    "tag:write",       // 创建/修改标签
    "processing:*",    // 所有图片处理操作
    "library:read",    // 读取资源库信息
    "library:write"    // 修改资源库
  ]
}
```

## 调试

### 控制台日志

```javascript
console.log('[MyPlugin] Debug message');
console.error('[MyPlugin] Error:', error);
```

### 错误处理

```javascript
try {
  await api.invoke('some_command', { ... });
} catch (error) {
  console.error('Command failed:', error);
  // 显示用户友好的错误消息
  ui.showNotification({
    type: 'error',
    message: 'Operation failed: ' + error.message
  });
}
```

## 最佳实践

1. **错误处理**：始终使用 try-catch 包裹 API 调用
2. **用户反馈**：操作完成后显示通知
3. **日志记录**：使用带插件名前缀的日志便于调试
4. **权限最小化**：只申请必需的权限
5. **国际化**：支持多语言
6. **异步操作**：使用 async/await 处理异步调用

## 发布插件

1. 将插件打包为 ZIP 文件
2. 用户通过"插件管理"导入 ZIP 文件
3. 插件自动安装到用户数据目录

## 限制

- 插件运行在沙箱环境中
- 只能访问声明的权限
- 不能直接访问文件系统（需通过 API）
- 不能执行任意系统命令

## 支持

- GitHub Issues: [项目地址]
- 文档: [文档地址]
- 示例插件: `plugins/crop-image-plugin/`
