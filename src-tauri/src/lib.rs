mod ai;
mod commands;
mod db;
mod error;
mod plugin_system;
mod processing;
mod storage;

use ai::provider::AiProviderManager;
use tauri::{Emitter, Manager, menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder}};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // Create App menu (YingGe)
            let settings_item = MenuItemBuilder::with_id("settings", "设置").build(app)?;
            let app_menu = SubmenuBuilder::new(app, "YingGe")
                .item(&settings_item)
                .build()?;

            // Create File menu
            let import_item = MenuItemBuilder::with_id("import", "导入").build(app)?;
            let file_menu = SubmenuBuilder::new(app, "文件")
                .item(&import_item)
                .build()?;

            // Create Tags menu
            let tag_management_item = MenuItemBuilder::with_id("tag-management", "标签管理").build(app)?;
            let tags_menu = SubmenuBuilder::new(app, "标签")
                .item(&tag_management_item)
                .build()?;

            // Create Tools menu with specific tools
            let remove_bg_item = MenuItemBuilder::with_id("remove-background", "移除背景").build(app)?;
            let merge_sprite_item = MenuItemBuilder::with_id("merge-spritesheet", "合并精灵图").build(app)?;
            let split_image_item = MenuItemBuilder::with_id("split-image", "分割图片").build(app)?;
            let tools_menu = SubmenuBuilder::new(app, "工具")
                .item(&remove_bg_item)
                .item(&merge_sprite_item)
                .item(&split_image_item)
                .build()?;

            // Create Plugins menu
            let import_plugin_item = MenuItemBuilder::with_id("import-plugin", "导入插件").build(app)?;
            let plugins_menu = SubmenuBuilder::new(app, "插件")
                .item(&import_plugin_item)
                .build()?;

            // Create Help menu
            let about_item = MenuItemBuilder::with_id("about", "关于").build(app)?;
            let plugin_dev_guide_item = MenuItemBuilder::with_id("plugin-dev-guide", "插件开发指导").build(app)?;
            let help_menu = SubmenuBuilder::new(app, "帮助")
                .item(&about_item)
                .item(&plugin_dev_guide_item)
                .build()?;

            // Build and set the menu
            let menu = MenuBuilder::new(app)
                .item(&app_menu)
                .item(&file_menu)
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
                    "import" => {
                        let _ = window.emit("menu-import", ());
                    }
                    "tag-management" => {
                        let _ = window.eval("window.location.hash = '#/tags'");
                    }
                    "remove-background" => {
                        let _ = window.emit("menu-remove-background", ());
                    }
                    "merge-spritesheet" => {
                        let _ = window.emit("menu-merge-spritesheet", ());
                    }
                    "split-image" => {
                        let _ = window.emit("menu-split-image", ());
                    }
                    "import-plugin" => {
                        let _ = window.emit("menu-import-plugin", ());
                    }
                    "about" => {
                        let _ = window.emit("menu-about", ());
                    }
                    "plugin-dev-guide" => {
                        let _ = window.emit("menu-plugin-dev-guide", ());
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
            // Asset commands
            commands::asset::import_assets,
            commands::asset::get_assets,
            commands::asset::get_asset_detail,
            commands::asset::rename_asset,
            commands::asset::update_description,
            commands::asset::delete_assets,
            commands::asset::move_assets,
            commands::asset::get_folders,
            commands::asset::get_asset_file_path,
            commands::asset::get_thumbnail_path,
            commands::asset::get_thumbnail_data,
            commands::asset::create_folder,
            commands::asset::rename_folder,
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
            commands::processing::split_image,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
