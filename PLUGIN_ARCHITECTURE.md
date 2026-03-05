# 插件系统架构说明

## 插件类型

### 1. 内置插件（Built-in Plugins）
- **位置**：`plugins/` 目录（代码仓库中）
- **特性**：
  - ✅ 可以包含 React 组件（对话框 UI）
  - ✅ 在构建时被打包
  - ✅ 支持完整的 TypeScript/React 功能
  - ✅ 可以使用项目的所有依赖
- **示例**：`plugins/crop-image-plugin/`

### 2. 用户安装插件（User-installed Plugins）
- **位置**：应用数据目录（运行时）
- **特性**：
  - ❌ 不能包含 React 组件
  - ✅ 可以通过 JavaScript 实现功能
  - ✅ 可以触发系统通知
  - ✅ 可以调用后端 API
- **限制原因**：Vite 的 ES modules 只能在构建时静态分析导入

## 插件对话框注册机制

### 工作原理

1. **构建时扫描**
   ```typescript
   const dialogModules = import.meta.glob('../../../plugins/**/*.tsx');
   ```
   - Vite 在构建时扫描 `plugins/` 目录下的所有 `.tsx` 文件
   - 生成一个模块映射表

2. **运行时注册**
   - 应用启动时读取所有插件的 manifest
   - 对于内置插件，根据 manifest 中的 `dialog` 字段匹配对应的组件
   - 自动注册到 `pluginDialogRegistry`

3. **懒加载**
   - 对话框组件只在需要时才加载
   - 使用 React.lazy 和 Suspense

### 添加新的内置插件

1. 在 `plugins/` 目录下创建插件文件夹
2. 创建 `manifest.json`，包含 `dialog` 字段：
   ```json
   {
     "name": "my-plugin",
     "dialog": "MyDialog.tsx",
     ...
   }
   ```
3. 创建对话框组件 `MyDialog.tsx`
4. 重新构建应用 - 插件会自动被发现和注册

## 用户安装插件的替代方案

由于用户安装的插件无法使用 React 组件，可以考虑以下方案：

### 方案 A：配置驱动的 UI
插件通过 JSON 配置定义 UI 结构，主应用提供通用的表单渲染器：

```json
{
  "dialog": {
    "type": "form",
    "fields": [
      { "type": "number", "label": "Width", "id": "width" },
      { "type": "number", "label": "Height", "id": "height" }
    ]
  }
}
```

### 方案 B：Web Components
插件提供独立的 HTML/CSS/JS，通过 Web Components 集成：

```javascript
class MyPluginDialog extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `<div>...</div>`;
  }
}
customElements.define('my-plugin-dialog', MyPluginDialog);
```

### 方案 C：仅功能插件
用户安装的插件只提供后台功能，不提供 UI：
- 通过系统通知反馈
- 通过命令行参数配置
- 使用主应用提供的通用对话框

## 当前实现状态

- ✅ 内置插件完全支持 React 对话框
- ✅ 自动扫描和注册
- ✅ 懒加载和代码分割
- ⚠️ 用户安装插件暂不支持自定义 UI
- 📝 未来可以实现配置驱动的 UI 方案

## 技术限制

### Vite/ES Modules 限制
- `import()` 需要静态可分析的路径
- 无法在运行时动态导入任意路径的模块
- `import.meta.glob` 只能扫描代码目录

### 解决方案对比

| 方案 | 优点 | 缺点 |
|------|------|------|
| 当前方案（内置插件） | 完整的 React 支持 | 需要重新构建 |
| 配置驱动 UI | 运行时安装 | UI 灵活性有限 |
| Web Components | 运行时安装，灵活 | 需要额外的通信机制 |
| iframe | 完全隔离 | 性能开销，通信复杂 |

## 建议

对于大多数用户场景：
1. **常用功能** → 作为内置插件提供
2. **简单工具** → 使用配置驱动 UI
3. **复杂定制** → 提供插件开发指南，让用户贡献到代码仓库
