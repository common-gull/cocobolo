mod commands;
mod config;
mod crypto;
mod errors;
mod types;
mod vault;

#[cfg(test)]
mod tests;

use commands::*;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            get_app_info,
            select_vault_directory,
            validate_vault_location,
            set_vault_location,
            get_current_vault_location,
            get_app_config,
            validate_password_strength,
            check_vault_setup_status,
            create_encrypted_vault,
            verify_vault_password,
            get_vault_rate_limit_status,
            unlock_vault,
            close_vault_session,
            check_session_status,
            create_note,
            create_folder,
            get_notes_list,
            get_folders_list,
            load_note,
            save_note,
            delete_note,
            delete_folder,
            move_note,
            move_folder,
            add_known_vault,
            remove_known_vault,
            get_known_vaults,
            get_current_vault,
            set_current_vault,
            get_recent_vaults,
            get_favorite_vaults,
            update_vault_metadata,
            cleanup_invalid_vaults,
            rename_folder
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
