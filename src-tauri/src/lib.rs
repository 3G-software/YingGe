mod ai;
mod commands;
mod db;
mod error;
mod plugin_system;
mod processing;
mod storage;

use ai::provider::AiProviderManager;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
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
