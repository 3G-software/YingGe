# YingGe 快速发布指南 🚀

## 📦 方式一：自动发布（推荐）

### 1️⃣ 更新版本号

需要同时更新三个文件：

**package.json**
```json
{
  "version": "0.2.0"
}
```

**src-tauri/tauri.conf.json**
```json
{
  "version": "0.2.0"
}
```

**src-tauri/Cargo.toml**
```toml
[package]
version = "0.2.0"
```

### 2️⃣ 提交并创建标签

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

### 3️⃣ 等待自动构建

推送标签后，GitHub Actions 会自动：
- ✅ 在 macOS (Intel + Apple Silicon)、Windows、Linux 上构建
- ✅ 创建 GitHub Release 草稿
- ✅ 上传所有平台的安装包

### 4️⃣ 发布 Release

1. 访问 https://github.com/ojwftded/YingGe/releases
2. 找到自动创建的草稿
3. 编辑 Release 说明（参考 CHANGELOG.md）
4. 点击 "Publish release"

## 🛠️ 方式二：本地打包

### macOS/Linux

```bash
./build.sh
```

### Windows

```cmd
build.bat
```

构建完成后，安装包位于：
- macOS: `src-tauri/target/release/bundle/dmg/`
- Windows: `src-tauri/target/release/bundle/msi/`
- Linux: `src-tauri/target/release/bundle/deb/`

## 📝 更新日志示例

在发布 Release 时，添加类似这样的说明：

```markdown
## 🎉 新功能
- AI 标签支持中文/英文自动切换
- 新增资源库导入导出功能

## 🐛 Bug 修复
- 修复 embedding API URL 问题
- 修复导入非图片文件的提示

## 📥 下载

选择对应平台的安装包：
- **macOS Apple Silicon**: YingGe_0.2.0_aarch64.dmg
- **macOS Intel**: YingGe_0.2.0_x64.dmg
- **Windows**: YingGe_0.2.0_x64-setup.exe
- **Linux DEB**: YingGe_0.2.0_amd64.deb
- **Linux AppImage**: YingGe_0.2.0_amd64.AppImage
```

## 🔍 检查清单

发布前确认：
- [ ] 版本号已更新（3个文件）
- [ ] CHANGELOG.md 已更新
- [ ] 本地测试通过
- [ ] 所有代码已提交
- [ ] 标签已推送
- [ ] GitHub Actions 构建成功
- [ ] Release 说明已完善

## 📚 详细文档

- [RELEASE.md](RELEASE.md) - 完整发布指南
- [CHANGELOG.md](CHANGELOG.md) - 版本更新日志

---

**第一次发布流程示例：**

```bash
# 1. 确保所有更改已提交
git status

# 2. 创建并推送标签
git tag v0.1.0
git push origin main
git push origin v0.1.0

# 3. 等待 5-15 分钟（GitHub Actions 构建时间）

# 4. 访问 https://github.com/ojwftded/YingGe/releases
#    完善并发布 Release
```

就是这么简单！🎉
