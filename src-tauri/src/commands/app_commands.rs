use anyhow::Result;

use crate::crypto::{CryptoManager, PasswordStrength, SecurePassword};
use crate::errors::AppError;

#[tauri::command]
pub async fn validate_password_strength(password: String) -> Result<PasswordStrength, AppError> {
    let crypto_manager = CryptoManager::new();
    let secure_password = SecurePassword::new(password);
    Ok(crypto_manager.validate_password_strength(&secure_password))
}
