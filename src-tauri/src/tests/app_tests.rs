use super::common::{setup_temp_dir, setup_test_env, test_data};
use crate::commands::*;
use crate::errors::AppError;
use serial_test::serial;

#[test]
fn test_get_app_info() {
    let info = get_app_info().unwrap();

    assert_eq!(info.name, "Cocobolo");
    assert_eq!(info.version, env!("CARGO_PKG_VERSION"));
    assert_eq!(
        info.description,
        "A secure, encrypted note-taking application"
    );
}

#[test]
fn test_greet_valid_name() {
    let result = greet("Alice").unwrap();
    assert_eq!(
        result,
        "Hello, Alice! Welcome to Cocobolo - your secure note-taking companion!"
    );
}

#[test]
fn test_greet_empty_name() {
    let result = greet("");
    assert!(result.is_err());
    assert!(matches!(result.unwrap_err(), AppError::Application(_)));
}

#[test]
fn test_greet_whitespace_only_name() {
    let result = greet("   ");
    assert!(result.is_err());
    assert!(matches!(result.unwrap_err(), AppError::Application(_)));
}

#[tokio::test]
#[serial]
async fn test_get_app_config() {
    let temp_dir = setup_temp_dir();
    setup_test_env(&temp_dir);

    let config = get_app_config().await.unwrap();

    assert_eq!(config.theme, "system");
    assert_eq!(config.auto_save_interval, 300);
    assert!(config.show_markdown_preview);
    assert!(config.known_vaults.is_empty());
}

#[tokio::test]
async fn test_validate_password_strength() {
    let strong_result = validate_password_strength(test_data::STRONG_PASSWORD.to_string())
        .await
        .unwrap();
    assert!(strong_result.is_valid);
    assert!(strong_result.score >= 4);
    assert!(strong_result.issues.is_empty());

    let weak_result = validate_password_strength(test_data::WEAK_PASSWORD.to_string())
        .await
        .unwrap();
    assert!(!weak_result.is_valid);
    assert!(weak_result.score < 4);
    assert!(!weak_result.issues.is_empty());
}

// Performance test for password validation
#[tokio::test]
async fn test_password_validation_performance() {
    use std::time::Instant;

    let password = test_data::TEST_PASSWORD.to_string();
    let start = Instant::now();

    // Reduced iterations for faster tests
    for _ in 0..10 {
        let _ = validate_password_strength(password.clone()).await.unwrap();
    }

    let elapsed = start.elapsed();

    // Should complete 10 validations in reasonable time
    assert!(
        elapsed.as_secs() < 5,
        "Password validation took too long: {:?}",
        elapsed
    );
}
