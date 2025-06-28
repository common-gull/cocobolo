use anyhow::Result;
use serde::{Deserialize, Serialize};
use thiserror::Error;

mod config;
mod vault;

use config::{AppConfig, ConfigError};
use vault::{VaultManager, VaultInfo, VaultError};

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
            get_app_config
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
