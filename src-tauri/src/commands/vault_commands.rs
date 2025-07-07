use anyhow::Result;

use crate::config::{AppConfig, KnownVault};
use crate::crypto::SecurePassword;
use crate::errors::AppError;
use crate::types::*;
use crate::vault::{VaultError, VaultInfo, VaultManager};

#[tauri::command]
pub async fn select_vault_directory() -> Result<Option<String>, AppError> {
    // This command is not used - directory selection is handled in the frontend
    // using the dialog plugin directly
    Err(AppError::Application(
        "This command should be called from the frontend".to_string(),
    ))
}

#[tauri::command]
pub async fn validate_vault_location(path: String) -> Result<VaultLocationInfo, AppError> {
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
pub async fn set_vault_location(path: String) -> Result<(), AppError> {
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
pub async fn get_current_vault_location() -> Result<Option<String>, AppError> {
    let config = AppConfig::load()?;

    // Use the modern multi-vault approach
    if let Some(current_vault) = config.get_current_vault() {
        return Ok(Some(current_vault.path.display().to_string()));
    }

    Ok(None)
}

// New multi-vault commands
#[tauri::command]
pub async fn add_known_vault(request: AddVaultRequest) -> Result<AddVaultResult, AppError> {
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
pub async fn remove_known_vault(vault_id: String) -> Result<bool, AppError> {
    let mut config = AppConfig::load()?;
    config.remove_known_vault(&vault_id)?;
    config.save()?;
    Ok(true)
}

#[tauri::command]
pub async fn get_known_vaults() -> Result<Vec<KnownVault>, AppError> {
    let config = AppConfig::load()?;
    Ok(config.get_known_vaults().to_vec())
}

#[tauri::command]
pub async fn get_current_vault() -> Result<Option<KnownVault>, AppError> {
    let config = AppConfig::load()?;
    Ok(config.get_current_vault().cloned())
}

#[tauri::command]
pub async fn set_current_vault(vault_id: Option<String>) -> Result<(), AppError> {
    let mut config = AppConfig::load()?;
    config.set_current_vault(vault_id)?;
    config.save()?;
    Ok(())
}

#[tauri::command]
pub async fn get_recent_vaults() -> Result<Vec<KnownVault>, AppError> {
    let config = AppConfig::load()?;
    Ok(config.get_recent_vaults().into_iter().cloned().collect())
}

#[tauri::command]
pub async fn get_favorite_vaults() -> Result<Vec<KnownVault>, AppError> {
    let config = AppConfig::load()?;
    Ok(config.get_favorite_vaults().into_iter().cloned().collect())
}

#[tauri::command]
pub async fn update_vault_metadata(request: UpdateVaultMetadataRequest) -> Result<(), AppError> {
    let mut config = AppConfig::load()?;
    config.update_vault_metadata(&request.vault_id, request.name, request.is_favorite)?;
    config.save()?;
    Ok(())
}

#[tauri::command]
pub async fn cleanup_invalid_vaults() -> Result<Vec<String>, AppError> {
    let mut config = AppConfig::load()?;
    let removed_ids = config.cleanup_invalid_vaults();
    if !removed_ids.is_empty() {
        config.save()?;
    }
    Ok(removed_ids)
}

#[tauri::command]
pub async fn check_vault_setup_status(path: String) -> Result<VaultSetupStatus, AppError> {
    let path_buf = std::path::PathBuf::from(&path);
    let vault_manager = VaultManager::new(&path_buf);

    if !vault_manager.vault_exists() {
        return Ok(VaultSetupStatus {
            needs_password: true,
            is_encrypted: false,
            vault_info: None,
        });
    }

    let vault_info = vault_manager.load_vault_info()?;
    let is_encrypted = vault_info.is_encrypted;

    Ok(VaultSetupStatus {
        needs_password: is_encrypted,
        is_encrypted,
        vault_info: Some(vault_info),
    })
}

#[tauri::command]
pub async fn create_encrypted_vault(
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
pub async fn verify_vault_password(path: String, password: String) -> Result<bool, AppError> {
    let path_buf = std::path::PathBuf::from(&path);
    let vault_manager = VaultManager::new(&path_buf);
    let secure_password = SecurePassword::new(password);

    Ok(vault_manager.verify_vault_password(&secure_password)?)
}

// Vault unlock and session management commands

#[tauri::command]
pub async fn get_vault_rate_limit_status(path: String) -> Result<RateLimitInfo, AppError> {
    let path_buf = std::path::PathBuf::from(&path);
    let vault_manager = VaultManager::new(&path_buf);

    let (is_rate_limited, seconds_remaining) = vault_manager.get_rate_limit_status();

    Ok(RateLimitInfo {
        is_rate_limited,
        seconds_remaining,
    })
}

#[tauri::command]
pub async fn unlock_vault(path: String, password: String) -> Result<VaultUnlockResult, AppError> {
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
pub async fn close_vault_session(session_id: String) -> Result<bool, AppError> {
    Ok(VaultManager::close_session(&session_id))
}

#[tauri::command]
pub async fn check_session_status(session_id: String) -> Result<bool, AppError> {
    Ok(VaultManager::get_session(&session_id).is_some())
}
