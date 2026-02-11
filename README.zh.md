# YingGe 影阁

[English](README.md) | [中文](README.zh.md)

一个跨平台的游戏资源管理桌面应用，支持 AI 自动标签和语义搜索。

## 功能特性

- **资源管理**：在本地资源库中导入和组织图片、音频和视频文件
- **文件夹组织**：创建嵌套文件夹结构，支持拖放操作
  - 右键菜单快速操作（导入、创建文件夹、重命名）
  - 可展开/折叠的文件夹树，层级清晰
  - 直接导入资源到指定文件夹
- **AI 自动标签**：使用视觉 AI 模型（兼容 OpenAI API）自动分析资源，生成标签和描述
- **语义搜索**：使用自然语言查询查找资源（例如："适合跑酷游戏的资源"）
- **标签系统**：创建、管理和按标签筛选资源，支持全文搜索
- **处理工具**：
  - 移除图片背景（色键方法）
  - 合并图片为精灵图，支持游戏引擎描述符（Unity、Godot、Cocos2d）
  - 将图片分割为网格子图
- **插件系统**：使用 JavaScript/TypeScript 插件扩展功能
- **国际化**：内置英文和中文支持

## 技术栈

| 层级 | 技术 |
|------|------|
| 桌面框架 | Tauri v2 (Rust 后端) |
| 前端 | React 19 + TypeScript + Vite |
| UI | Tailwind CSS v4 + Lucide Icons |
| 状态管理 | Zustand + TanStack Query |
| 数据库 | SQLite (sqlx) + FTS5 |
| AI 集成 | OpenAI 兼容 API（可配置）|

## 开发

### 前置要求

- [Node.js](https://nodejs.org/) >= 18
- [Rust](https://www.rust-lang.org/tools/install) >= 1.70
- [Tauri v2](https://v2.tauri.app/start/prerequisites/) 平台特定依赖

### 设置

```bash
# 安装依赖
npm install

# 开发模式运行
npm run tauri dev

# 生产构建
npm run tauri build

# 重置数据库（用于测试）
npm run reset-db
```

### 项目结构

```
YingGe/
├── src-tauri/          # Rust 后端（Tauri 命令、数据库、AI、处理）
│   ├── src/
│   │   ├── commands/   # Tauri 命令处理器
│   │   ├── db/         # SQLite 数据库层
│   │   ├── ai/         # AI 提供商抽象
│   │   ├── processing/ # 图像处理工具
│   │   ├── storage/    # 文件操作、缩略图
│   │   └── plugin_system/
│   └── migrations/     # SQL 迁移脚本
├── src/                # React 前端
│   ├── components/     # UI 组件
│   ├── hooks/          # React hooks（数据获取）
│   ├── stores/         # Zustand 状态存储
│   ├── services/       # Tauri 调用封装
│   ├── i18n/           # 国际化
│   └── types/          # TypeScript 类型定义
└── plugins/            # 内置示例插件
```

## 使用说明

### 创建资源库

1. 点击侧边栏"资源库"旁边的"+"按钮
2. 输入资源库名称（例如："我的游戏资源"）
3. 选择基础目录路径
4. 将在指定路径下创建一个以资源库名称命名的文件夹

### 组织资源

- **导入资源**：右键点击任意文件夹，选择"导入"来添加文件
- **创建文件夹**：右键选择"创建文件夹"来组织资源
- **重命名文件夹**：右键点击文件夹，选择"重命名"
- **嵌套文件夹**：右键点击父文件夹创建子文件夹

### AI 配置

YingGe 支持任何兼容 OpenAI 的 API 端点。在设置中配置：

1. API 端点（例如：`https://api.openai.com/v1`）
2. API 密钥
3. 视觉模型（例如：`gpt-4o`）用于资源标签
4. 嵌入模型（例如：`text-embedding-3-small`）用于语义搜索

## 贡献

欢迎贡献。所有贡献者必须通过签署提交来同意[贡献者许可协议](CLA.md)。

```bash
git commit -s -m "你的提交信息"
```

## 许可证

本项目采用 [CC BY-NC-SA 4.0](LICENSE) 许可证。

原作者保留以替代商业许可证提供本软件的权利。
