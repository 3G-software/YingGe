use tauri::{AppHandle, Manager, menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder}};

#[tauri::command]
pub async fn update_menu_language(app: AppHandle, language: String) -> Result<(), String> {
    let window = app.get_webview_window("main")
        .ok_or("Failed to get main window")?;

    // Determine menu text based on language
    let (settings_text, file_text, import_text, tags_text, tag_mgmt_text,
         tools_text, remove_bg_text, merge_sprite_text, split_img_text,
         plugins_text, import_plugin_text, help_text, about_text, plugin_dev_text) =
        if language == "en" {
            ("Settings", "File", "Import", "Tags", "Tag Management",
             "Tools", "Remove Background", "Merge Spritesheet", "Split Image",
             "Plugins", "Import Plugin", "Help", "About", "Plugin Development Guide")
        } else {
            // Default to Chinese
            ("设置", "文件", "导入", "标签", "标签管理",
             "工具", "移除背景", "合并精灵图", "分割图片",
             "插件", "导入插件", "帮助", "关于", "插件开发指导")
        };

    // Create App menu (YingGe)
    let settings_item = MenuItemBuilder::with_id("settings", settings_text).build(&app)
        .map_err(|e| e.to_string())?;
    let app_menu = SubmenuBuilder::new(&app, "YingGe")
        .item(&settings_item)
        .build()
        .map_err(|e| e.to_string())?;

    // Create File menu
    let import_item = MenuItemBuilder::with_id("import", import_text).build(&app)
        .map_err(|e| e.to_string())?;
    let file_menu = SubmenuBuilder::new(&app, file_text)
        .item(&import_item)
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
    let merge_sprite_item = MenuItemBuilder::with_id("merge-spritesheet", merge_sprite_text).build(&app)
        .map_err(|e| e.to_string())?;
    let split_image_item = MenuItemBuilder::with_id("split-image", split_img_text).build(&app)
        .map_err(|e| e.to_string())?;
    let tools_menu = SubmenuBuilder::new(&app, tools_text)
        .item(&remove_bg_item)
        .item(&merge_sprite_item)
        .item(&split_image_item)
        .build()
        .map_err(|e| e.to_string())?;

    // Create Plugins menu
    let import_plugin_item = MenuItemBuilder::with_id("import-plugin", import_plugin_text).build(&app)
        .map_err(|e| e.to_string())?;
    let plugins_menu = SubmenuBuilder::new(&app, plugins_text)
        .item(&import_plugin_item)
        .build()
        .map_err(|e| e.to_string())?;

    // Create Help menu
    let about_item = MenuItemBuilder::with_id("about", about_text).build(&app)
        .map_err(|e| e.to_string())?;
    let plugin_dev_guide_item = MenuItemBuilder::with_id("plugin-dev-guide", plugin_dev_text).build(&app)
        .map_err(|e| e.to_string())?;
    let help_menu = SubmenuBuilder::new(&app, help_text)
        .item(&about_item)
        .item(&plugin_dev_guide_item)
        .build()
        .map_err(|e| e.to_string())?;

    // Build and set the menu
    let menu = MenuBuilder::new(&app)
        .item(&app_menu)
        .item(&file_menu)
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
