use tauri::{AppHandle, Manager, menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder}};
use crate::commands::plugin;

#[tauri::command]
pub async fn update_menu_language(app: AppHandle, language: String) -> Result<(), String> {
    let _window = app.get_webview_window("main")
        .ok_or("Failed to get main window")?;

    // Determine menu text based on language
    let (settings_text, library_mgmt_text, file_text, edit_text, import_text, export_library_text, import_library_text,
         tags_text, tag_mgmt_text,
         tools_text, remove_bg_text, image_editor_text, merge_sprite_text, split_img_text, compress_img_text, resize_img_text,
         plugins_text, plugin_manager_text, help_text, about_text, plugin_dev_text, reset_app_text) =
        if language == "en" {
            ("Settings", "Library Management", "File", "Edit", "Import", "Export Library", "Import Library",
             "Tags", "Tag Management",
             "Tools", "Remove Background", "Image Editor", "Merge Spritesheet", "Split Image", "Compress Image", "Resize Image",
             "Plugins", "Plugin Manager", "Help", "About", "Plugin Development Guide", "Reset Application")
        } else {
            // Default to Chinese
            ("设置", "资源库管理", "文件", "编辑", "导入", "导出资源库", "导入资源库",
             "标签", "标签管理",
             "工具", "移除背景", "图片编辑器", "合并精灵图", "分割图片", "压缩图片", "调整尺寸",
             "插件", "插件管理", "帮助", "关于", "插件开发指导", "重置应用程序")
        };

    // Create App menu (YingGe)
    let settings_item = MenuItemBuilder::with_id("settings", settings_text).build(&app)
        .map_err(|e| e.to_string())?;
    let library_mgmt_item = MenuItemBuilder::with_id("library-management", library_mgmt_text).build(&app)
        .map_err(|e| e.to_string())?;
    let app_menu = SubmenuBuilder::new(&app, "YingGe")
        .item(&settings_item)
        .item(&library_mgmt_item)
        .build()
        .map_err(|e| e.to_string())?;

    // Create File menu
    let import_item = MenuItemBuilder::with_id("import", import_text).build(&app)
        .map_err(|e| e.to_string())?;
    let export_library_item = MenuItemBuilder::with_id("export-library", export_library_text).build(&app)
        .map_err(|e| e.to_string())?;
    let import_library_item = MenuItemBuilder::with_id("import-library", import_library_text).build(&app)
        .map_err(|e| e.to_string())?;
    let file_menu = SubmenuBuilder::new(&app, file_text)
        .item(&import_item)
        .separator()
        .item(&export_library_item)
        .item(&import_library_item)
        .build()
        .map_err(|e| e.to_string())?;

    // Create Edit menu with standard shortcuts
    let edit_menu = SubmenuBuilder::new(&app, edit_text)
        .item(&PredefinedMenuItem::undo(&app, None).map_err(|e| e.to_string())?)
        .item(&PredefinedMenuItem::redo(&app, None).map_err(|e| e.to_string())?)
        .separator()
        .item(&PredefinedMenuItem::cut(&app, None).map_err(|e| e.to_string())?)
        .item(&PredefinedMenuItem::copy(&app, None).map_err(|e| e.to_string())?)
        .item(&PredefinedMenuItem::paste(&app, None).map_err(|e| e.to_string())?)
        .item(&PredefinedMenuItem::select_all(&app, None).map_err(|e| e.to_string())?)
        .build()
        .map_err(|e| e.to_string())?;

    // Create Tags menu
    let tag_management_item = MenuItemBuilder::with_id("tag-management", tag_mgmt_text).build(&app)
        .map_err(|e| e.to_string())?;
    let tags_menu = SubmenuBuilder::new(&app, tags_text)
        .item(&tag_management_item)
        .build()
        .map_err(|e| e.to_string())?;

    // Create Tools menu with specific tools
    let remove_bg_item = MenuItemBuilder::with_id("remove-background", remove_bg_text).build(&app)
        .map_err(|e| e.to_string())?;
    let image_editor_item = MenuItemBuilder::with_id("image-editor", image_editor_text).build(&app)
        .map_err(|e| e.to_string())?;
    let merge_sprite_item = MenuItemBuilder::with_id("merge-spritesheet", merge_sprite_text).build(&app)
        .map_err(|e| e.to_string())?;
    let split_image_item = MenuItemBuilder::with_id("split-image", split_img_text).build(&app)
        .map_err(|e| e.to_string())?;
    let compress_image_item = MenuItemBuilder::with_id("compress-image", compress_img_text).build(&app)
        .map_err(|e| e.to_string())?;
    let resize_image_item = MenuItemBuilder::with_id("resize-image", resize_img_text).build(&app)
        .map_err(|e| e.to_string())?;
    let tools_menu = SubmenuBuilder::new(&app, tools_text)
        .item(&remove_bg_item)
        .item(&image_editor_item)
        .item(&merge_sprite_item)
        .item(&split_image_item)
        .item(&compress_image_item)
        .item(&resize_image_item)
        .build()
        .map_err(|e| e.to_string())?;

    // Create Plugins menu
    let plugin_manager_item = MenuItemBuilder::with_id("plugin-manager", plugin_manager_text).build(&app)
        .map_err(|e| e.to_string())?;
    let mut plugins_menu_builder = SubmenuBuilder::new(&app, plugins_text)
        .item(&plugin_manager_item);

    // Add dynamic plugin menu items
    if let Ok(plugin_items) = plugin::get_plugin_menu_items(app.clone()) {
        if !plugin_items.is_empty() {
            plugins_menu_builder = plugins_menu_builder.separator();
            for plugin_item in plugin_items {
                // Use appropriate display name based on language
                let display_name = if language == "en" {
                    plugin_item.display_name_en.unwrap_or_else(|| plugin_item.name.clone())
                } else {
                    plugin_item.display_name_zh.unwrap_or_else(|| plugin_item.name.clone())
                };
                let item = MenuItemBuilder::with_id(&plugin_item.id, &display_name).build(&app)
                    .map_err(|e| e.to_string())?;
                plugins_menu_builder = plugins_menu_builder.item(&item);
            }
        }
    }
    let plugins_menu = plugins_menu_builder.build()
        .map_err(|e| e.to_string())?;

    // Create Help menu
    let about_item = MenuItemBuilder::with_id("about", about_text).build(&app)
        .map_err(|e| e.to_string())?;
    let plugin_dev_guide_item = MenuItemBuilder::with_id("plugin-dev-guide", plugin_dev_text).build(&app)
        .map_err(|e| e.to_string())?;
    let reset_app_item = MenuItemBuilder::with_id("reset-app", reset_app_text).build(&app)
        .map_err(|e| e.to_string())?;
    let help_menu = SubmenuBuilder::new(&app, help_text)
        .item(&about_item)
        .item(&plugin_dev_guide_item)
        .separator()
        .item(&reset_app_item)
        .build()
        .map_err(|e| e.to_string())?;

    // Build and set the menu
    let menu = MenuBuilder::new(&app)
        .item(&app_menu)
        .item(&file_menu)
        .item(&edit_menu)
        .item(&tags_menu)
        .item(&tools_menu)
        .item(&plugins_menu)
        .item(&help_menu)
        .build()
        .map_err(|e| e.to_string())?;

    app.set_menu(menu)
        .map_err(|e| e.to_string())?;

    Ok(())
}
