use super::common::test_data;
use crate::commands::*;

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
