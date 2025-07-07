use std::env;
use tempfile::TempDir;

/// Helper function to create a temporary directory for tests
pub fn setup_temp_dir() -> TempDir {
    TempDir::new().unwrap()
}

/// Helper function to set up environment for tests that need config isolation
pub fn setup_test_env(temp_dir: &TempDir) {
    env::set_var("HOME", temp_dir.path());
    env::remove_var("USERPROFILE");
}

/// Test constants for consistent testing
pub mod test_data {
    pub const TEST_VAULT_NAME: &str = "Test Vault";
    pub const TEST_PASSWORD: &str = "TestPassword123!@#";
    pub const WEAK_PASSWORD: &str = "weak";
    pub const STRONG_PASSWORD: &str = "StrongPassword123!@#";
    pub const WRONG_PASSWORD: &str = "WrongPassword123!@#";

    pub const TEST_NOTE_TITLE: &str = "Test Note";
    pub const TEST_NOTE_CONTENT: &str = "Test content";
    pub const UPDATED_NOTE_TITLE: &str = "Updated Title";
    pub const UPDATED_NOTE_CONTENT: &str = "Updated content";

    pub const TEST_FOLDER: &str = "test_folder";
    pub const NEW_FOLDER: &str = "new_folder";
    pub const RENAMED_FOLDER: &str = "renamed_folder";
}

/// Helper to create a basic AddVaultRequest for testing
pub fn create_test_vault_request(temp_dir: &TempDir, name: &str) -> crate::types::AddVaultRequest {
    let vault_path = temp_dir.path().join(name);
    std::fs::create_dir_all(&vault_path).unwrap();

    crate::types::AddVaultRequest {
        name: name.to_string(),
        path: vault_path.to_string_lossy().to_string(),
    }
}

/// Helper to create and unlock a test vault, returning the session ID
pub async fn create_and_unlock_test_vault(temp_dir: &TempDir) -> (String, String) {
    let path = temp_dir.path().to_string_lossy().to_string();

    // Create encrypted vault
    crate::commands::create_encrypted_vault(
        path.clone(),
        test_data::TEST_VAULT_NAME.to_string(),
        test_data::TEST_PASSWORD.to_string(),
    )
    .await
    .unwrap();

    // Unlock vault
    let unlock_result =
        crate::commands::unlock_vault(path.clone(), test_data::TEST_PASSWORD.to_string())
            .await
            .unwrap();

    assert!(unlock_result.success);
    let session_id = unlock_result.session_id.unwrap();

    (path, session_id)
}
