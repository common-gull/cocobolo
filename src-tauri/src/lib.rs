//! # Cocobolo - Secure Notes Application Backend
//!
//! This is the Rust backend for Cocobolo, a secure, encrypted, cross-platform note-taking application.
//! The backend is built with Tauri 2.0 and provides a secure foundation for managing encrypted vaults,
//! notes, and folders with strong cryptographic protection.
//!
//! ## Architecture
//!
//! The codebase is organized into focused modules:
//!
//! - **commands**: Tauri command handlers organized by functionality
//! - **config**: Application configuration and vault management
//! - **crypto**: Cryptographic operations and security utilities
//! - **errors**: Hierarchical error handling system
//! - **types**: Request/response data structures
//! - **vault**: Core vault operations and data management
//!
//! ## Security Features
//!
//! - XChaCha20-Poly1305 authenticated encryption
//! - Argon2id key derivation with configurable parameters
//! - Secure memory handling with automatic zeroization
//! - Rate limiting for password attempts
//! - Session-based access control
//!
//! ## Usage
//!
//! This library is designed to be used as the backend for a Tauri application.
//! The main entry point is the `run()` function which sets up the Tauri app
//! with all necessary plugins and command handlers.

// Module declarations
mod commands;
mod config;
mod crypto;
mod errors;
mod types;
mod vault;

#[cfg(test)]
mod tests;

// Re-exports for Tauri
pub use commands::*;
pub use errors::AppError;
pub use types::*;

/// Main entry point for the Tauri application
///
/// This function sets up the Tauri application with all necessary plugins
/// and command handlers. It configures the app for cross-platform operation
/// and ensures all security features are properly initialized.
///
/// # Plugins
///
/// - `tauri_plugin_opener`: File system operations
/// - `tauri_plugin_fs`: File system access
/// - `tauri_plugin_dialog`: Native dialog boxes
///
/// # Command Handlers
///
/// Commands are organized by functionality:
/// - Vault management (create, unlock, session management)
/// - Note operations (CRUD, organization)
/// - Folder operations (hierarchy, management)
/// - Application utilities (info, configuration)
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            // Vault commands
            select_vault_directory,
            validate_vault_location,
            get_current_vault_location,
            add_known_vault,
            remove_known_vault,
            get_known_vaults,
            get_current_vault,
            set_current_vault,
            get_recent_vaults,
            get_favorite_vaults,
            update_vault_metadata,
            cleanup_invalid_vaults,
            check_vault_setup_status,
            create_encrypted_vault,
            verify_vault_password,
            get_vault_rate_limit_status,
            unlock_vault,
            close_vault_session,
            check_session_status,
            // Note commands
            create_note,
            get_notes_list,
            load_note,
            save_note,
            delete_note,
            move_note,
            // Folder commands
            get_folders_list,
            create_folder,
            delete_folder,
            move_folder,
            rename_folder,
            // App commands
            validate_password_strength,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
