use anyhow::Result;

use crate::config::AppConfig;
use crate::crypto::{CryptoManager, PasswordStrength, SecurePassword};
use crate::errors::AppError;
use crate::types::*;

#[tauri::command]
pub fn get_app_info() -> Result<AppInfo, AppError> {
    Ok(AppInfo {
        name: "Cocobolo".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        description: "A secure, encrypted note-taking application".to_string(),
    })
}

#[tauri::command]
pub fn greet(name: &str) -> Result<String, AppError> {
    if name.trim().is_empty() {
        return Err(AppError::Application("Name cannot be empty".to_string()));
    }
    Ok(format!(
        "Hello, {}! Welcome to Cocobolo - your secure note-taking companion!",
        name
    ))
}

#[tauri::command]
pub async fn get_app_config() -> Result<AppConfig, AppError> {
    let config = AppConfig::load()?;
    Ok(config)
}

#[tauri::command]
pub async fn validate_password_strength(password: String) -> Result<PasswordStrength, AppError> {
    let crypto_manager = CryptoManager::new();
    let secure_password = SecurePassword::new(password);
    Ok(crypto_manager.validate_password_strength(&secure_password))
}
