use anyhow::Result;
use serde::{Deserialize, Serialize};
use thiserror::Error;

mod config;
mod crypto;
mod vault;

use config::{AppConfig, ConfigError, KnownVault};
use crypto::{CryptoError, CryptoManager, PasswordStrength, SecurePassword};
use vault::{Note, NoteMetadata, VaultError, VaultInfo, VaultManager};

#[derive(Error, Debug)]
pub enum AppError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
    #[error("Configuration error: {0}")]
    Config(#[from] ConfigError),
    #[error("Vault error: {0}")]
    Vault(#[from] VaultError),
    #[error("Cryptographic error: {0}")]
    Crypto(#[from] CryptoError),
    #[error("Application error: {0}")]
    Application(String),
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::ser::Serializer,
    {
        serializer.serialize_str(self.to_string().as_ref())
    }
}

#[derive(Serialize, Deserialize, Debug)]
pub struct AppInfo {
    pub name: String,
    pub version: String,
    pub description: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct VaultLocationInfo {
    pub path: String,
    pub is_valid: bool,
    pub is_writable: bool,
    pub has_existing_vault: bool,
    pub vault_info: Option<VaultInfo>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct VaultSetupInfo {
    pub needs_password: bool,
    pub is_encrypted: bool,
    pub vault_info: Option<VaultInfo>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct VaultUnlockResult {
    pub success: bool,
    pub session_id: Option<String>,
    pub vault_info: Option<VaultInfo>,
    pub error_message: Option<String>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct RateLimitInfo {
    pub is_rate_limited: bool,
    pub seconds_remaining: Option<u64>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct CreateNoteRequest {
    pub title: String,
    pub content: Option<String>,
    pub tags: Option<Vec<String>>,
    pub folder_path: Option<String>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct CreateNoteResult {
    pub success: bool,
    pub note: Option<Note>,
    pub error_message: Option<String>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct SaveNoteRequest {
    pub id: String,
    pub title: Option<String>,
    pub content: Option<String>,
    pub tags: Option<Vec<String>>,
    pub folder_path: Option<String>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct SaveNoteResult {
    pub success: bool,
    pub note: Option<Note>,
    pub error_message: Option<String>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct AddVaultRequest {
    pub name: String,
    pub path: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct AddVaultResult {
    pub success: bool,
    pub vault_id: Option<String>,
    pub error_message: Option<String>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct UpdateVaultMetadataRequest {
    pub vault_id: String,
    pub name: Option<String>,
    pub is_favorite: Option<bool>,
}

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn get_app_info() -> Result<AppInfo, AppError> {
    Ok(AppInfo {
        name: "Cocobolo".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        description: "A secure, encrypted note-taking application".to_string(),
    })
}

#[tauri::command]
fn greet(name: &str) -> Result<String, AppError> {
    if name.trim().is_empty() {
        return Err(AppError::Application("Name cannot be empty".to_string()));
    }
    Ok(format!(
        "Hello, {}! Welcome to Cocobolo - your secure note-taking companion!",
        name
    ))
}

#[tauri::command]
async fn select_vault_directory() -> Result<Option<String>, AppError> {
    // This command is not used - directory selection is handled in the frontend
    // using the dialog plugin directly
    Err(AppError::Application(
        "This command should be called from the frontend".to_string(),
    ))
}

#[tauri::command]
async fn validate_vault_location(path: String) -> Result<VaultLocationInfo, AppError> {
    let path_buf = std::path::PathBuf::from(&path);

    let is_valid = path_buf.exists();
    let is_directory = path_buf.is_dir();

    if !is_valid {
        return Ok(VaultLocationInfo {
            path,
            is_valid: false,
            is_writable: false,
            has_existing_vault: false,
            vault_info: None,
        });
    }

    if !is_directory {
        return Err(AppError::Application(
            "Selected path is not a directory".to_string(),
        ));
    }

    // Test write permissions
    let test_file = path_buf.join(".cocobolo_write_test");
    let is_writable = match std::fs::write(&test_file, "test") {
        Ok(_) => {
            let _ = std::fs::remove_file(&test_file);
            true
        }
        Err(_) => false,
    };

    // Check for existing vault
    let vault_manager = VaultManager::new(&path_buf);
    let has_existing_vault = vault_manager.vault_exists();
    let vault_info = if has_existing_vault {
        vault_manager.load_vault_info().ok()
    } else {
        None
    };

    Ok(VaultLocationInfo {
        path,
        is_valid: true,
        is_writable,
        has_existing_vault,
        vault_info,
    })
}

// Legacy vault location commands (for backward compatibility)
#[tauri::command]
async fn set_vault_location(path: String) -> Result<(), AppError> {
    let mut config = AppConfig::load()?;

    // Use the new multi-vault system
    let path_buf = std::path::PathBuf::from(&path);

    // Check if this vault already exists in known_vaults
    if let Some(existing_vault) = config.known_vaults.iter().find(|v| v.path == path_buf) {
        // Set it as current vault
        config.set_current_vault(Some(existing_vault.id.clone()))?;
    } else {
        // Add as new vault and set as current
        let vault_name = path_buf
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("Vault")
            .to_string();

        let vault_id = config.add_known_vault(vault_name, path_buf)?;
        config.set_current_vault(Some(vault_id))?;
    }

    config.save()?;
    Ok(())
}

#[tauri::command]
async fn get_current_vault_location() -> Result<Option<String>, AppError> {
    let config = AppConfig::load()?;

    // Use the modern multi-vault approach
    if let Some(current_vault) = config.get_current_vault() {
        return Ok(Some(current_vault.path.display().to_string()));
    }

    Ok(None)
}

// New multi-vault commands
#[tauri::command]
async fn add_known_vault(request: AddVaultRequest) -> Result<AddVaultResult, AppError> {
    let mut config = AppConfig::load()?;

    match config.add_known_vault(request.name, std::path::PathBuf::from(request.path)) {
        Ok(vault_id) => {
            config.save()?;
            Ok(AddVaultResult {
                success: true,
                vault_id: Some(vault_id),
                error_message: None,
            })
        }
        Err(e) => Ok(AddVaultResult {
            success: false,
            vault_id: None,
            error_message: Some(e.to_string()),
        }),
    }
}

#[tauri::command]
async fn remove_known_vault(vault_id: String) -> Result<bool, AppError> {
    let mut config = AppConfig::load()?;
    config.remove_known_vault(&vault_id)?;
    config.save()?;
    Ok(true)
}

#[tauri::command]
async fn get_known_vaults() -> Result<Vec<KnownVault>, AppError> {
    let config = AppConfig::load()?;
    Ok(config.get_known_vaults().to_vec())
}

#[tauri::command]
async fn get_current_vault() -> Result<Option<KnownVault>, AppError> {
    let config = AppConfig::load()?;
    Ok(config.get_current_vault().cloned())
}

#[tauri::command]
async fn set_current_vault(vault_id: Option<String>) -> Result<(), AppError> {
    let mut config = AppConfig::load()?;
    config.set_current_vault(vault_id)?;
    config.save()?;
    Ok(())
}

#[tauri::command]
async fn get_recent_vaults() -> Result<Vec<KnownVault>, AppError> {
    let config = AppConfig::load()?;
    Ok(config.get_recent_vaults().into_iter().cloned().collect())
}

#[tauri::command]
async fn get_favorite_vaults() -> Result<Vec<KnownVault>, AppError> {
    let config = AppConfig::load()?;
    Ok(config.get_favorite_vaults().into_iter().cloned().collect())
}

#[tauri::command]
async fn update_vault_metadata(request: UpdateVaultMetadataRequest) -> Result<(), AppError> {
    let mut config = AppConfig::load()?;
    config.update_vault_metadata(&request.vault_id, request.name, request.is_favorite)?;
    config.save()?;
    Ok(())
}

#[tauri::command]
async fn cleanup_invalid_vaults() -> Result<Vec<String>, AppError> {
    let mut config = AppConfig::load()?;
    let removed_ids = config.cleanup_invalid_vaults();
    if !removed_ids.is_empty() {
        config.save()?;
    }
    Ok(removed_ids)
}

#[tauri::command]
async fn get_app_config() -> Result<AppConfig, AppError> {
    let config = AppConfig::load()?;
    Ok(config)
}

// Password and encryption related commands

#[tauri::command]
async fn validate_password_strength(password: String) -> Result<PasswordStrength, AppError> {
    let crypto_manager = CryptoManager::new();
    let secure_password = SecurePassword::new(password);
    Ok(crypto_manager.validate_password_strength(&secure_password))
}

#[tauri::command]
async fn check_vault_setup_status(path: String) -> Result<VaultSetupInfo, AppError> {
    let path_buf = std::path::PathBuf::from(&path);
    let vault_manager = VaultManager::new(&path_buf);

    if !vault_manager.vault_exists() {
        return Ok(VaultSetupInfo {
            needs_password: true,
            is_encrypted: false,
            vault_info: None,
        });
    }

    let vault_info = vault_manager.load_vault_info()?;
    let is_encrypted = vault_info.is_encrypted;

    Ok(VaultSetupInfo {
        needs_password: is_encrypted,
        is_encrypted,
        vault_info: Some(vault_info),
    })
}

#[tauri::command]
async fn create_encrypted_vault(
    path: String,
    vault_name: String,
    password: String,
) -> Result<VaultInfo, AppError> {
    let path_buf = std::path::PathBuf::from(&path);
    let vault_manager = VaultManager::new(&path_buf);
    let secure_password = SecurePassword::new(password);

    let vault_info = vault_manager.initialize_encrypted_vault(vault_name, &secure_password)?;
    Ok(vault_info)
}

#[tauri::command]
async fn verify_vault_password(path: String, password: String) -> Result<bool, AppError> {
    let path_buf = std::path::PathBuf::from(&path);
    let vault_manager = VaultManager::new(&path_buf);
    let secure_password = SecurePassword::new(password);

    Ok(vault_manager.verify_vault_password(&secure_password)?)
}

// Vault unlock and session management commands

#[tauri::command]
async fn get_vault_rate_limit_status(path: String) -> Result<RateLimitInfo, AppError> {
    let path_buf = std::path::PathBuf::from(&path);
    let vault_manager = VaultManager::new(&path_buf);

    let (is_rate_limited, seconds_remaining) = vault_manager.get_rate_limit_status();

    Ok(RateLimitInfo {
        is_rate_limited,
        seconds_remaining,
    })
}

#[tauri::command]
async fn unlock_vault(path: String, password: String) -> Result<VaultUnlockResult, AppError> {
    let path_buf = std::path::PathBuf::from(&path);
    let vault_manager = VaultManager::new(&path_buf);
    let secure_password = SecurePassword::new(password);

    match vault_manager.unlock_vault(&secure_password) {
        Ok(session_id) => {
            // Get vault info for the response
            let vault_info = vault_manager.load_vault_info().ok();

            Ok(VaultUnlockResult {
                success: true,
                session_id: Some(session_id),
                vault_info,
                error_message: None,
            })
        }
        Err(vault_error) => {
            let error_message = match &vault_error {
                VaultError::InvalidPassword => "Incorrect password. Please try again.".to_string(),
                VaultError::RateLimited(seconds) => {
                    format!(
                        "Too many failed attempts. Please wait {} seconds before trying again.",
                        seconds
                    )
                }
                VaultError::VaultCorrupted => "Vault file is corrupted or invalid.".to_string(),
                VaultError::NotEncrypted(_) => "This vault is not encrypted.".to_string(),
                _ => "Failed to unlock vault.".to_string(),
            };

            Ok(VaultUnlockResult {
                success: false,
                session_id: None,
                vault_info: None,
                error_message: Some(error_message),
            })
        }
    }
}

#[tauri::command]
async fn close_vault_session(session_id: String) -> Result<bool, AppError> {
    Ok(VaultManager::close_session(&session_id))
}

#[tauri::command]
async fn check_session_status(session_id: String) -> Result<bool, AppError> {
    Ok(VaultManager::get_session(&session_id).is_some())
}

// Note management commands

#[tauri::command]
async fn create_note(
    vault_path: String,
    session_id: String,
    title: Option<String>,
    content: Option<String>,
    tags: Option<Vec<String>>,
    folder_path: Option<String>,
    note_type: Option<String>,
) -> Result<CreateNoteResult, AppError> {
    let path_buf = std::path::PathBuf::from(&vault_path);
    let vault_manager = VaultManager::new(&path_buf);

    match vault_manager.create_note(&session_id, title, content, tags, folder_path, note_type) {
        Ok(note) => Ok(CreateNoteResult {
            success: true,
            note: Some(note),
            error_message: None,
        }),
        Err(vault_error) => {
            let error_message = match &vault_error {
                VaultError::InvalidNoteTitle(msg) => msg.clone(),
                VaultError::InvalidPassword => {
                    "Session expired. Please unlock vault again.".to_string()
                }
                _ => "Failed to create note.".to_string(),
            };

            Ok(CreateNoteResult {
                success: false,
                note: None,
                error_message: Some(error_message),
            })
        }
    }
}

#[tauri::command]
async fn get_notes_list(
    vault_path: String,
    session_id: String,
) -> Result<Vec<NoteMetadata>, AppError> {
    let path_buf = std::path::PathBuf::from(&vault_path);
    let vault_manager = VaultManager::new(&path_buf);

    Ok(vault_manager.get_notes_list(&session_id)?)
}

#[tauri::command]
async fn get_folders_list(vault_path: String, session_id: String) -> Result<Vec<String>, AppError> {
    let path_buf = std::path::PathBuf::from(&vault_path);
    let vault_manager = VaultManager::new(&path_buf);

    Ok(vault_manager.get_folders_list(&session_id)?)
}

#[tauri::command]
async fn load_note(
    vault_path: String,
    session_id: String,
    note_id: String,
) -> Result<Note, AppError> {
    let path_buf = std::path::PathBuf::from(&vault_path);
    let vault_manager = VaultManager::new(&path_buf);

    Ok(vault_manager.load_note(&session_id, &note_id)?)
}

#[tauri::command]
async fn create_folder(
    vault_path: String,
    session_id: String,
    folder_path: String,
) -> Result<(), AppError> {
    let vault_manager = VaultManager::new(&vault_path);
    vault_manager.create_folder(&session_id, folder_path)?;
    Ok(())
}

#[tauri::command]
async fn save_note(
    vault_path: String,
    session_id: String,
    note_id: String,
    title: Option<String>,
    content: Option<String>,
    tags: Option<Vec<String>>,
    folder_path: Option<String>,
) -> Result<SaveNoteResult, AppError> {
    let path_buf = std::path::PathBuf::from(&vault_path);
    let vault_manager = VaultManager::new(&path_buf);

    match vault_manager.save_note(&session_id, &note_id, title, content, tags, folder_path) {
        Ok(note) => Ok(SaveNoteResult {
            success: true,
            note: Some(note),
            error_message: None,
        }),
        Err(vault_error) => {
            let error_message = match &vault_error {
                VaultError::NoteNotFound(_) => "Note not found.".to_string(),
                VaultError::InvalidNoteTitle(msg) => msg.clone(),
                VaultError::InvalidPassword => {
                    "Session expired. Please unlock vault again.".to_string()
                }
                _ => "Failed to save note.".to_string(),
            };

            Ok(SaveNoteResult {
                success: false,
                note: None,
                error_message: Some(error_message),
            })
        }
    }
}

#[tauri::command]
async fn delete_note(
    vault_path: String,
    session_id: String,
    note_id: String,
) -> Result<bool, AppError> {
    let path_buf = std::path::PathBuf::from(&vault_path);
    let vault_manager = VaultManager::new(&path_buf);

    match vault_manager.delete_note(&session_id, &note_id) {
        Ok(_) => Ok(true),
        Err(_) => Ok(false), // Return false instead of error for simpler handling
    }
}

#[tauri::command]
async fn delete_folder(
    vault_path: String,
    session_id: String,
    folder_path: String,
) -> Result<bool, AppError> {
    let path_buf = std::path::PathBuf::from(&vault_path);
    let vault_manager = VaultManager::new(&path_buf);

    match vault_manager.delete_folder(&session_id, &folder_path) {
        Ok(_) => Ok(true),
        Err(_) => Ok(false), // Return false instead of error for simpler handling
    }
}

#[tauri::command]
async fn move_note(
    vault_path: String,
    session_id: String,
    note_id: String,
    new_folder_path: Option<String>,
) -> Result<bool, AppError> {
    let path_buf = std::path::PathBuf::from(&vault_path);
    let vault_manager = VaultManager::new(&path_buf);

    match vault_manager.move_note(&session_id, &note_id, new_folder_path) {
        Ok(_) => Ok(true),
        Err(_) => Ok(false), // Return false instead of error for simpler handling
    }
}

#[tauri::command]
async fn move_folder(
    vault_path: String,
    session_id: String,
    old_path: String,
    new_path: String,
) -> Result<bool, AppError> {
    let path_buf = std::path::PathBuf::from(&vault_path);
    let vault_manager = VaultManager::new(&path_buf);

    match vault_manager.move_folder(&session_id, &old_path, &new_path) {
        Ok(_) => Ok(true),
        Err(_) => Ok(false), // Return false instead of error for simpler handling
    }
}

#[tauri::command]
async fn rename_folder(
    vault_path: String,
    session_id: String,
    folder_path: String,
    new_name: String,
) -> Result<bool, AppError> {
    let path_buf = std::path::PathBuf::from(&vault_path);
    let vault_manager = VaultManager::new(&path_buf);

    // Calculate the new path based on the new name
    let old_path_parts: Vec<&str> = folder_path.split('/').collect();
    let parent_path = if old_path_parts.len() > 1 {
        old_path_parts[..old_path_parts.len() - 1].join("/")
    } else {
        String::new()
    };

    let new_path = if parent_path.is_empty() {
        new_name
    } else {
        format!("{}/{}", parent_path, new_name)
    };

    match vault_manager.move_folder(&session_id, &folder_path, &new_path) {
        Ok(_) => Ok(true),
        Err(_) => Ok(false), // Return false instead of error for simpler handling
    }
}

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

#[cfg(test)]
mod tests {
    use super::*;
    use serial_test::serial;
    use std::env;
    use tempfile::TempDir;

    // Helper function to create a temporary directory
    fn setup_temp_dir() -> TempDir {
        TempDir::new().unwrap()
    }

    // Helper function to set up environment for tests
    fn setup_test_env(temp_dir: &TempDir) {
        env::set_var("HOME", temp_dir.path());
        env::remove_var("USERPROFILE");
    }

    #[test]
    fn test_get_app_info() {
        let info = get_app_info().unwrap();

        assert_eq!(info.name, "Cocobolo");
        assert_eq!(info.version, env!("CARGO_PKG_VERSION"));
        assert_eq!(
            info.description,
            "A secure, encrypted note-taking application"
        );
    }

    #[test]
    fn test_greet_valid_name() {
        let result = greet("Alice").unwrap();
        assert_eq!(
            result,
            "Hello, Alice! Welcome to Cocobolo - your secure note-taking companion!"
        );
    }

    #[test]
    fn test_greet_empty_name() {
        let result = greet("");
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), AppError::Application(_)));
    }

    #[test]
    fn test_greet_whitespace_only_name() {
        let result = greet("   ");
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), AppError::Application(_)));
    }

    #[tokio::test]
    async fn test_select_vault_directory() {
        let result = select_vault_directory().await;
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), AppError::Application(_)));
    }

    #[tokio::test]
    async fn test_validate_vault_location_valid() {
        let temp_dir = setup_temp_dir();
        let path = temp_dir.path().to_string_lossy().to_string();

        let result = validate_vault_location(path.clone()).await.unwrap();

        assert_eq!(result.path, path);
        assert!(result.is_valid);
        assert!(result.is_writable);
        assert!(!result.has_existing_vault);
        assert!(result.vault_info.is_none());
    }

    #[tokio::test]
    async fn test_validate_vault_location_invalid() {
        let invalid_path = "/nonexistent/path".to_string();

        let result = validate_vault_location(invalid_path.clone()).await.unwrap();

        assert_eq!(result.path, invalid_path);
        assert!(!result.is_valid);
        assert!(!result.is_writable);
        assert!(!result.has_existing_vault);
        assert!(result.vault_info.is_none());
    }

    #[tokio::test]
    async fn test_validate_vault_location_file_not_directory() {
        let temp_dir = setup_temp_dir();
        let file_path = temp_dir.path().join("test_file.txt");
        std::fs::write(&file_path, "test").unwrap();

        let result = validate_vault_location(file_path.to_string_lossy().to_string()).await;
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), AppError::Application(_)));
    }

    #[tokio::test]
    async fn test_validate_vault_location_with_existing_vault() {
        let temp_dir = setup_temp_dir();
        let vault_manager = VaultManager::new(temp_dir.path());
        vault_manager
            .initialize_vault("Test Vault".to_string())
            .unwrap();

        let path = temp_dir.path().to_string_lossy().to_string();
        let result = validate_vault_location(path.clone()).await.unwrap();

        assert_eq!(result.path, path);
        assert!(result.is_valid);
        assert!(result.is_writable);
        assert!(result.has_existing_vault);
        assert!(result.vault_info.is_some());
        assert_eq!(result.vault_info.unwrap().name, "Test Vault");
    }

    #[tokio::test]
    #[serial]
    async fn test_set_and_get_vault_location() {
        let temp_dir = setup_temp_dir();
        setup_test_env(&temp_dir);

        let vault_path = temp_dir.path().join("test_vault");
        std::fs::create_dir_all(&vault_path).unwrap();
        let path_str = vault_path.to_string_lossy().to_string();

        // Set vault location
        set_vault_location(path_str.clone()).await.unwrap();

        // Get vault location
        let current_location = get_current_vault_location().await.unwrap();
        assert_eq!(current_location, Some(path_str));
    }

    #[tokio::test]
    #[serial]
    async fn test_add_and_get_known_vaults() {
        let temp_dir = setup_temp_dir();
        setup_test_env(&temp_dir);

        let vault_path = temp_dir.path().join("test_vault");
        std::fs::create_dir_all(&vault_path).unwrap();

        let request = AddVaultRequest {
            name: "Test Vault".to_string(),
            path: vault_path.to_string_lossy().to_string(),
        };

        // Add vault
        let result = add_known_vault(request).await.unwrap();
        assert!(result.success);
        assert!(result.vault_id.is_some());
        assert!(result.error_message.is_none());

        // Get known vaults
        let vaults = get_known_vaults().await.unwrap();
        assert_eq!(vaults.len(), 1);
        assert_eq!(vaults[0].name, "Test Vault");
        assert_eq!(vaults[0].path, vault_path);
    }

    #[tokio::test]
    #[serial]
    async fn test_remove_known_vault() {
        let temp_dir = setup_temp_dir();
        setup_test_env(&temp_dir);

        let vault_path = temp_dir.path().join("test_vault");
        std::fs::create_dir_all(&vault_path).unwrap();

        let request = AddVaultRequest {
            name: "Test Vault".to_string(),
            path: vault_path.to_string_lossy().to_string(),
        };

        let result = add_known_vault(request).await.unwrap();
        let vault_id = result.vault_id.unwrap();

        // Remove vault
        let removed = remove_known_vault(vault_id).await.unwrap();
        assert!(removed);

        // Verify vault is removed
        let vaults = get_known_vaults().await.unwrap();
        assert_eq!(vaults.len(), 0);
    }

    #[tokio::test]
    #[serial]
    async fn test_set_and_get_current_vault() {
        let temp_dir = setup_temp_dir();
        setup_test_env(&temp_dir);

        let vault_path = temp_dir.path().join("test_vault");
        std::fs::create_dir_all(&vault_path).unwrap();

        let request = AddVaultRequest {
            name: "Test Vault".to_string(),
            path: vault_path.to_string_lossy().to_string(),
        };

        let result = add_known_vault(request).await.unwrap();
        let vault_id = result.vault_id.unwrap();

        // Set current vault
        set_current_vault(Some(vault_id.clone())).await.unwrap();

        // Get current vault
        let current_vault = get_current_vault().await.unwrap();
        assert!(current_vault.is_some());
        assert_eq!(current_vault.unwrap().id, vault_id);
    }

    #[tokio::test]
    #[serial]
    async fn test_get_recent_and_favorite_vaults() {
        let temp_dir = setup_temp_dir();
        setup_test_env(&temp_dir);

        let vault_path = temp_dir.path().join("test_vault");
        std::fs::create_dir_all(&vault_path).unwrap();

        let request = AddVaultRequest {
            name: "Test Vault".to_string(),
            path: vault_path.to_string_lossy().to_string(),
        };

        let result = add_known_vault(request).await.unwrap();
        let vault_id = result.vault_id.unwrap();

        // Set as current (adds to recent)
        set_current_vault(Some(vault_id.clone())).await.unwrap();

        // Get recent vaults
        let recent_vaults = get_recent_vaults().await.unwrap();
        assert_eq!(recent_vaults.len(), 1);
        assert_eq!(recent_vaults[0].id, vault_id);

        // Update to favorite
        let update_request = UpdateVaultMetadataRequest {
            vault_id: vault_id.clone(),
            name: None,
            is_favorite: Some(true),
        };
        update_vault_metadata(update_request).await.unwrap();

        // Get favorite vaults
        let favorite_vaults = get_favorite_vaults().await.unwrap();
        assert_eq!(favorite_vaults.len(), 1);
        assert_eq!(favorite_vaults[0].id, vault_id);
        assert!(favorite_vaults[0].is_favorite);
    }

    #[tokio::test]
    #[serial]
    async fn test_cleanup_invalid_vaults() {
        let temp_dir = setup_temp_dir();
        setup_test_env(&temp_dir);

        // Add valid vault
        let valid_path = temp_dir.path().join("valid_vault");
        std::fs::create_dir_all(&valid_path).unwrap();

        let valid_request = AddVaultRequest {
            name: "Valid Vault".to_string(),
            path: valid_path.to_string_lossy().to_string(),
        };
        add_known_vault(valid_request).await.unwrap();

        // Add invalid vault
        let invalid_path = temp_dir.path().join("invalid_vault");
        std::fs::create_dir_all(&invalid_path).unwrap();

        let invalid_request = AddVaultRequest {
            name: "Invalid Vault".to_string(),
            path: invalid_path.to_string_lossy().to_string(),
        };
        let invalid_result = add_known_vault(invalid_request).await.unwrap();

        // Remove the invalid vault directory
        std::fs::remove_dir_all(&invalid_path).unwrap();

        // Cleanup invalid vaults
        let removed_ids = cleanup_invalid_vaults().await.unwrap();
        assert_eq!(removed_ids.len(), 1);
        assert_eq!(removed_ids[0], invalid_result.vault_id.unwrap());

        // Verify only valid vault remains
        let vaults = get_known_vaults().await.unwrap();
        assert_eq!(vaults.len(), 1);
        assert_eq!(vaults[0].name, "Valid Vault");
    }

    #[tokio::test]
    #[serial]
    async fn test_get_app_config() {
        let temp_dir = setup_temp_dir();
        setup_test_env(&temp_dir);

        let config = get_app_config().await.unwrap();

        assert_eq!(config.theme, "system");
        assert_eq!(config.auto_save_interval, 300);
        assert!(config.show_markdown_preview);
        assert!(config.known_vaults.is_empty());
    }

    #[tokio::test]
    async fn test_validate_password_strength() {
        let strong_password = "StrongPassword123!@#".to_string();
        let weak_password = "weak".to_string();

        let strong_result = validate_password_strength(strong_password).await.unwrap();
        assert!(strong_result.is_valid);
        assert!(strong_result.score >= 4);
        assert!(strong_result.issues.is_empty());

        let weak_result = validate_password_strength(weak_password).await.unwrap();
        assert!(!weak_result.is_valid);
        assert!(weak_result.score < 4);
        assert!(!weak_result.issues.is_empty());
    }

    #[tokio::test]
    async fn test_check_vault_setup_status_no_vault() {
        let temp_dir = setup_temp_dir();
        let path = temp_dir.path().to_string_lossy().to_string();

        let result = check_vault_setup_status(path).await.unwrap();

        assert!(result.needs_password);
        assert!(!result.is_encrypted);
        assert!(result.vault_info.is_none());
    }

    #[tokio::test]
    async fn test_check_vault_setup_status_with_vault() {
        let temp_dir = setup_temp_dir();
        let vault_manager = VaultManager::new(temp_dir.path());
        vault_manager
            .initialize_vault("Test Vault".to_string())
            .unwrap();

        let path = temp_dir.path().to_string_lossy().to_string();
        let result = check_vault_setup_status(path).await.unwrap();

        assert!(!result.needs_password);
        assert!(!result.is_encrypted);
        assert!(result.vault_info.is_some());
    }

    #[tokio::test]
    async fn test_create_encrypted_vault() {
        let temp_dir = setup_temp_dir();
        let path = temp_dir.path().to_string_lossy().to_string();
        let vault_name = "Test Encrypted Vault".to_string();
        let password = "TestPassword123!@#".to_string();

        let vault_info = create_encrypted_vault(path.clone(), vault_name.clone(), password.clone())
            .await
            .unwrap();

        assert_eq!(vault_info.name, vault_name);
        assert!(vault_info.is_encrypted);
        assert!(vault_info.crypto.is_some());

        // Verify password works
        let is_valid = verify_vault_password(path, password).await.unwrap();
        assert!(is_valid);
    }

    #[tokio::test]
    async fn test_verify_vault_password() {
        let temp_dir = setup_temp_dir();
        let path = temp_dir.path().to_string_lossy().to_string();
        let vault_name = "Test Vault".to_string();
        let correct_password = "TestPassword123!@#".to_string();
        let wrong_password = "WrongPassword123!@#".to_string();

        create_encrypted_vault(path.clone(), vault_name, correct_password.clone())
            .await
            .unwrap();

        // Test correct password
        let is_valid = verify_vault_password(path.clone(), correct_password)
            .await
            .unwrap();
        assert!(is_valid);

        // Test wrong password
        let is_valid = verify_vault_password(path, wrong_password).await.unwrap();
        assert!(!is_valid);
    }

    #[tokio::test]
    async fn test_get_vault_rate_limit_status() {
        let temp_dir = setup_temp_dir();
        let path = temp_dir.path().to_string_lossy().to_string();

        let result = get_vault_rate_limit_status(path).await.unwrap();

        assert!(!result.is_rate_limited);
        assert!(result.seconds_remaining.is_none());
    }

    #[tokio::test]
    #[serial]
    async fn test_unlock_vault_and_session_management() {
        let temp_dir = setup_temp_dir();
        let path = temp_dir.path().to_string_lossy().to_string();
        let vault_name = "Test Vault".to_string();
        let password = "TestPassword123!@#".to_string();

        create_encrypted_vault(path.clone(), vault_name, password.clone())
            .await
            .unwrap();

        // Unlock vault
        let unlock_result = unlock_vault(path, password).await.unwrap();
        assert!(unlock_result.success);
        assert!(unlock_result.session_id.is_some());
        assert!(unlock_result.vault_info.is_some());
        assert!(unlock_result.error_message.is_none());

        let session_id = unlock_result.session_id.unwrap();

        // Check session status
        let is_active = check_session_status(session_id.clone()).await.unwrap();
        assert!(is_active);

        // Close session
        let closed = close_vault_session(session_id.clone()).await.unwrap();
        assert!(closed);

        // Verify session is closed
        let is_active = check_session_status(session_id).await.unwrap();
        assert!(!is_active);
    }

    #[tokio::test]
    #[serial]
    async fn test_unlock_vault_wrong_password() {
        let temp_dir = setup_temp_dir();
        let path = temp_dir.path().to_string_lossy().to_string();
        let vault_name = "Test Vault".to_string();
        let correct_password = "TestPassword123!@#".to_string();
        let wrong_password = "WrongPassword123!@#".to_string();

        create_encrypted_vault(path.clone(), vault_name, correct_password)
            .await
            .unwrap();

        let unlock_result = unlock_vault(path, wrong_password).await.unwrap();
        assert!(!unlock_result.success);
        assert!(unlock_result.session_id.is_none());
        assert!(unlock_result.vault_info.is_none());
        assert!(unlock_result.error_message.is_some());
    }

    #[tokio::test]
    #[serial]
    async fn test_note_management_workflow() {
        let temp_dir = setup_temp_dir();
        let path = temp_dir.path().to_string_lossy().to_string();
        let vault_name = "Test Vault".to_string();
        let password = "TestPassword123!@#".to_string();

        create_encrypted_vault(path.clone(), vault_name, password.clone())
            .await
            .unwrap();
        let unlock_result = unlock_vault(path.clone(), password).await.unwrap();
        let session_id = unlock_result.session_id.unwrap();

        // Create folder
        create_folder(path.clone(), session_id.clone(), "test_folder".to_string())
            .await
            .unwrap();

        // Get folders list
        let folders = get_folders_list(path.clone(), session_id.clone())
            .await
            .unwrap();
        assert_eq!(folders.len(), 1);
        assert_eq!(folders[0], "test_folder");

        // Create note
        let create_result = create_note(
            path.clone(),
            session_id.clone(),
            Some("Test Note".to_string()),
            Some("Test content".to_string()),
            Some(vec!["tag1".to_string()]),
            Some("test_folder".to_string()),
            Some("text".to_string()),
        )
        .await
        .unwrap();

        assert!(create_result.success);
        assert!(create_result.note.is_some());
        assert!(create_result.error_message.is_none());

        let note = create_result.note.unwrap();
        assert_eq!(note.title, "Test Note");
        assert_eq!(note.content, "Test content");
        assert_eq!(note.tags, vec!["tag1"]);
        assert_eq!(note.folder_path, Some("test_folder".to_string()));

        // Get notes list
        let notes_list = get_notes_list(path.clone(), session_id.clone())
            .await
            .unwrap();
        assert_eq!(notes_list.len(), 1);
        assert_eq!(notes_list[0].id, note.id);

        // Load note
        let loaded_note = load_note(path.clone(), session_id.clone(), note.id.clone())
            .await
            .unwrap();
        assert_eq!(loaded_note.title, "Test Note");
        assert_eq!(loaded_note.content, "Test content");

        // Save note with changes
        let save_result = save_note(
            path.clone(),
            session_id.clone(),
            note.id.clone(),
            Some("Updated Title".to_string()),
            Some("Updated content".to_string()),
            Some(vec!["tag1".to_string(), "tag2".to_string()]),
            Some("test_folder".to_string()),
        )
        .await
        .unwrap();

        assert!(save_result.success);
        assert!(save_result.note.is_some());

        let updated_note = save_result.note.unwrap();
        assert_eq!(updated_note.title, "Updated Title");
        assert_eq!(updated_note.content, "Updated content");
        assert_eq!(updated_note.tags.len(), 2);

        // Move note
        let moved = move_note(
            path.clone(),
            session_id.clone(),
            note.id.clone(),
            Some("new_folder".to_string()),
        )
        .await
        .unwrap();
        assert!(moved);

        // Delete note
        let deleted = delete_note(path.clone(), session_id.clone(), note.id)
            .await
            .unwrap();
        assert!(deleted);

        // Verify note is deleted
        let notes_list = get_notes_list(path.clone(), session_id.clone())
            .await
            .unwrap();
        assert_eq!(notes_list.len(), 0);

        // Delete folder
        let folder_deleted =
            delete_folder(path.clone(), session_id.clone(), "test_folder".to_string())
                .await
                .unwrap();
        assert!(folder_deleted);

        close_vault_session(session_id).await.unwrap();
    }

    #[tokio::test]
    #[serial]
    async fn test_folder_operations() {
        let temp_dir = setup_temp_dir();
        let path = temp_dir.path().to_string_lossy().to_string();
        let vault_name = "Test Vault".to_string();
        let password = "TestPassword123!@#".to_string();

        create_encrypted_vault(path.clone(), vault_name, password.clone())
            .await
            .unwrap();
        let unlock_result = unlock_vault(path.clone(), password).await.unwrap();
        let session_id = unlock_result.session_id.unwrap();

        // Create folders
        create_folder(path.clone(), session_id.clone(), "folder1".to_string())
            .await
            .unwrap();
        create_folder(path.clone(), session_id.clone(), "folder2".to_string())
            .await
            .unwrap();

        // Move folder
        let moved = move_folder(
            path.clone(),
            session_id.clone(),
            "folder1".to_string(),
            "renamed_folder".to_string(),
        )
        .await
        .unwrap();
        assert!(moved);

        // Rename folder
        let renamed = rename_folder(
            path.clone(),
            session_id.clone(),
            "folder2".to_string(),
            "new_name".to_string(),
        )
        .await
        .unwrap();
        assert!(renamed);

        // Verify folders
        let folders = get_folders_list(path.clone(), session_id.clone())
            .await
            .unwrap();
        assert_eq!(folders.len(), 2);
        assert!(folders.contains(&"renamed_folder".to_string()));
        assert!(folders.contains(&"new_name".to_string()));
        assert!(!folders.contains(&"folder1".to_string()));
        assert!(!folders.contains(&"folder2".to_string()));

        close_vault_session(session_id).await.unwrap();
    }

    #[test]
    fn test_app_error_serialization() {
        let error = AppError::Application("Test error".to_string());
        let serialized = serde_json::to_string(&error).unwrap();

        // Should serialize as a string
        assert!(serialized.contains("Test error"));
    }

    #[test]
    fn test_app_error_from_conversions() {
        // Test conversion from std::io::Error
        let io_error = std::io::Error::new(std::io::ErrorKind::NotFound, "File not found");
        let app_error = AppError::from(io_error);
        assert!(matches!(app_error, AppError::Io(_)));

        // Test conversion from serde_json::Error
        let json_error = serde_json::from_str::<serde_json::Value>("invalid json").unwrap_err();
        let app_error = AppError::from(json_error);
        assert!(matches!(app_error, AppError::Serialization(_)));
    }

    #[test]
    fn test_request_response_structures() {
        // Test CreateNoteRequest
        let create_request = CreateNoteRequest {
            title: "Test".to_string(),
            content: Some("Content".to_string()),
            tags: Some(vec!["tag1".to_string()]),
            folder_path: Some("folder".to_string()),
        };

        let serialized = serde_json::to_string(&create_request).unwrap();
        let deserialized: CreateNoteRequest = serde_json::from_str(&serialized).unwrap();
        assert_eq!(create_request.title, deserialized.title);

        // Test CreateNoteResult
        let create_result = CreateNoteResult {
            success: true,
            note: None,
            error_message: Some("Test error".to_string()),
        };

        let serialized = serde_json::to_string(&create_result).unwrap();
        let deserialized: CreateNoteResult = serde_json::from_str(&serialized).unwrap();
        assert_eq!(create_result.success, deserialized.success);
        assert_eq!(create_result.error_message, deserialized.error_message);
    }

    #[test]
    fn test_vault_location_info_structure() {
        let info = VaultLocationInfo {
            path: "/test/path".to_string(),
            is_valid: true,
            is_writable: true,
            has_existing_vault: false,
            vault_info: None,
        };

        let serialized = serde_json::to_string(&info).unwrap();
        let deserialized: VaultLocationInfo = serde_json::from_str(&serialized).unwrap();

        assert_eq!(info.path, deserialized.path);
        assert_eq!(info.is_valid, deserialized.is_valid);
        assert_eq!(info.is_writable, deserialized.is_writable);
        assert_eq!(info.has_existing_vault, deserialized.has_existing_vault);
    }

    #[test]
    fn test_vault_unlock_result_structure() {
        let result = VaultUnlockResult {
            success: false,
            session_id: None,
            vault_info: None,
            error_message: Some("Invalid password".to_string()),
        };

        let serialized = serde_json::to_string(&result).unwrap();
        let deserialized: VaultUnlockResult = serde_json::from_str(&serialized).unwrap();

        assert_eq!(result.success, deserialized.success);
        assert_eq!(result.session_id, deserialized.session_id);
        assert_eq!(result.error_message, deserialized.error_message);
    }

    #[test]
    fn test_rate_limit_info_structure() {
        let info = RateLimitInfo {
            is_rate_limited: true,
            seconds_remaining: Some(30),
        };

        let serialized = serde_json::to_string(&info).unwrap();
        let deserialized: RateLimitInfo = serde_json::from_str(&serialized).unwrap();

        assert_eq!(info.is_rate_limited, deserialized.is_rate_limited);
        assert_eq!(info.seconds_remaining, deserialized.seconds_remaining);
    }

    // Integration test for error handling
    #[tokio::test]
    #[serial]
    async fn test_error_handling_invalid_session() {
        let temp_dir = setup_temp_dir();
        let path = temp_dir.path().to_string_lossy().to_string();

        // Try to create note with invalid session
        let result = create_note(
            path,
            "invalid_session_id".to_string(),
            Some("Test".to_string()),
            None,
            None,
            None,
            None,
        )
        .await
        .unwrap();

        assert!(!result.success);
        assert!(result.note.is_none());
        assert!(result.error_message.is_some());
    }

    // Performance test for password validation
    #[tokio::test]
    async fn test_password_validation_performance() {
        use std::time::Instant;

        let password = "TestPassword123!@#".to_string();
        let start = Instant::now();

        // Reduced iterations for faster tests
        for _ in 0..10 {
            let _ = validate_password_strength(password.clone()).await.unwrap();
        }

        let elapsed = start.elapsed();

        // Should complete 100 validations in reasonable time
        assert!(
            elapsed.as_secs() < 5,
            "Password validation took too long: {:?}",
            elapsed
        );
    }
}
