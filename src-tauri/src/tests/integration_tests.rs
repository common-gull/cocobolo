use super::common::{setup_temp_dir, setup_test_env, test_data};
use crate::commands::*;
use crate::types::*;
use serial_test::serial;

/// Integration test for the complete vault creation and management workflow
#[tokio::test]
#[serial]
async fn test_complete_vault_workflow() {
    let temp_dir = setup_temp_dir();
    setup_test_env(&temp_dir);

    // Step 1: Create encrypted vault
    let path = temp_dir.path().to_string_lossy().to_string();
    let vault_info = create_encrypted_vault(
        path.clone(),
        test_data::TEST_VAULT_NAME.to_string(),
        test_data::TEST_PASSWORD.to_string(),
    )
    .await
    .unwrap();

    assert_eq!(vault_info.name, test_data::TEST_VAULT_NAME);
    assert!(vault_info.is_encrypted);

    // Step 2: Add vault to known vaults
    let add_request = AddVaultRequest {
        name: test_data::TEST_VAULT_NAME.to_string(),
        path: path.clone(),
    };
    let add_result = add_known_vault(add_request).await.unwrap();
    assert!(add_result.success);
    let vault_id = add_result.vault_id.unwrap();

    // Step 3: Set as current vault
    set_current_vault(Some(vault_id.clone())).await.unwrap();

    // Step 4: Verify vault is in known vaults
    let known_vaults = get_known_vaults().await.unwrap();
    assert_eq!(known_vaults.len(), 1);
    assert_eq!(known_vaults[0].id, vault_id);

    // Step 5: Unlock vault
    let unlock_result = unlock_vault(path.clone(), test_data::TEST_PASSWORD.to_string())
        .await
        .unwrap();
    assert!(unlock_result.success);
    let session_id = unlock_result.session_id.unwrap();

    // Step 6: Create folders and notes
    create_folder(
        path.clone(),
        session_id.clone(),
        test_data::TEST_FOLDER.to_string(),
    )
    .await
    .unwrap();

    let create_note_result = create_note(
        path.clone(),
        session_id.clone(),
        Some(test_data::TEST_NOTE_TITLE.to_string()),
        Some(test_data::TEST_NOTE_CONTENT.to_string()),
        Some(vec!["integration".to_string(), "test".to_string()]),
        Some(test_data::TEST_FOLDER.to_string()),
        Some("text".to_string()),
    )
    .await
    .unwrap();

    assert!(create_note_result.success);
    let note = create_note_result.note.unwrap();

    // Step 7: Verify note operations
    let notes_list = get_notes_list(path.clone(), session_id.clone())
        .await
        .unwrap();
    assert_eq!(notes_list.len(), 1);

    let loaded_note = load_note(path.clone(), session_id.clone(), note.id.clone())
        .await
        .unwrap();
    assert_eq!(loaded_note.title, test_data::TEST_NOTE_TITLE);

    // Step 8: Close session
    let closed = close_vault_session(session_id).await.unwrap();
    assert!(closed);

    // Step 9: Clean up
    let removed = remove_known_vault(vault_id).await.unwrap();
    assert!(removed);
}

/// Integration test for multi-vault management
#[tokio::test]
#[serial]
async fn test_multi_vault_management() {
    let temp_dir = setup_temp_dir();
    setup_test_env(&temp_dir);

    // Create multiple vaults
    let vault1_path = temp_dir.path().join("vault1");
    let vault2_path = temp_dir.path().join("vault2");
    std::fs::create_dir_all(&vault1_path).unwrap();
    std::fs::create_dir_all(&vault2_path).unwrap();

    // Add first vault
    let request1 = AddVaultRequest {
        name: "Vault 1".to_string(),
        path: vault1_path.to_string_lossy().to_string(),
    };
    let result1 = add_known_vault(request1).await.unwrap();
    assert!(result1.success);
    let vault1_id = result1.vault_id.unwrap();

    // Add second vault
    let request2 = AddVaultRequest {
        name: "Vault 2".to_string(),
        path: vault2_path.to_string_lossy().to_string(),
    };
    let result2 = add_known_vault(request2).await.unwrap();
    assert!(result2.success);
    let vault2_id = result2.vault_id.unwrap();

    // Verify both vaults exist
    let known_vaults = get_known_vaults().await.unwrap();
    assert_eq!(known_vaults.len(), 2);

    // Set vault 1 as current
    set_current_vault(Some(vault1_id.clone())).await.unwrap();
    let current_vault = get_current_vault().await.unwrap();
    assert!(current_vault.is_some());
    assert_eq!(current_vault.unwrap().id, vault1_id);

    // Mark vault 2 as favorite
    let update_request = UpdateVaultMetadataRequest {
        vault_id: vault2_id.clone(),
        name: None,
        is_favorite: Some(true),
    };
    update_vault_metadata(update_request).await.unwrap();

    // Verify favorites
    let favorites = get_favorite_vaults().await.unwrap();
    assert_eq!(favorites.len(), 1);
    assert_eq!(favorites[0].id, vault2_id);

    // Clean up
    remove_known_vault(vault1_id).await.unwrap();
    remove_known_vault(vault2_id).await.unwrap();
}

/// Integration test for error handling across the system
#[tokio::test]
#[serial]
async fn test_error_handling_integration() {
    let temp_dir = setup_temp_dir();
    let path = temp_dir.path().to_string_lossy().to_string();

    // Test invalid vault operations
    let invalid_session = "invalid_session_id".to_string();

    // Try to create note with invalid session
    let note_result = create_note(
        path.clone(),
        invalid_session.clone(),
        Some("Test".to_string()),
        None,
        None,
        None,
        None,
    )
    .await
    .unwrap();
    assert!(!note_result.success);
    assert!(note_result.error_message.is_some());

    // Try to create folder with invalid session
    let folder_result = create_folder(path.clone(), invalid_session, "test".to_string()).await;
    assert!(folder_result.is_err());

    // Test invalid vault path
    let invalid_path = "/nonexistent/path".to_string();
    let location_info = validate_vault_location(invalid_path).await.unwrap();
    assert!(!location_info.is_valid);

    // Test wrong password
    create_encrypted_vault(
        path.clone(),
        test_data::TEST_VAULT_NAME.to_string(),
        test_data::TEST_PASSWORD.to_string(),
    )
    .await
    .unwrap();

    let unlock_result = unlock_vault(path, test_data::WRONG_PASSWORD.to_string())
        .await
        .unwrap();
    assert!(!unlock_result.success);
    assert!(unlock_result.error_message.is_some());
}

/// Integration test for session management
#[tokio::test]
#[serial]
async fn test_session_management_integration() {
    let temp_dir = setup_temp_dir();
    let path = temp_dir.path().to_string_lossy().to_string();

    // Create and unlock vault
    create_encrypted_vault(
        path.clone(),
        test_data::TEST_VAULT_NAME.to_string(),
        test_data::TEST_PASSWORD.to_string(),
    )
    .await
    .unwrap();

    let unlock_result = unlock_vault(path.clone(), test_data::TEST_PASSWORD.to_string())
        .await
        .unwrap();
    let session_id = unlock_result.session_id.unwrap();

    // Verify session is active
    let is_active = check_session_status(session_id.clone()).await.unwrap();
    assert!(is_active);

    // Use session for operations
    create_folder(path.clone(), session_id.clone(), "test".to_string())
        .await
        .unwrap();

    let create_result = create_note(
        path.clone(),
        session_id.clone(),
        Some("Session Test".to_string()),
        None,
        None,
        None,
        None,
    )
    .await
    .unwrap();
    assert!(create_result.success);

    // Close session
    let closed = close_vault_session(session_id.clone()).await.unwrap();
    assert!(closed);

    // Verify session is closed
    let is_active = check_session_status(session_id.clone()).await.unwrap();
    assert!(!is_active);

    // Try to use closed session
    let result = create_note(
        path,
        session_id,
        Some("Should Fail".to_string()),
        None,
        None,
        None,
        None,
    )
    .await
    .unwrap();
    assert!(!result.success);
}

/// Integration test for data consistency
#[tokio::test]
#[serial]
async fn test_data_consistency_integration() {
    let temp_dir = setup_temp_dir();
    let path = temp_dir.path().to_string_lossy().to_string();

    // Create encrypted vault
    create_encrypted_vault(
        path.clone(),
        test_data::TEST_VAULT_NAME.to_string(),
        test_data::TEST_PASSWORD.to_string(),
    )
    .await
    .unwrap();

    // Unlock vault
    let unlock_result = unlock_vault(path.clone(), test_data::TEST_PASSWORD.to_string())
        .await
        .unwrap();
    let session_id = unlock_result.session_id.unwrap();

    // Create hierarchical structure
    create_folder(path.clone(), session_id.clone(), "parent".to_string())
        .await
        .unwrap();
    create_folder(path.clone(), session_id.clone(), "parent/child".to_string())
        .await
        .unwrap();

    // Create notes in different folders
    let note1_result = create_note(
        path.clone(),
        session_id.clone(),
        Some("Root Note".to_string()),
        Some("Content in root".to_string()),
        Some(vec!["root".to_string()]),
        None,
        Some("text".to_string()),
    )
    .await
    .unwrap();

    let _note2_result = create_note(
        path.clone(),
        session_id.clone(),
        Some("Parent Note".to_string()),
        Some("Content in parent".to_string()),
        Some(vec!["parent".to_string()]),
        Some("parent".to_string()),
        Some("text".to_string()),
    )
    .await
    .unwrap();

    let _note3_result = create_note(
        path.clone(),
        session_id.clone(),
        Some("Child Note".to_string()),
        Some("Content in child".to_string()),
        Some(vec!["child".to_string()]),
        Some("parent/child".to_string()),
        Some("text".to_string()),
    )
    .await
    .unwrap();

    // Verify all notes exist
    let notes_list = get_notes_list(path.clone(), session_id.clone())
        .await
        .unwrap();
    assert_eq!(notes_list.len(), 3);

    // Verify folder structure
    let folders = get_folders_list(path.clone(), session_id.clone())
        .await
        .unwrap();
    assert_eq!(folders.len(), 2);
    assert!(folders.contains(&"parent".to_string()));
    assert!(folders.contains(&"parent/child".to_string()));

    // Move note between folders
    let note1_id = note1_result.note.unwrap().id;
    let moved = move_note(
        path.clone(),
        session_id.clone(),
        note1_id.clone(),
        Some("parent".to_string()),
    )
    .await
    .unwrap();
    assert!(moved);

    // Verify note moved
    let loaded_note = load_note(path.clone(), session_id.clone(), note1_id)
        .await
        .unwrap();
    assert_eq!(loaded_note.folder_path, Some("parent".to_string()));

    // Close session
    close_vault_session(session_id).await.unwrap();
}
