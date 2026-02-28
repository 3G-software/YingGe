@echo off
REM YingGe 本地打包脚本 (Windows)
REM 用途：在本地构建 Windows 安装包

echo 🚀 开始构建 YingGe 桌面应用...

REM 检查 Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ 未找到 Node.js，请先安装
    exit /b 1
)

REM 检查 Rust
where cargo >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ 未找到 Rust，请先安装
    exit /b 1
)

REM 安装前端依赖
echo 📥 安装前端依赖...
call npm install

REM 构建前端
echo 🔨 构建前端...
call npm run build

REM 构建 Tauri 应用
echo 🔨 构建 Tauri 应用...
call npm run tauri:build

echo.
echo ✅ 构建完成！
echo.
echo 📦 安装包位置：
echo   src-tauri\target\release\bundle\msi\
echo   src-tauri\target\release\bundle\nsis\
