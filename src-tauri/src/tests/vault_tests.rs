use super::common::{create_test_vault_request, setup_temp_dir, setup_test_env, test_data};
use crate::commands::*;
use crate::errors::AppError;
use crate::types::*;
use crate::vault::VaultManager;
use serial_test::serial;

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
        .initialize_vault(test_data::TEST_VAULT_NAME.to_string())
        .unwrap();

    let path = temp_dir.path().to_string_lossy().to_string();
    let result = validate_vault_location(path.clone()).await.unwrap();

    assert_eq!(result.path, path);
    assert!(result.is_valid);
    assert!(result.is_writable);
    assert!(result.has_existing_vault);
    assert!(result.vault_info.is_some());
    assert_eq!(result.vault_info.unwrap().name, test_data::TEST_VAULT_NAME);
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

    let request = create_test_vault_request(&temp_dir, test_data::TEST_VAULT_NAME);

    // Add vault
    let result = add_known_vault(request.clone()).await.unwrap();
    assert!(result.success);
    assert!(result.vault_id.is_some());
    assert!(result.error_message.is_none());

    // Get known vaults
    let vaults = get_known_vaults().await.unwrap();
    assert_eq!(vaults.len(), 1);
    assert_eq!(vaults[0].name, test_data::TEST_VAULT_NAME);
    assert_eq!(vaults[0].path.to_string_lossy(), request.path);
}

#[tokio::test]
#[serial]
async fn test_remove_known_vault() {
    let temp_dir = setup_temp_dir();
    setup_test_env(&temp_dir);

    let request = create_test_vault_request(&temp_dir, test_data::TEST_VAULT_NAME);
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

    let request = create_test_vault_request(&temp_dir, test_data::TEST_VAULT_NAME);
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

    let request = create_test_vault_request(&temp_dir, test_data::TEST_VAULT_NAME);
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
    let valid_request = create_test_vault_request(&temp_dir, "valid_vault");
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
    assert_eq!(vaults[0].name, "valid_vault");
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
        .initialize_vault(test_data::TEST_VAULT_NAME.to_string())
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

    let vault_info = create_encrypted_vault(
        path.clone(),
        test_data::TEST_VAULT_NAME.to_string(),
        test_data::TEST_PASSWORD.to_string(),
    )
    .await
    .unwrap();

    assert_eq!(vault_info.name, test_data::TEST_VAULT_NAME);
    assert!(vault_info.is_encrypted);
    assert!(vault_info.crypto.is_some());

    // Verify password works
    let is_valid = verify_vault_password(path, test_data::TEST_PASSWORD.to_string())
        .await
        .unwrap();
    assert!(is_valid);
}

#[tokio::test]
async fn test_verify_vault_password() {
    let temp_dir = setup_temp_dir();
    let path = temp_dir.path().to_string_lossy().to_string();

    create_encrypted_vault(
        path.clone(),
        test_data::TEST_VAULT_NAME.to_string(),
        test_data::TEST_PASSWORD.to_string(),
    )
    .await
    .unwrap();

    // Test correct password
    let is_valid = verify_vault_password(path.clone(), test_data::TEST_PASSWORD.to_string())
        .await
        .unwrap();
    assert!(is_valid);

    // Test wrong password
    let is_valid = verify_vault_password(path, test_data::WRONG_PASSWORD.to_string())
        .await
        .unwrap();
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

    create_encrypted_vault(
        path.clone(),
        test_data::TEST_VAULT_NAME.to_string(),
        test_data::TEST_PASSWORD.to_string(),
    )
    .await
    .unwrap();

    // Unlock vault
    let unlock_result = unlock_vault(path, test_data::TEST_PASSWORD.to_string())
        .await
        .unwrap();
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
    assert!(unlock_result.session_id.is_none());
    assert!(unlock_result.vault_info.is_none());
    assert!(unlock_result.error_message.is_some());
}
