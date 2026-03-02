mod ai;
mod commands;
mod db;
mod error;
mod plugin_system;
mod processing;
mod storage;

use ai::provider::AiProviderManager;
use tauri::{Emitter, Manager, menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder}};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .setup(|app| {
            // Create App menu (YingGe)
            let settings_item = MenuItemBuilder::with_id("settings", "设置").build(app)?;
            let library_mgmt_item = MenuItemBuilder::with_id("library-management", "资源库管理").build(app)?;
            let app_menu = SubmenuBuilder::new(app, "YingGe")
                .item(&settings_item)
                .item(&library_mgmt_item)
                .build()?;

            // Create File menu
            let import_item = MenuItemBuilder::with_id("import", "导入").build(app)?;
            let export_library_item = MenuItemBuilder::with_id("export-library", "导出资源库").build(app)?;
            let import_library_item = MenuItemBuilder::with_id("import-library", "导入资源库").build(app)?;
            let file_menu = SubmenuBuilder::new(app, "文件")
                .item(&import_item)
                .separator()
                .item(&export_library_item)
                .item(&import_library_item)
                .build()?;

            // Create Edit menu with standard shortcuts
            let edit_menu = SubmenuBuilder::new(app, "编辑")
                .item(&PredefinedMenuItem::undo(app, None)?)
                .item(&PredefinedMenuItem::redo(app, None)?)
                .separator()
                .item(&PredefinedMenuItem::cut(app, None)?)
                .item(&PredefinedMenuItem::copy(app, None)?)
                .item(&PredefinedMenuItem::paste(app, None)?)
                .item(&PredefinedMenuItem::select_all(app, None)?)
                .build()?;

            // Create Tags menu
            let tag_management_item = MenuItemBuilder::with_id("tag-management", "标签管理").build(app)?;
            let tags_menu = SubmenuBuilder::new(app, "标签")
                .item(&tag_management_item)
                .build()?;

            // Create Tools menu with specific tools
            let remove_bg_item = MenuItemBuilder::with_id("remove-background", "移除背景").build(app)?;
            let image_editor_item = MenuItemBuilder::with_id("image-editor", "图片编辑器").build(app)?;
            let merge_sprite_item = MenuItemBuilder::with_id("merge-spritesheet", "合并精灵图").build(app)?;
            let split_image_item = MenuItemBuilder::with_id("split-image", "分割图片").build(app)?;
            let compress_image_item = MenuItemBuilder::with_id("compress-image", "压缩图片").build(app)?;
            let resize_image_item = MenuItemBuilder::with_id("resize-image", "调整尺寸").build(app)?;
            let tools_menu = SubmenuBuilder::new(app, "工具")
                .item(&remove_bg_item)
                .item(&image_editor_item)
                .item(&merge_sprite_item)
                .item(&split_image_item)
                .item(&compress_image_item)
                .item(&resize_image_item)
                .build()?;

            // Create Plugins menu
            let plugin_manager_item = MenuItemBuilder::with_id("plugin-manager", "插件管理").build(app)?;
            let plugins_menu = SubmenuBuilder::new(app, "插件")
                .item(&plugin_manager_item)
                .build()?;

            // Create Help menu
            let about_item = MenuItemBuilder::with_id("about", "关于").build(app)?;
            let plugin_dev_guide_item = MenuItemBuilder::with_id("plugin-dev-guide", "插件开发指导").build(app)?;
            let reset_app_item = MenuItemBuilder::with_id("reset-app", "重置应用程序").build(app)?;
            let help_menu = SubmenuBuilder::new(app, "帮助")
                .item(&about_item)
                .item(&plugin_dev_guide_item)
                .separator()
                .item(&reset_app_item)
                .build()?;

            // Build and set the menu
            let menu = MenuBuilder::new(app)
                .item(&app_menu)
                .item(&file_menu)
                .item(&edit_menu)
                .item(&tags_menu)
                .item(&tools_menu)
                .item(&plugins_menu)
                .item(&help_menu)
                .build()?;

            app.set_menu(menu)?;

            // Handle menu events
            app.on_menu_event(|app, event| {
                let window = app.get_webview_window("main").unwrap();
                match event.id().as_ref() {
                    "settings" => {
                        let _ = window.eval("window.location.hash = '#/settings'");
                    }
                    "library-management" => {
                        let _ = window.emit("menu-library-management", ());
                    }
                    "import" => {
                        let _ = window.emit("menu-import", ());
                    }
                    "tag-management" => {
                        let _ = window.eval("window.location.hash = '#/tags'");
                    }
                    "remove-background" => {
                        let _ = window.emit("menu-remove-background", ());
                    }
                    "image-editor" => {
                        let _ = window.emit("menu-image-editor", ());
                    }
                    "merge-spritesheet" => {
                        let _ = window.emit("menu-merge-spritesheet", ());
                    }
                    "split-image" => {
                        let _ = window.emit("menu-split-image", ());
                    }
                    "compress-image" => {
                        let _ = window.emit("menu-compress-image", ());
                    }
                    "resize-image" => {
                        let _ = window.emit("menu-resize-image", ());
                    }
                    "plugin-manager" => {
                        let _ = window.emit("menu-plugin-manager", ());
                    }
                    "about" => {
                        let _ = window.emit("menu-about", ());
                    }
                    "plugin-dev-guide" => {
                        let _ = window.emit("menu-plugin-dev-guide", ());
                    }
                    "reset-app" => {
                        let _ = window.emit("menu-reset-app", ());
                    }
                    "export-library" => {
                        let _ = window.emit("menu-export-library", ());
                    }
                    "import-library" => {
                        let _ = window.emit("menu-import-library", ());
                    }
                    _ => {}
                }
            });

            let app_handle = app.handle().clone();
            tauri::async_runtime::block_on(async move {
                // Initialize database
                let app_data_dir = app_handle
                    .path()
                    .app_data_dir()
                    .expect("Failed to get app data dir");

                let pool = db::init_db(&app_data_dir)
                    .await
                    .expect("Failed to initialize database");

                // Initialize AI provider manager
                let ai_manager = AiProviderManager::new();
                ai::config::load_ai_provider(&pool, &ai_manager).await.ok();

                // Register managed state
                app_handle.manage(pool);
                app_handle.manage(ai_manager);
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Library commands
            commands::library::create_library,
            commands::library::list_libraries,
            commands::library::get_library,
            commands::library::delete_library,
            commands::library::delete_library_with_files,
            // Asset commands
            commands::asset::import_assets,
            commands::asset::get_assets,
            commands::asset::get_asset_detail,
            commands::asset::rename_asset,
            commands::asset::update_description,
            commands::asset::delete_assets,
            commands::asset::move_assets,
            commands::asset::duplicate_assets,
            commands::asset::get_folders,
            commands::asset::get_asset_file_path,
            commands::asset::get_thumbnail_path,
            commands::asset::get_thumbnail_data,
            commands::asset::create_folder,
            commands::asset::rename_folder,
            commands::asset::copy_files_to_clipboard,
            // Tag commands
            commands::tag::create_tag,
            commands::tag::list_tags,
            commands::tag::rename_tag,
            commands::tag::delete_tag,
            commands::tag::assign_tags,
            commands::tag::remove_tags,
            commands::tag::get_asset_tags,
            // Search commands
            commands::search::search_keyword,
            commands::search::search_by_tags,
            // AI commands
            commands::ai::ai_tag_asset,
            commands::ai::ai_semantic_search,
            commands::ai::save_ai_config,
            commands::ai::get_ai_config,
            commands::ai::test_ai_connection,
            // Processing commands
            commands::processing::remove_background,
            commands::processing::merge_spritesheet,
            commands::processing::get_spritesheet_descriptor,
            commands::processing::get_spritesheet_descriptor_with_format,
            commands::processing::split_image,
            commands::processing::compress_image,
            commands::processing::merge_spritesheet_with_size,
            commands::processing::resize_image,
            commands::processing::save_edited_image,
            commands::processing::crop_image,
            // Plugin commands
            commands::plugin::list_plugins,
            commands::plugin::read_plugin_file,
            commands::plugin::import_plugin,
            commands::plugin::uninstall_plugin,
            // Menu commands
            commands::menu::update_menu_language,
            // Library IO commands
            commands::library_io::export_library,
            commands::library_io::export_all_libraries,
            commands::library_io::check_import_library,
            commands::library_io::import_library,
            commands::library_io::reset_application,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
