use super::common::{create_and_unlock_test_vault, setup_temp_dir, test_data};
use crate::commands::*;
use serial_test::serial;

#[tokio::test]
#[serial]
async fn test_folder_operations() {
    let temp_dir = setup_temp_dir();
    let (path, session_id) = create_and_unlock_test_vault(&temp_dir).await;

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
        test_data::RENAMED_FOLDER.to_string(),
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
    assert!(folders.contains(&test_data::RENAMED_FOLDER.to_string()));
    assert!(folders.contains(&"new_name".to_string()));
    assert!(!folders.contains(&"folder1".to_string()));
    assert!(!folders.contains(&"folder2".to_string()));

    close_vault_session(session_id).await.unwrap();
}

#[tokio::test]
#[serial]
async fn test_folder_crud_operations() {
    let temp_dir = setup_temp_dir();
    let (path, session_id) = create_and_unlock_test_vault(&temp_dir).await;

    // Create folder
    create_folder(
        path.clone(),
        session_id.clone(),
        test_data::TEST_FOLDER.to_string(),
    )
    .await
    .unwrap();

    // Verify folder exists
    let folders = get_folders_list(path.clone(), session_id.clone())
        .await
        .unwrap();
    assert_eq!(folders.len(), 1);
    assert_eq!(folders[0], test_data::TEST_FOLDER);

    // Delete folder
    let deleted = delete_folder(
        path.clone(),
        session_id.clone(),
        test_data::TEST_FOLDER.to_string(),
    )
    .await
    .unwrap();
    assert!(deleted);

    // Verify folder is deleted
    let folders = get_folders_list(path.clone(), session_id.clone())
        .await
        .unwrap();
    assert_eq!(folders.len(), 0);

    close_vault_session(session_id).await.unwrap();
}

#[tokio::test]
#[serial]
async fn test_folder_hierarchy() {
    let temp_dir = setup_temp_dir();
    let (path, session_id) = create_and_unlock_test_vault(&temp_dir).await;

    // Create nested folders
    create_folder(path.clone(), session_id.clone(), "parent".to_string())
        .await
        .unwrap();
    create_folder(path.clone(), session_id.clone(), "parent/child".to_string())
        .await
        .unwrap();
    create_folder(
        path.clone(),
        session_id.clone(),
        "parent/child/grandchild".to_string(),
    )
    .await
    .unwrap();

    // Verify all folders exist
    let folders = get_folders_list(path.clone(), session_id.clone())
        .await
        .unwrap();
    assert_eq!(folders.len(), 3);
    assert!(folders.contains(&"parent".to_string()));
    assert!(folders.contains(&"parent/child".to_string()));
    assert!(folders.contains(&"parent/child/grandchild".to_string()));

    close_vault_session(session_id).await.unwrap();
}

#[tokio::test]
#[serial]
async fn test_folder_rename_operations() {
    let temp_dir = setup_temp_dir();
    let (path, session_id) = create_and_unlock_test_vault(&temp_dir).await;

    // Create folder
    create_folder(
        path.clone(),
        session_id.clone(),
        "original_name".to_string(),
    )
    .await
    .unwrap();

    // Rename folder
    let renamed = rename_folder(
        path.clone(),
        session_id.clone(),
        "original_name".to_string(),
        "new_name".to_string(),
    )
    .await
    .unwrap();
    assert!(renamed);

    // Verify folder is renamed
    let folders = get_folders_list(path.clone(), session_id.clone())
        .await
        .unwrap();
    assert_eq!(folders.len(), 1);
    assert_eq!(folders[0], "new_name");

    close_vault_session(session_id).await.unwrap();
}

#[tokio::test]
#[serial]
async fn test_folder_move_operations() {
    let temp_dir = setup_temp_dir();
    let (path, session_id) = create_and_unlock_test_vault(&temp_dir).await;

    // Create folder
    create_folder(
        path.clone(),
        session_id.clone(),
        "source_folder".to_string(),
    )
    .await
    .unwrap();

    // Move folder
    let moved = move_folder(
        path.clone(),
        session_id.clone(),
        "source_folder".to_string(),
        "destination_folder".to_string(),
    )
    .await
    .unwrap();
    assert!(moved);

    // Verify folder is moved
    let folders = get_folders_list(path.clone(), session_id.clone())
        .await
        .unwrap();
    assert_eq!(folders.len(), 1);
    assert_eq!(folders[0], "destination_folder");

    close_vault_session(session_id).await.unwrap();
}

#[tokio::test]
#[serial]
async fn test_folder_error_handling_invalid_session() {
    let temp_dir = setup_temp_dir();
    let path = temp_dir.path().to_string_lossy().to_string();

    // Try to create folder with invalid session
    let result = create_folder(
        path,
        "invalid_session_id".to_string(),
        "test_folder".to_string(),
    )
    .await;

    assert!(result.is_err());
}

#[tokio::test]
#[serial]
async fn test_empty_folders_list() {
    let temp_dir = setup_temp_dir();
    let (path, session_id) = create_and_unlock_test_vault(&temp_dir).await;

    // Get folders list when no folders exist
    let folders = get_folders_list(path.clone(), session_id.clone())
        .await
        .unwrap();
    assert_eq!(folders.len(), 0);

    close_vault_session(session_id).await.unwrap();
}
