use anyhow::Result;

use crate::errors::AppError;
use crate::types::*;
use crate::vault::{Note, NoteMetadata, VaultError, VaultManager};

#[tauri::command]
pub async fn create_note(
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
pub async fn get_notes_list(
    vault_path: String,
    session_id: String,
) -> Result<Vec<NoteMetadata>, AppError> {
    let path_buf = std::path::PathBuf::from(&vault_path);
    let vault_manager = VaultManager::new(&path_buf);

    Ok(vault_manager.get_notes_list(&session_id)?)
}

#[tauri::command]
pub async fn load_note(
    vault_path: String,
    session_id: String,
    note_id: String,
) -> Result<Note, AppError> {
    let path_buf = std::path::PathBuf::from(&vault_path);
    let vault_manager = VaultManager::new(&path_buf);

    Ok(vault_manager.load_note(&session_id, &note_id)?)
}

#[tauri::command]
pub async fn save_note(
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
pub async fn delete_note(
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
pub async fn move_note(
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
