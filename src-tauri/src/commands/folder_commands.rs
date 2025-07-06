use anyhow::Result;
use std::path::PathBuf;

use crate::errors::AppError;
use crate::vault::VaultManager;

#[tauri::command]
pub async fn get_folders_list(
    vault_path: String,
    session_id: String,
) -> Result<Vec<String>, AppError> {
    let path_buf = std::path::PathBuf::from(&vault_path);
    let vault_manager = VaultManager::new(&path_buf);

    Ok(vault_manager.get_folders_list(&session_id)?)
}

#[tauri::command]
pub async fn create_folder(
    vault_path: String,
    session_id: String,
    folder_path: String,
) -> Result<(), AppError> {
    let vault_manager = VaultManager::new(&vault_path);
    vault_manager.create_folder(&session_id, folder_path)?;
    Ok(())
}

#[tauri::command]
pub async fn delete_folder(
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
pub async fn move_folder(
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
pub async fn rename_folder(
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
