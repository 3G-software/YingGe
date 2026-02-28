#!/bin/bash

# YingGe 本地打包脚本
# 用途：在本地构建所有平台的安装包

set -e

echo "🚀 开始构建 YingGe 桌面应用..."

# 检查依赖
echo "📦 检查并安装依赖..."
if ! command -v node &> /dev/null; then
    echo "❌ 未找到 Node.js，请先安装"
    exit 1
fi

if ! command -v cargo &> /dev/null; then
    echo "❌ 未找到 Rust，请先安装"
    exit 1
fi

# 安装前端依赖
echo "📥 安装前端依赖..."
npm install

# 构建前端
echo "🔨 构建前端..."
npm run build

# 构建 Tauri 应用
echo "🔨 构建 Tauri 应用..."
npm run tauri:build

echo "✅ 构建完成！"
echo ""
echo "📦 安装包位置："
echo "  macOS: src-tauri/target/release/bundle/dmg/"
echo "  Windows: src-tauri/target/release/bundle/msi/"
echo "  Linux: src-tauri/target/release/bundle/deb/ 和 appimage/"
