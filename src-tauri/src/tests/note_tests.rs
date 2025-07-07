use super::common::{create_and_unlock_test_vault, setup_temp_dir, test_data};
use crate::commands::*;
use serial_test::serial;

#[tokio::test]
#[serial]
async fn test_note_management_workflow() {
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

    // Get folders list
    let folders = get_folders_list(path.clone(), session_id.clone())
        .await
        .unwrap();
    assert_eq!(folders.len(), 1);
    assert_eq!(folders[0], test_data::TEST_FOLDER);

    // Create note
    let create_result = create_note(
        path.clone(),
        session_id.clone(),
        Some(test_data::TEST_NOTE_TITLE.to_string()),
        Some(test_data::TEST_NOTE_CONTENT.to_string()),
        Some(vec!["tag1".to_string()]),
        Some(test_data::TEST_FOLDER.to_string()),
        Some("text".to_string()),
    )
    .await
    .unwrap();

    assert!(create_result.success);
    assert!(create_result.note.is_some());
    assert!(create_result.error_message.is_none());

    let note = create_result.note.unwrap();
    assert_eq!(note.title, test_data::TEST_NOTE_TITLE);
    assert_eq!(note.content, test_data::TEST_NOTE_CONTENT);
    assert_eq!(note.tags, vec!["tag1"]);
    assert_eq!(note.folder_path, Some(test_data::TEST_FOLDER.to_string()));

    // Get notes list
    let notes_list = get_notes_list(path.clone(), session_id.clone())
        .await
        .unwrap();
    assert_eq!(notes_list.len(), 1);
    assert_eq!(notes_list[0].id, note.id);

    // Load note
    let loaded_note = load_note(path.clone(), session_id.clone(), note.id.clone())
        .await
        .unwrap();
    assert_eq!(loaded_note.title, test_data::TEST_NOTE_TITLE);
    assert_eq!(loaded_note.content, test_data::TEST_NOTE_CONTENT);

    // Save note with changes
    let save_result = save_note(
        path.clone(),
        session_id.clone(),
        note.id.clone(),
        Some(test_data::UPDATED_NOTE_TITLE.to_string()),
        Some(test_data::UPDATED_NOTE_CONTENT.to_string()),
        Some(vec!["tag1".to_string(), "tag2".to_string()]),
        Some(test_data::TEST_FOLDER.to_string()),
    )
    .await
    .unwrap();

    assert!(save_result.success);
    assert!(save_result.note.is_some());

    let updated_note = save_result.note.unwrap();
    assert_eq!(updated_note.title, test_data::UPDATED_NOTE_TITLE);
    assert_eq!(updated_note.content, test_data::UPDATED_NOTE_CONTENT);
    assert_eq!(updated_note.tags.len(), 2);

    // Move note
    let moved = move_note(
        path.clone(),
        session_id.clone(),
        note.id.clone(),
        Some(test_data::NEW_FOLDER.to_string()),
    )
    .await
    .unwrap();
    assert!(moved);

    // Delete note
    let deleted = delete_note(path.clone(), session_id.clone(), note.id)
        .await
        .unwrap();
    assert!(deleted);

    // Verify note is deleted
    let notes_list = get_notes_list(path.clone(), session_id.clone())
        .await
        .unwrap();
    assert_eq!(notes_list.len(), 0);

    // Delete folder
    let folder_deleted = delete_folder(
        path.clone(),
        session_id.clone(),
        test_data::TEST_FOLDER.to_string(),
    )
    .await
    .unwrap();
    assert!(folder_deleted);

    close_vault_session(session_id).await.unwrap();
}

#[tokio::test]
#[serial]
async fn test_create_note_minimal() {
    let temp_dir = setup_temp_dir();
    let (path, session_id) = create_and_unlock_test_vault(&temp_dir).await;

    // Create note with minimal parameters
    let create_result = create_note(
        path.clone(),
        session_id.clone(),
        Some("Minimal Note".to_string()),
        None,
        None,
        None,
        None,
    )
    .await
    .unwrap();

    assert!(create_result.success);
    assert!(create_result.note.is_some());
    assert!(create_result.error_message.is_none());

    let note = create_result.note.unwrap();
    assert_eq!(note.title, "Minimal Note");
    assert_eq!(note.content, "");
    assert!(note.tags.is_empty());
    assert!(note.folder_path.is_none());

    close_vault_session(session_id).await.unwrap();
}

#[tokio::test]
#[serial]
async fn test_note_crud_operations() {
    let temp_dir = setup_temp_dir();
    let (path, session_id) = create_and_unlock_test_vault(&temp_dir).await;

    // Create note
    let create_result = create_note(
        path.clone(),
        session_id.clone(),
        Some("CRUD Test Note".to_string()),
        Some("Initial content".to_string()),
        Some(vec!["crud".to_string()]),
        None,
        Some("text".to_string()),
    )
    .await
    .unwrap();

    let note_id = create_result.note.unwrap().id;

    // Read note
    let loaded_note = load_note(path.clone(), session_id.clone(), note_id.clone())
        .await
        .unwrap();
    assert_eq!(loaded_note.title, "CRUD Test Note");
    assert_eq!(loaded_note.content, "Initial content");

    // Update note
    let save_result = save_note(
        path.clone(),
        session_id.clone(),
        note_id.clone(),
        Some("Updated CRUD Note".to_string()),
        Some("Updated content".to_string()),
        Some(vec!["crud".to_string(), "updated".to_string()]),
        None,
    )
    .await
    .unwrap();

    assert!(save_result.success);
    let updated_note = save_result.note.unwrap();
    assert_eq!(updated_note.title, "Updated CRUD Note");
    assert_eq!(updated_note.content, "Updated content");
    assert_eq!(updated_note.tags.len(), 2);

    // Delete note
    let deleted = delete_note(path.clone(), session_id.clone(), note_id)
        .await
        .unwrap();
    assert!(deleted);

    // Verify note is deleted
    let notes_list = get_notes_list(path.clone(), session_id.clone())
        .await
        .unwrap();
    assert_eq!(notes_list.len(), 0);

    close_vault_session(session_id).await.unwrap();
}

#[tokio::test]
#[serial]
async fn test_note_with_tags() {
    let temp_dir = setup_temp_dir();
    let (path, session_id) = create_and_unlock_test_vault(&temp_dir).await;

    // Create note with multiple tags
    let create_result = create_note(
        path.clone(),
        session_id.clone(),
        Some("Tagged Note".to_string()),
        Some("Content with tags".to_string()),
        Some(vec![
            "tag1".to_string(),
            "tag2".to_string(),
            "tag3".to_string(),
        ]),
        None,
        Some("text".to_string()),
    )
    .await
    .unwrap();

    let note = create_result.note.unwrap();
    assert_eq!(note.tags.len(), 3);
    assert!(note.tags.contains(&"tag1".to_string()));
    assert!(note.tags.contains(&"tag2".to_string()));
    assert!(note.tags.contains(&"tag3".to_string()));

    // Update tags
    let save_result = save_note(
        path.clone(),
        session_id.clone(),
        note.id.clone(),
        None,
        None,
        Some(vec!["new_tag".to_string()]),
        None,
    )
    .await
    .unwrap();

    let updated_note = save_result.note.unwrap();
    assert_eq!(updated_note.tags.len(), 1);
    assert_eq!(updated_note.tags[0], "new_tag");

    close_vault_session(session_id).await.unwrap();
}

#[tokio::test]
#[serial]
async fn test_note_error_handling_invalid_session() {
    let temp_dir = setup_temp_dir();
    let path = temp_dir.path().to_string_lossy().to_string();

    // Try to create note with invalid session
    let result = create_note(
        path,
        "invalid_session_id".to_string(),
        Some("Test".to_string()),
        None,
        None,
        None,
        None,
    )
    .await
    .unwrap();

    assert!(!result.success);
    assert!(result.note.is_none());
    assert!(result.error_message.is_some());
}
