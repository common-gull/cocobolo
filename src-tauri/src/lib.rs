use anyhow::Result;
use serde::{Deserialize, Serialize};
use thiserror::Error;

mod config;
mod crypto;
mod vault;

use config::{AppConfig, ConfigError};
use crypto::{CryptoError, CryptoManager, PasswordStrength, SecurePassword};
use vault::{VaultManager, VaultInfo, VaultError, Note, NoteMetadata};

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
    Ok(format!("Hello, {}! Welcome to Cocobolo - your secure note-taking companion!", name))
}

#[tauri::command]
async fn select_vault_directory() -> Result<Option<String>, AppError> {
    // This command is not used - directory selection is handled in the frontend
    // using the dialog plugin directly
    Err(AppError::Application("This command should be called from the frontend".to_string()))
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
        return Err(AppError::Application("Selected path is not a directory".to_string()));
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

#[tauri::command]
async fn set_vault_location(path: String) -> Result<(), AppError> {
    let mut config = AppConfig::load()?;
    config.set_vault_location(&path)?;
    config.save()?;
    Ok(())
}

#[tauri::command]
async fn get_current_vault_location() -> Result<Option<String>, AppError> {
    let config = AppConfig::load()?;
    Ok(config.get_vault_location().map(|p| p.display().to_string()))
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
async fn create_encrypted_vault(path: String, vault_name: String, password: String) -> Result<VaultInfo, AppError> {
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
                    format!("Too many failed attempts. Please wait {} seconds before trying again.", seconds)
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
    folder_path: Option<String>
) -> Result<CreateNoteResult, AppError> {
    let path_buf = std::path::PathBuf::from(&vault_path);
    let vault_manager = VaultManager::new(&path_buf);
    
    match vault_manager.create_note(&session_id, title, content, tags, folder_path) {
        Ok(note) => Ok(CreateNoteResult {
            success: true,
            note: Some(note),
            error_message: None,
        }),
        Err(vault_error) => {
            let error_message = match &vault_error {
                VaultError::InvalidNoteTitle(msg) => msg.clone(),
                VaultError::InvalidPassword => "Session expired. Please unlock vault again.".to_string(),
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
    session_id: String
) -> Result<Vec<NoteMetadata>, AppError> {
    let path_buf = std::path::PathBuf::from(&vault_path);
    let vault_manager = VaultManager::new(&path_buf);
    
    Ok(vault_manager.get_notes_list(&session_id)?)
}

#[tauri::command]
async fn get_folders_list(
    vault_path: String,
    session_id: String
) -> Result<Vec<String>, AppError> {
    let path_buf = std::path::PathBuf::from(&vault_path);
    let vault_manager = VaultManager::new(&path_buf);
    
    Ok(vault_manager.get_folders_list(&session_id)?)
}

#[tauri::command]
async fn load_note(
    vault_path: String,
    session_id: String,
    note_id: String
) -> Result<Note, AppError> {
    let path_buf = std::path::PathBuf::from(&vault_path);
    let vault_manager = VaultManager::new(&path_buf);
    
    Ok(vault_manager.load_note(&session_id, &note_id)?)
}

#[tauri::command]
async fn create_folder(
    vault_path: String,
    session_id: String,
    folder_path: String
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
    folder_path: Option<String>
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
                VaultError::InvalidPassword => "Session expired. Please unlock vault again.".to_string(),
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
    note_id: String
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
    folder_path: String
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
    new_folder_path: Option<String>
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
    new_path: String
) -> Result<bool, AppError> {
    let path_buf = std::path::PathBuf::from(&vault_path);
    let vault_manager = VaultManager::new(&path_buf);
    
    match vault_manager.move_folder(&session_id, &old_path, &new_path) {
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
            move_folder
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
