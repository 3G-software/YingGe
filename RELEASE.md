# YingGe 发布指南

本文档说明如何发布 YingGe 桌面应用的新版本。

## 🚀 发布流程

### 1. 本地构建（可选）

在推送版本之前，可以先在本地测试构建：

**macOS/Linux:**
```bash
./build.sh
```

**Windows:**
```cmd
build.bat
```

构建产物位置：
- **macOS**: `src-tauri/target/release/bundle/dmg/`
- **Windows**: `src-tauri/target/release/bundle/msi/`
- **Linux**: `src-tauri/target/release/bundle/deb/` 和 `appimage/`

### 2. 更新版本号

在发布前需要同步更新以下文件中的版本号：

1. **package.json**
   ```json
   {
     "version": "0.2.0"
   }
   ```

2. **src-tauri/tauri.conf.json**
   ```json
   {
     "version": "0.2.0"
   }
   ```

3. **src-tauri/Cargo.toml**
   ```toml
   [package]
   version = "0.2.0"
   ```

### 3. 创建版本标签

```bash
# 提交所有更改
git add .
git commit -m "chore: bump version to 0.2.0"

# 创建版本标签
git tag v0.2.0

# 推送代码和标签
git push origin main
git push origin v0.2.0
```

### 4. 自动构建和发布

推送标签后，GitHub Actions 会自动：

1. ✅ 在 macOS、Windows、Linux 上构建应用
2. ✅ 创建 GitHub Release（草稿）
3. ✅ 上传所有平台的安装包

### 5. 完善 Release 说明

访问 [GitHub Releases](https://github.com/ojwftded/YingGe/releases)：

1. 找到自动创建的草稿 Release
2. 编辑 Release 说明，添加更新日志：
   ```markdown
   ## 🎉 新功能
   - 添加 AI 标签多语言支持
   - 优化导入导出功能

   ## 🐛 Bug 修复
   - 修复 embedding API URL 问题
   - 修复导入导出路径错误

   ## 📥 下载
   请根据您的系统选择对应的安装包：
   - **macOS**: YingGe_0.2.0_aarch64.dmg (Apple Silicon) 或 YingGe_0.2.0_x64.dmg (Intel)
   - **Windows**: YingGe_0.2.0_x64-setup.exe
   - **Linux**: YingGe_0.2.0_amd64.deb 或 YingGe_0.2.0_amd64.AppImage
   ```
3. 点击 "Publish release" 发布

## 📦 手动发布（不推荐）

如果需要手动上传到 GitHub Releases：

1. 使用本地构建脚本生成安装包
2. 在 GitHub 上创建新的 Release
3. 手动上传构建产物

## 🔧 常见问题

### Q: macOS 上提示"无法打开，因为无法验证开发者"

A: 用户需要在"系统偏好设置 > 安全性与隐私"中允许，或者你需要对应用进行代码签名。

代码签名步骤（需要 Apple 开发者账号）：
```bash
# 在 tauri.conf.json 中配置
"bundle": {
  "macOS": {
    "signingIdentity": "Developer ID Application: Your Name (TEAM_ID)"
  }
}
```

### Q: Windows 上提示"Windows 已保护你的电脑"

A: 用户需要点击"更多信息"然后"仍要运行"，或者你需要购买代码签名证书。

### Q: 构建失败怎么办？

A: 检查 GitHub Actions 日志，常见问题：
- 依赖安装失败：检查网络连接
- Rust 编译错误：确保本地能正常构建
- 前端构建错误：运行 `npm run build` 查看详细错误

## 📝 版本命名规范

遵循语义化版本控制（Semantic Versioning）：

- **主版本号 (Major)**: 不兼容的 API 修改
- **次版本号 (Minor)**: 向后兼容的功能性新增
- **修订号 (Patch)**: 向后兼容的问题修正

示例：
- `v0.1.0` → `v0.2.0`: 新增功能
- `v0.2.0` → `v0.2.1`: Bug 修复
- `v0.2.1` → `v1.0.0`: 重大更新

## 🎯 发布检查清单

发布前确认：

- [ ] 所有测试通过
- [ ] 更新了所有文件中的版本号
- [ ] 更新了 CHANGELOG.md
- [ ] 本地构建测试通过
- [ ] 提交了所有代码更改
- [ ] 创建并推送了版本标签
- [ ] 检查 GitHub Actions 构建状态
- [ ] 完善了 Release 说明
- [ ] 测试了下载链接

## 🔗 相关链接

- [Tauri 官方文档](https://tauri.app/v1/guides/building/)
- [GitHub Actions 文档](https://docs.github.com/en/actions)
- [语义化版本控制](https://semver.org/lang/zh-CN/)
