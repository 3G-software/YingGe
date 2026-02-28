# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- 准备中的新功能

### Changed
- 准备修改的功能

### Fixed
- 准备修复的问题

## [0.1.0] - 2026-02-28

### Added
- ✨ AI 标签多语言支持（根据界面语言生成中文/英文标签）
- ✨ 资源库导入导出功能
- ✨ 图片编辑器和处理工具
- ✨ 自动去背景功能
- ✨ 精灵图合并与拆分
- ✨ AI 语义搜索
- ✨ 资源标签管理
- ✨ 多语言支持（中文/英文）
- ✨ 图片调整尺寸功能
- ✨ 图片压缩功能

### Changed
- 🎨 优化侧边栏：复用 CreateLibraryModal 组件
- 🎨 改进资源导入：过滤不支持的文件类型并提示用户
- ⚡ AI 完成后自动刷新详情页面

### Fixed
- 🐛 修复导入导出库的文件路径错误（multi-library 格式）
- 🐛 修复导入导出时 library root path 设置错误
- 🐛 修复 embedding API URL 构建问题（/chat/completions -> /embeddings）
- 🐛 修复非图片文件导入时的处理
- 🐛 添加 embedding 模型配置提示（警告必须使用 embedding 模型）

### Security
- 🔒 完善文件类型验证

---

## 版本说明

### 图标含义
- ✨ 新功能
- 🎨 UI/UX 改进
- ⚡ 性能优化
- 🐛 Bug 修复
- 🔒 安全性改进
- 📝 文档更新
- 🔧 配置/工具更新

[Unreleased]: https://github.com/ojwftded/YingGe/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/ojwftded/YingGe/releases/tag/v0.1.0
