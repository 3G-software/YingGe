use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

use crate::error::AppError;

/// List all installed plugins
#[tauri::command]
pub fn list_plugins(app: AppHandle) -> Result<Vec<String>, AppError> {
    let mut plugins = Vec::new();

    // Check development plugins directory (in project root)
    if let Ok(dev_plugins_dir) = get_dev_plugins_dir(&app) {
        println!("Checking dev plugins dir: {:?}", dev_plugins_dir);
        if dev_plugins_dir.exists() {
            println!("Dev plugins dir exists");
            if let Ok(entries) = fs::read_dir(&dev_plugins_dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    println!("Found entry: {:?}", path);
                    if path.is_dir() {
                        let manifest_path = path.join("manifest.json");
                        if manifest_path.exists() {
                            println!("Found plugin manifest: {:?}", manifest_path);
                            if let Some(dir_name) = path.to_str() {
                                plugins.push(dir_name.to_string());
                            }
                        }
                    }
                }
            }
        } else {
            println!("Dev plugins dir does not exist");
        }
    } else {
        println!("Failed to get dev plugins dir");
    }

    // Check user-installed plugins directory (in app data)
    let plugins_dir = get_plugins_dir(&app)?;
    println!("Checking user plugins dir: {:?}", plugins_dir);
    if !plugins_dir.exists() {
        fs::create_dir_all(&plugins_dir)?;
    } else {
        for entry in fs::read_dir(&plugins_dir)? {
            let entry = entry?;
            let path = entry.path();

            if path.is_dir() {
                // Check if manifest.json exists
                let manifest_path = path.join("manifest.json");
                if manifest_path.exists() {
                    if let Some(dir_name) = path.to_str() {
                        plugins.push(dir_name.to_string());
                    }
                }
            }
        }
    }

    println!("Total plugins found: {}", plugins.len());
    Ok(plugins)
}

/// Read a file from a plugin directory
#[tauri::command]
pub fn read_plugin_file(path: String) -> Result<String, AppError> {
    let content = fs::read_to_string(&path)?;
    Ok(content)
}

/// Import a plugin from a ZIP file
#[tauri::command]
pub fn import_plugin(app: AppHandle, zip_path: String) -> Result<(), AppError> {
    let plugins_dir = get_plugins_dir(&app)?;

    if !plugins_dir.exists() {
        fs::create_dir_all(&plugins_dir)?;
    }

    // Extract ZIP file
    let file = fs::File::open(&zip_path)?;
    let mut archive = zip::ZipArchive::new(file)?;

    // Get plugin name from manifest
    let mut plugin_name = String::new();

    for i in 0..archive.len() {
        let mut file = archive.by_index(i)?;
        let file_path = file.name().to_string();

        if file_path.ends_with("manifest.json") {
            let mut content = String::new();
            std::io::Read::read_to_string(&mut file, &mut content)?;

            let manifest: serde_json::Value = serde_json::from_str(&content)?;
            if let Some(name) = manifest.get("name").and_then(|v| v.as_str()) {
                plugin_name = name.to_string();
            }
            break;
        }
    }

    if plugin_name.is_empty() {
        return Err(AppError::InvalidInput(
            "Plugin manifest not found or invalid".to_string(),
        ));
    }

    // Extract to plugins directory
    let plugin_dir = plugins_dir.join(&plugin_name);

    if plugin_dir.exists() {
        return Err(AppError::InvalidInput(format!(
            "Plugin {} is already installed",
            plugin_name
        )));
    }

    fs::create_dir_all(&plugin_dir)?;

    // Reset archive to extract all files
    let file = fs::File::open(&zip_path)?;
    let mut archive = zip::ZipArchive::new(file)?;

    for i in 0..archive.len() {
        let mut file = archive.by_index(i)?;
        let file_path = file.name().to_string();

        if file_path.ends_with('/') {
            continue; // Skip directories
        }

        let out_path = plugin_dir.join(&file_path);

        if let Some(parent) = out_path.parent() {
            fs::create_dir_all(parent)?;
        }

        let mut out_file = fs::File::create(&out_path)?;
        std::io::copy(&mut file, &mut out_file)?;
    }

    Ok(())
}

/// Uninstall a plugin
#[tauri::command]
pub fn uninstall_plugin(app: AppHandle, name: String) -> Result<(), AppError> {
    let plugins_dir = get_plugins_dir(&app)?;
    let plugin_dir = plugins_dir.join(&name);

    if !plugin_dir.exists() {
        return Err(AppError::NotFound(format!("Plugin {} not found", name)));
    }

    fs::remove_dir_all(&plugin_dir)?;

    Ok(())
}

fn get_plugins_dir(app: &AppHandle) -> Result<PathBuf, AppError> {
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Internal(format!("Failed to get app data dir: {}", e)))?;

    Ok(app_dir.join("plugins"))
}

fn get_dev_plugins_dir(app: &AppHandle) -> Result<PathBuf, AppError> {
    // Try to get the current working directory first (works in dev mode)
    if let Ok(mut cwd) = std::env::current_dir() {
        println!("Current working directory: {:?}", cwd);

        // If we're in src-tauri, go up one level
        if cwd.ends_with("src-tauri") {
            cwd.pop();
        }

        let plugins_dir = cwd.join("plugins");
        println!("Trying CWD plugins dir: {:?}", plugins_dir);
        if plugins_dir.exists() {
            return Ok(plugins_dir);
        }
    }

    // Fallback: Get the resource directory (where the app is running from)
    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|e| AppError::Internal(format!("Failed to get resource dir: {}", e)))?;

    println!("Resource dir: {:?}", resource_dir);

    // In development, go up to project root and find plugins directory
    // In production, this will be in the app bundle
    let plugins_dir = resource_dir
        .parent()
        .and_then(|p| p.parent())
        .map(|p| p.join("plugins"))
        .ok_or_else(|| AppError::Internal("Failed to resolve dev plugins dir".to_string()))?;

    Ok(plugins_dir)
}
