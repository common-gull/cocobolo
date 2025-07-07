use crate::crypto::PasswordStrength;
use crate::errors::AppError;
use crate::types::*;

#[test]
fn test_app_error_serialization() {
    let error = AppError::Application("Test error".to_string());
    let serialized = serde_json::to_string(&error).unwrap();

    // Should serialize as a string
    assert!(serialized.contains("Test error"));
}

#[test]
fn test_app_error_from_conversions() {
    // Test conversion from std::io::Error
    let io_error = std::io::Error::new(std::io::ErrorKind::NotFound, "File not found");
    let app_error = AppError::from(io_error);
    assert!(matches!(app_error, AppError::Io(_)));

    // Test conversion from serde_json::Error
    let json_error = serde_json::from_str::<serde_json::Value>("invalid json").unwrap_err();
    let app_error = AppError::from(json_error);
    assert!(matches!(app_error, AppError::Serialization(_)));
}

#[test]
fn test_app_error_display() {
    let error = AppError::Application("Test error message".to_string());
    let display_string = format!("{}", error);
    assert!(display_string.contains("Test error message"));
}

#[test]
fn test_app_error_debug() {
    let error = AppError::Application("Test error".to_string());
    let debug_string = format!("{:?}", error);
    assert!(debug_string.contains("Application"));
    assert!(debug_string.contains("Test error"));
}

#[test]
fn test_request_response_structures() {
    // Test CreateNoteRequest
    let create_request = CreateNoteRequest {
        title: "Test".to_string(),
        content: Some("Content".to_string()),
        tags: Some(vec!["tag1".to_string()]),
        folder_path: Some("folder".to_string()),
    };

    let serialized = serde_json::to_string(&create_request).unwrap();
    let deserialized: CreateNoteRequest = serde_json::from_str(&serialized).unwrap();
    assert_eq!(create_request.title, deserialized.title);
    assert_eq!(create_request.content, deserialized.content);
    assert_eq!(create_request.tags, deserialized.tags);
    assert_eq!(create_request.folder_path, deserialized.folder_path);

    // Test CreateNoteResult
    let create_result = CreateNoteResult {
        success: true,
        note: None,
        error_message: Some("Test error".to_string()),
    };

    let serialized = serde_json::to_string(&create_result).unwrap();
    let deserialized: CreateNoteResult = serde_json::from_str(&serialized).unwrap();
    assert_eq!(create_result.success, deserialized.success);
    assert_eq!(create_result.error_message, deserialized.error_message);
}

#[test]
fn test_vault_location_info_structure() {
    let info = VaultLocationInfo {
        path: "/test/path".to_string(),
        is_valid: true,
        is_writable: true,
        has_existing_vault: false,
        vault_info: None,
    };

    let serialized = serde_json::to_string(&info).unwrap();
    let deserialized: VaultLocationInfo = serde_json::from_str(&serialized).unwrap();

    assert_eq!(info.path, deserialized.path);
    assert_eq!(info.is_valid, deserialized.is_valid);
    assert_eq!(info.is_writable, deserialized.is_writable);
    assert_eq!(info.has_existing_vault, deserialized.has_existing_vault);
    assert_eq!(info.vault_info, deserialized.vault_info);
}

#[test]
fn test_vault_unlock_result_structure() {
    let result = VaultUnlockResult {
        success: false,
        session_id: None,
        vault_info: None,
        error_message: Some("Invalid password".to_string()),
    };

    let serialized = serde_json::to_string(&result).unwrap();
    let deserialized: VaultUnlockResult = serde_json::from_str(&serialized).unwrap();

    assert_eq!(result.success, deserialized.success);
    assert_eq!(result.session_id, deserialized.session_id);
    assert_eq!(result.error_message, deserialized.error_message);
}

#[test]
fn test_rate_limit_info_structure() {
    let info = RateLimitInfo {
        is_rate_limited: true,
        seconds_remaining: Some(30),
    };

    let serialized = serde_json::to_string(&info).unwrap();
    let deserialized: RateLimitInfo = serde_json::from_str(&serialized).unwrap();

    assert_eq!(info.is_rate_limited, deserialized.is_rate_limited);
    assert_eq!(info.seconds_remaining, deserialized.seconds_remaining);
}

#[test]
fn test_add_vault_request_structure() {
    let request = AddVaultRequest {
        name: "Test Vault".to_string(),
        path: "/test/path".to_string(),
    };

    let serialized = serde_json::to_string(&request).unwrap();
    let deserialized: AddVaultRequest = serde_json::from_str(&serialized).unwrap();

    assert_eq!(request.name, deserialized.name);
    assert_eq!(request.path, deserialized.path);
}

#[test]
fn test_add_vault_result_structure() {
    let result = AddVaultResult {
        success: true,
        vault_id: Some("test-id".to_string()),
        error_message: None,
    };

    let serialized = serde_json::to_string(&result).unwrap();
    let deserialized: AddVaultResult = serde_json::from_str(&serialized).unwrap();

    assert_eq!(result.success, deserialized.success);
    assert_eq!(result.vault_id, deserialized.vault_id);
    assert_eq!(result.error_message, deserialized.error_message);
}

#[test]
fn test_update_vault_metadata_request_structure() {
    let request = UpdateVaultMetadataRequest {
        vault_id: "test-id".to_string(),
        name: Some("New Name".to_string()),
        is_favorite: Some(true),
    };

    let serialized = serde_json::to_string(&request).unwrap();
    let deserialized: UpdateVaultMetadataRequest = serde_json::from_str(&serialized).unwrap();

    assert_eq!(request.vault_id, deserialized.vault_id);
    assert_eq!(request.name, deserialized.name);
    assert_eq!(request.is_favorite, deserialized.is_favorite);
}

#[test]
fn test_password_strength_result_structure() {
    let result = PasswordStrength {
        is_valid: true,
        score: 4,
        issues: vec!["Too short".to_string()],
        suggestions: vec!["Use a longer password".to_string()],
    };

    let serialized = serde_json::to_string(&result).unwrap();
    let deserialized: PasswordStrength = serde_json::from_str(&serialized).unwrap();

    assert_eq!(result.is_valid, deserialized.is_valid);
    assert_eq!(result.score, deserialized.score);
    assert_eq!(result.issues, deserialized.issues);
    assert_eq!(result.suggestions, deserialized.suggestions);
}

#[test]
fn test_app_info_structure() {
    let info = AppInfo {
        name: "Cocobolo".to_string(),
        version: "1.0.0".to_string(),
        description: "A secure note-taking app".to_string(),
    };

    let serialized = serde_json::to_string(&info).unwrap();
    let deserialized: AppInfo = serde_json::from_str(&serialized).unwrap();

    assert_eq!(info.name, deserialized.name);
    assert_eq!(info.version, deserialized.version);
    assert_eq!(info.description, deserialized.description);
}

#[test]
fn test_save_note_result_structure() {
    let result = SaveNoteResult {
        success: true,
        note: None,
        error_message: None,
    };

    let serialized = serde_json::to_string(&result).unwrap();
    let deserialized: SaveNoteResult = serde_json::from_str(&serialized).unwrap();

    assert_eq!(result.success, deserialized.success);
    assert_eq!(result.note, deserialized.note);
    assert_eq!(result.error_message, deserialized.error_message);
}
