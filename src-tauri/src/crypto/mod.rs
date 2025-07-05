use anyhow::Result;
use argon2::{
    password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2, Params, Version,
};
use chacha20poly1305::{
    aead::{Aead, AeadCore, KeyInit, OsRng},
    ChaCha20Poly1305, Nonce,
};
use serde::{Deserialize, Serialize};
use std::fmt;
use thiserror::Error;
use zeroize::ZeroizeOnDrop;

#[derive(Error, Debug)]
pub enum CryptoError {
    #[error("Password hash error: {0}")]
    PasswordHash(String),
    #[error("Argon2 error: {0}")]
    Argon2(String),
    #[error("Encryption error: {0}")]
    Encryption(String),
    #[error("Decryption error: {0}")]
    Decryption(String),
    #[error("Invalid key length")]
    InvalidKeyLength,
    #[error("Invalid nonce length")]
    InvalidNonceLength,
}

impl From<argon2::password_hash::Error> for CryptoError {
    fn from(err: argon2::password_hash::Error) -> Self {
        CryptoError::PasswordHash(err.to_string())
    }
}

impl From<argon2::Error> for CryptoError {
    fn from(err: argon2::Error) -> Self {
        CryptoError::Argon2(err.to_string())
    }
}

/// Secure password wrapper that automatically zeros memory on drop
#[derive(Clone, ZeroizeOnDrop)]
pub struct SecurePassword {
    password: String,
}

impl SecurePassword {
    pub fn new(password: String) -> Self {
        Self { password }
    }

    pub fn as_bytes(&self) -> &[u8] {
        self.password.as_bytes()
    }

    pub fn len(&self) -> usize {
        self.password.len()
    }
}

impl fmt::Debug for SecurePassword {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("SecurePassword")
            .field("password", &"[REDACTED]")
            .finish()
    }
}

/// Encryption key derived from password
#[derive(Clone, ZeroizeOnDrop)]
pub struct EncryptionKey {
    key: [u8; 32], // 256-bit key for ChaCha20Poly1305
}

impl EncryptionKey {
    pub fn from_bytes(bytes: [u8; 32]) -> Self {
        Self { key: bytes }
    }

    pub fn as_bytes(&self) -> &[u8; 32] {
        &self.key
    }
}

impl fmt::Debug for EncryptionKey {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("EncryptionKey")
            .field("key", &"[REDACTED]")
            .finish()
    }
}

/// Vault encryption metadata stored in the vault header
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct VaultCrypto {
    /// Argon2 password hash for verification
    pub password_hash: String,
    /// Salt used for key derivation (base64 encoded)
    pub salt: String,
    /// Argon2 parameters used
    pub argon2_params: Argon2Params,
    /// Test vector for key verification (encrypted known plaintext)
    pub key_test_vector: String,
    /// Nonce used for key test vector
    pub key_test_nonce: String,
}

/// Argon2 parameters for consistent key derivation
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Argon2Params {
    pub memory: u32,
    pub iterations: u32,
    pub parallelism: u32,
    pub version: u32,
}

impl Default for Argon2Params {
    fn default() -> Self {
        Self {
            memory: 65536,     // 64 MB
            iterations: 3,     // 3 iterations
            parallelism: 4,    // 4 parallel threads
            version: 0x13,     // Version 1.3
        }
    }
}

/// Password strength requirements
#[derive(Debug, Clone)]
pub struct PasswordRequirements {
    pub min_length: usize,
    pub require_uppercase: bool,
    pub require_lowercase: bool,
    pub require_numbers: bool,
    pub require_symbols: bool,
}

impl Default for PasswordRequirements {
    fn default() -> Self {
        Self {
            min_length: 12,
            require_uppercase: true,
            require_lowercase: true,
            require_numbers: true,
            require_symbols: true,
        }
    }
}

/// Password strength validation result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PasswordStrength {
    pub is_valid: bool,
    pub score: u8, // 0-4 strength score
    pub issues: Vec<String>,
    pub suggestions: Vec<String>,
}

/// Main cryptographic operations manager
pub struct CryptoManager {
    argon2: Argon2<'static>,
    requirements: PasswordRequirements,
}

impl CryptoManager {
    pub fn new() -> Self {
        let params = Params::new(65536, 3, 4, None).unwrap();
        let argon2 = Argon2::new(argon2::Algorithm::Argon2id, Version::V0x13, params);
        
        Self {
            argon2,
            requirements: PasswordRequirements::default(),
        }
    }

    /// Validate password strength according to requirements
    pub fn validate_password_strength(&self, password: &SecurePassword) -> PasswordStrength {
        let mut issues = Vec::new();
        let mut suggestions = Vec::new();
        let mut score = 0u8;

        // Check length
        if password.len() < self.requirements.min_length {
            issues.push(format!("Password must be at least {} characters long", self.requirements.min_length));
            suggestions.push("Use a longer password for better security".to_string());
        } else {
            score += 1;
        }

        let password_str = std::str::from_utf8(password.as_bytes()).unwrap_or("");

        // Check character requirements
        if self.requirements.require_uppercase && !password_str.chars().any(|c| c.is_uppercase()) {
            issues.push("Password must contain at least one uppercase letter".to_string());
            suggestions.push("Add uppercase letters (A-Z)".to_string());
        } else if self.requirements.require_uppercase {
            score += 1;
        }

        if self.requirements.require_lowercase && !password_str.chars().any(|c| c.is_lowercase()) {
            issues.push("Password must contain at least one lowercase letter".to_string());
            suggestions.push("Add lowercase letters (a-z)".to_string());
        } else if self.requirements.require_lowercase {
            score += 1;
        }

        if self.requirements.require_numbers && !password_str.chars().any(|c| c.is_numeric()) {
            issues.push("Password must contain at least one number".to_string());
            suggestions.push("Add numbers (0-9)".to_string());
        } else if self.requirements.require_numbers {
            score += 1;
        }

        if self.requirements.require_symbols && !password_str.chars().any(|c| !c.is_alphanumeric()) {
            issues.push("Password must contain at least one symbol".to_string());
            suggestions.push("Add symbols (!@#$%^&*)".to_string());
        } else if self.requirements.require_symbols {
            score += 1;
        }

        // Additional strength checks
        if password.len() >= 16 {
            score = score.saturating_add(1);
        }

        let is_valid = issues.is_empty();
        
        if is_valid && suggestions.is_empty() {
            match score {
                0..=2 => suggestions.push("Consider using a longer password with more variety".to_string()),
                3 => suggestions.push("Good password! Consider making it even longer".to_string()),
                4 => suggestions.push("Strong password!".to_string()),
                _ => suggestions.push("Excellent password!".to_string()),
            }
        }

        PasswordStrength {
            is_valid,
            score: score.min(4),
            issues,
            suggestions,
        }
    }

    /// Create vault encryption metadata from password
    pub fn create_vault_crypto(&self, password: &SecurePassword) -> Result<VaultCrypto, CryptoError> {
        // Generate random salt
        let salt = SaltString::generate(&mut OsRng);
        
        // Hash password for verification
        let password_hash = self.argon2
            .hash_password(password.as_bytes(), &salt)?
            .to_string();

        // Derive encryption key
        let encryption_key = self.derive_key(password, &salt)?;

        // Create test vector to verify key derivation
        let test_plaintext = b"cocobolo_key_test_vector_2024";
        let cipher = ChaCha20Poly1305::new_from_slice(encryption_key.as_bytes())
            .map_err(|e| CryptoError::Encryption(e.to_string()))?;
        
        let nonce = ChaCha20Poly1305::generate_nonce(&mut OsRng);
        let ciphertext = cipher
            .encrypt(&nonce, test_plaintext.as_ref())
            .map_err(|e| CryptoError::Encryption(e.to_string()))?;

        Ok(VaultCrypto {
            password_hash,
            salt: salt.to_string(),
            argon2_params: Argon2Params::default(),
            key_test_vector: base64::encode(&ciphertext),
            key_test_nonce: base64::encode(&nonce),
        })
    }

    /// Verify password against vault crypto metadata
    pub fn verify_password(&self, password: &SecurePassword, vault_crypto: &VaultCrypto) -> Result<bool, CryptoError> {
        // Parse stored password hash
        let parsed_hash = PasswordHash::new(&vault_crypto.password_hash)?;
        
        // Verify password
        match self.argon2.verify_password(password.as_bytes(), &parsed_hash) {
            Ok(()) => {
                // Additional verification: try to decrypt test vector
                self.verify_key_test_vector(password, vault_crypto)
            }
            Err(_) => Ok(false),
        }
    }

    /// Derive encryption key from password and salt
    pub fn derive_key(&self, password: &SecurePassword, salt: &SaltString) -> Result<EncryptionKey, CryptoError> {
        let mut key = [0u8; 32];
        self.argon2
            .hash_password_into(password.as_bytes(), salt.as_str().as_bytes(), &mut key)?;
        Ok(EncryptionKey::from_bytes(key))
    }

    /// Verify that derived key can decrypt test vector
    fn verify_key_test_vector(&self, password: &SecurePassword, vault_crypto: &VaultCrypto) -> Result<bool, CryptoError> {
        // Parse salt
        let salt = SaltString::from_b64(&vault_crypto.salt)
            .map_err(|e| CryptoError::PasswordHash(e.to_string()))?;

        // Derive key
        let encryption_key = self.derive_key(password, &salt)?;

        // Decode test vector and nonce
        let ciphertext = base64::decode(&vault_crypto.key_test_vector)
            .map_err(|e| CryptoError::Decryption(e.to_string()))?;
        let nonce_bytes = base64::decode(&vault_crypto.key_test_nonce)
            .map_err(|e| CryptoError::Decryption(e.to_string()))?;

        if nonce_bytes.len() != 12 {
            return Err(CryptoError::InvalidNonceLength);
        }

        let nonce = Nonce::from_slice(&nonce_bytes);

        // Try to decrypt
        let cipher = ChaCha20Poly1305::new_from_slice(encryption_key.as_bytes())
            .map_err(|e| CryptoError::Decryption(e.to_string()))?;

        match cipher.decrypt(nonce, ciphertext.as_ref()) {
            Ok(plaintext) => {
                let expected = b"cocobolo_key_test_vector_2024";
                Ok(plaintext == expected)
            }
            Err(_) => Ok(false),
        }
    }

    /// Encrypt data with derived key
    pub fn encrypt_data(&self, data: &[u8], key: &EncryptionKey) -> Result<(Vec<u8>, Vec<u8>), CryptoError> {
        let cipher = ChaCha20Poly1305::new_from_slice(key.as_bytes())
            .map_err(|e| CryptoError::Encryption(e.to_string()))?;
        
        let nonce = ChaCha20Poly1305::generate_nonce(&mut OsRng);
        let ciphertext = cipher
            .encrypt(&nonce, data)
            .map_err(|e| CryptoError::Encryption(e.to_string()))?;

        Ok((ciphertext, nonce.to_vec()))
    }

    /// Decrypt data with derived key
    pub fn decrypt_data(&self, ciphertext: &[u8], nonce: &[u8], key: &EncryptionKey) -> Result<Vec<u8>, CryptoError> {
        if nonce.len() != 12 {
            return Err(CryptoError::InvalidNonceLength);
        }

        let cipher = ChaCha20Poly1305::new_from_slice(key.as_bytes())
            .map_err(|e| CryptoError::Decryption(e.to_string()))?;
        
        let nonce = Nonce::from_slice(nonce);
        let plaintext = cipher
            .decrypt(nonce, ciphertext)
            .map_err(|e| CryptoError::Decryption(e.to_string()))?;

        Ok(plaintext)
    }
}

impl Default for CryptoManager {
    fn default() -> Self {
        Self::new()
    }
}

// Add base64 encoding/decoding module
mod base64 {
    use base64::{engine::general_purpose, Engine as _};

    pub fn encode<T: AsRef<[u8]>>(input: T) -> String {
        general_purpose::STANDARD.encode(input)
    }

    pub fn decode<T: AsRef<[u8]>>(input: T) -> Result<Vec<u8>, base64::DecodeError> {
        general_purpose::STANDARD.decode(input)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use proptest::prelude::*;
    use proptest::test_runner::Config as ProptestConfig;
    use std::collections::HashSet;

    #[test]
    fn test_secure_password_creation() {
        let password = "test_password_123";
        let secure_password = SecurePassword::new(password.to_string());
        
        assert_eq!(secure_password.as_bytes(), password.as_bytes());
        assert_eq!(secure_password.len(), password.len());
    }

    #[test]
    fn test_secure_password_debug_redaction() {
        let secure_password = SecurePassword::new("secret123".to_string());
        let debug_output = format!("{:?}", secure_password);
        
        assert!(debug_output.contains("[REDACTED]"));
        assert!(!debug_output.contains("secret123"));
    }

    #[test]
    fn test_encryption_key_creation() {
        let key_bytes = [42u8; 32];
        let encryption_key = EncryptionKey::from_bytes(key_bytes);
        
        assert_eq!(encryption_key.as_bytes(), &key_bytes);
    }

    #[test]
    fn test_encryption_key_debug_redaction() {
        let key_bytes = [42u8; 32];
        let encryption_key = EncryptionKey::from_bytes(key_bytes);
        let debug_output = format!("{:?}", encryption_key);
        
        assert!(debug_output.contains("[REDACTED]"));
        assert!(!debug_output.contains("42"));
    }

    #[test]
    fn test_password_strength_validation_strong() {
        let crypto_manager = CryptoManager::new();
        let strong_password = SecurePassword::new("StrongPassword123!@#".to_string());
        
        let strength = crypto_manager.validate_password_strength(&strong_password);
        
        assert!(strength.is_valid);
        assert!(strength.score >= 4);
        assert!(strength.issues.is_empty());
    }

    #[test]
    fn test_password_strength_validation_weak() {
        let crypto_manager = CryptoManager::new();
        let weak_password = SecurePassword::new("weak".to_string());
        
        let strength = crypto_manager.validate_password_strength(&weak_password);
        
        assert!(!strength.is_valid);
        assert!(strength.score < 4);
        assert!(!strength.issues.is_empty());
        assert!(!strength.suggestions.is_empty());
    }

    #[test]
    fn test_password_strength_validation_missing_requirements() {
        let crypto_manager = CryptoManager::new();
        
        // Test missing uppercase
        let no_uppercase = SecurePassword::new("lowercase123!@#".to_string());
        let strength = crypto_manager.validate_password_strength(&no_uppercase);
        assert!(!strength.is_valid);
        assert!(strength.issues.iter().any(|issue| issue.contains("uppercase")));
        
        // Test missing lowercase
        let no_lowercase = SecurePassword::new("UPPERCASE123!@#".to_string());
        let strength = crypto_manager.validate_password_strength(&no_lowercase);
        assert!(!strength.is_valid);
        assert!(strength.issues.iter().any(|issue| issue.contains("lowercase")));
        
        // Test missing numbers
        let no_numbers = SecurePassword::new("Password!@#".to_string());
        let strength = crypto_manager.validate_password_strength(&no_numbers);
        assert!(!strength.is_valid);
        assert!(strength.issues.iter().any(|issue| issue.contains("number")));
        
        // Test missing symbols
        let no_symbols = SecurePassword::new("Password123".to_string());
        let strength = crypto_manager.validate_password_strength(&no_symbols);
        assert!(!strength.is_valid);
        assert!(strength.issues.iter().any(|issue| issue.contains("symbol")));
    }

    #[test]
    fn test_vault_crypto_creation() {
        let crypto_manager = CryptoManager::new();
        let password = SecurePassword::new("TestPassword123!@#".to_string());
        
        let vault_crypto = crypto_manager.create_vault_crypto(&password).unwrap();
        
        assert!(!vault_crypto.password_hash.is_empty());
        assert!(!vault_crypto.salt.is_empty());
        assert!(!vault_crypto.key_test_vector.is_empty());
        assert!(!vault_crypto.key_test_nonce.is_empty());
        assert_eq!(vault_crypto.argon2_params.memory, 65536);
        assert_eq!(vault_crypto.argon2_params.iterations, 3);
        assert_eq!(vault_crypto.argon2_params.parallelism, 4);
    }

    #[test]
    fn test_password_verification_correct() {
        let crypto_manager = CryptoManager::new();
        let password = SecurePassword::new("TestPassword123!@#".to_string());
        
        let vault_crypto = crypto_manager.create_vault_crypto(&password).unwrap();
        let is_valid = crypto_manager.verify_password(&password, &vault_crypto).unwrap();
        
        assert!(is_valid);
    }

    #[test]
    fn test_password_verification_incorrect() {
        let crypto_manager = CryptoManager::new();
        let correct_password = SecurePassword::new("TestPassword123!@#".to_string());
        let wrong_password = SecurePassword::new("WrongPassword123!@#".to_string());
        
        let vault_crypto = crypto_manager.create_vault_crypto(&correct_password).unwrap();
        let is_valid = crypto_manager.verify_password(&wrong_password, &vault_crypto).unwrap();
        
        assert!(!is_valid);
    }

    #[test]
    fn test_key_derivation_consistency() {
        let crypto_manager = CryptoManager::new();
        let password = SecurePassword::new("TestPassword123!@#".to_string());
        let salt = argon2::password_hash::SaltString::generate(&mut rand::rngs::OsRng);
        
        let key1 = crypto_manager.derive_key(&password, &salt).unwrap();
        let key2 = crypto_manager.derive_key(&password, &salt).unwrap();
        
        assert_eq!(key1.as_bytes(), key2.as_bytes());
    }

    #[test]
    fn test_key_derivation_different_salts() {
        let crypto_manager = CryptoManager::new();
        let password = SecurePassword::new("TestPassword123!@#".to_string());
        let salt1 = argon2::password_hash::SaltString::generate(&mut rand::rngs::OsRng);
        let salt2 = argon2::password_hash::SaltString::generate(&mut rand::rngs::OsRng);
        
        let key1 = crypto_manager.derive_key(&password, &salt1).unwrap();
        let key2 = crypto_manager.derive_key(&password, &salt2).unwrap();
        
        assert_ne!(key1.as_bytes(), key2.as_bytes());
    }

    #[test]
    fn test_encryption_decryption_roundtrip() {
        let crypto_manager = CryptoManager::new();
        let password = SecurePassword::new("TestPassword123!@#".to_string());
        let salt = argon2::password_hash::SaltString::generate(&mut rand::rngs::OsRng);
        let key = crypto_manager.derive_key(&password, &salt).unwrap();
        
        let plaintext = b"Hello, World! This is a test message.";
        let (ciphertext, nonce) = crypto_manager.encrypt_data(plaintext, &key).unwrap();
        let decrypted = crypto_manager.decrypt_data(&ciphertext, &nonce, &key).unwrap();
        
        assert_eq!(plaintext, decrypted.as_slice());
    }

    #[test]
    fn test_encryption_produces_different_ciphertexts() {
        let crypto_manager = CryptoManager::new();
        let password = SecurePassword::new("TestPassword123!@#".to_string());
        let salt = argon2::password_hash::SaltString::generate(&mut rand::rngs::OsRng);
        let key = crypto_manager.derive_key(&password, &salt).unwrap();
        
        let plaintext = b"Hello, World!";
        let (ciphertext1, nonce1) = crypto_manager.encrypt_data(plaintext, &key).unwrap();
        let (ciphertext2, nonce2) = crypto_manager.encrypt_data(plaintext, &key).unwrap();
        
        // Different nonces should produce different ciphertexts
        assert_ne!(ciphertext1, ciphertext2);
        assert_ne!(nonce1, nonce2);
    }

    #[test]
    fn test_decryption_with_wrong_key() {
        let crypto_manager = CryptoManager::new();
        let password1 = SecurePassword::new("TestPassword123!@#".to_string());
        let password2 = SecurePassword::new("DifferentPassword123!@#".to_string());
        let salt = argon2::password_hash::SaltString::generate(&mut rand::rngs::OsRng);
        let key1 = crypto_manager.derive_key(&password1, &salt).unwrap();
        let key2 = crypto_manager.derive_key(&password2, &salt).unwrap();
        
        let plaintext = b"Hello, World!";
        let (ciphertext, nonce) = crypto_manager.encrypt_data(plaintext, &key1).unwrap();
        
        // Should fail with wrong key
        let result = crypto_manager.decrypt_data(&ciphertext, &nonce, &key2);
        assert!(result.is_err());
    }

    #[test]
    fn test_decryption_with_wrong_nonce() {
        let crypto_manager = CryptoManager::new();
        let password = SecurePassword::new("TestPassword123!@#".to_string());
        let salt = argon2::password_hash::SaltString::generate(&mut rand::rngs::OsRng);
        let key = crypto_manager.derive_key(&password, &salt).unwrap();
        
        let plaintext = b"Hello, World!";
        let (ciphertext, _) = crypto_manager.encrypt_data(plaintext, &key).unwrap();
        let wrong_nonce = vec![0u8; 12]; // Wrong nonce
        
        // Should fail with wrong nonce
        let result = crypto_manager.decrypt_data(&ciphertext, &wrong_nonce, &key);
        assert!(result.is_err());
    }

    #[test]
    fn test_invalid_nonce_length() {
        let crypto_manager = CryptoManager::new();
        let password = SecurePassword::new("TestPassword123!@#".to_string());
        let salt = argon2::password_hash::SaltString::generate(&mut rand::rngs::OsRng);
        let key = crypto_manager.derive_key(&password, &salt).unwrap();
        
        let plaintext = b"Hello, World!";
        let (ciphertext, _) = crypto_manager.encrypt_data(plaintext, &key).unwrap();
        let invalid_nonce = vec![0u8; 10]; // Invalid nonce length
        
        let result = crypto_manager.decrypt_data(&ciphertext, &invalid_nonce, &key);
        assert!(matches!(result, Err(CryptoError::InvalidNonceLength)));
    }

    #[test]
    fn test_empty_data_encryption() {
        let crypto_manager = CryptoManager::new();
        let password = SecurePassword::new("TestPassword123!@#".to_string());
        let salt = argon2::password_hash::SaltString::generate(&mut rand::rngs::OsRng);
        let key = crypto_manager.derive_key(&password, &salt).unwrap();
        
        let empty_data = b"";
        let (ciphertext, nonce) = crypto_manager.encrypt_data(empty_data, &key).unwrap();
        let decrypted = crypto_manager.decrypt_data(&ciphertext, &nonce, &key).unwrap();
        
        assert_eq!(empty_data, decrypted.as_slice());
    }

    #[test]
    fn test_large_data_encryption() {
        let crypto_manager = CryptoManager::new();
        let password = SecurePassword::new("TestPassword123!@#".to_string());
        let salt = argon2::password_hash::SaltString::generate(&mut rand::rngs::OsRng);
        let key = crypto_manager.derive_key(&password, &salt).unwrap();
        
        // Reduced size for faster tests
        let large_data = vec![42u8; 64 * 1024]; // 64KB of data
        let (ciphertext, nonce) = crypto_manager.encrypt_data(&large_data, &key).unwrap();
        let decrypted = crypto_manager.decrypt_data(&ciphertext, &nonce, &key).unwrap();
        
        assert_eq!(large_data, decrypted);
    }

    #[test]
    fn test_base64_encoding_decoding() {
        let test_data = b"Hello, World! This is test data for base64 encoding.";
        let encoded = base64::encode(test_data);
        let decoded = base64::decode(&encoded).unwrap();
        
        assert_eq!(test_data, decoded.as_slice());
    }

    #[test]
    fn test_argon2_params_default() {
        let params = Argon2Params::default();
        
        assert_eq!(params.memory, 65536);
        assert_eq!(params.iterations, 3);
        assert_eq!(params.parallelism, 4);
        assert_eq!(params.version, 0x13);
    }

    // Property-based tests using proptest
    proptest! {
        #![proptest_config(ProptestConfig::with_cases(10))]
        #[test]
        fn test_encryption_roundtrip_property(
            data in prop::collection::vec(prop::num::u8::ANY, 0..1000)
        ) {
            let crypto_manager = CryptoManager::new();
            let password = SecurePassword::new("TestPassword123!@#".to_string());
            let salt = argon2::password_hash::SaltString::generate(&mut rand::rngs::OsRng);
            let key = crypto_manager.derive_key(&password, &salt).unwrap();
            
            let (ciphertext, nonce) = crypto_manager.encrypt_data(&data, &key).unwrap();
            let decrypted = crypto_manager.decrypt_data(&ciphertext, &nonce, &key).unwrap();
            
            prop_assert_eq!(data, decrypted);
        }

        #[test]
        fn test_password_strength_consistency(
            password in "[a-zA-Z0-9!@#$%^&*()_+-=]{8,50}"
        ) {
            let crypto_manager = CryptoManager::new();
            let secure_password = SecurePassword::new(password);
            
            let strength1 = crypto_manager.validate_password_strength(&secure_password);
            let strength2 = crypto_manager.validate_password_strength(&secure_password);
            
            prop_assert_eq!(strength1.is_valid, strength2.is_valid);
            prop_assert_eq!(strength1.score, strength2.score);
        }

        #[test]
        fn test_key_derivation_deterministic(
            password in "[a-zA-Z0-9!@#$%^&*()_+-=]{12,50}"
        ) {
            let crypto_manager = CryptoManager::new();
            let secure_password = SecurePassword::new(password);
            let salt = argon2::password_hash::SaltString::generate(&mut rand::rngs::OsRng);
            
            let key1 = crypto_manager.derive_key(&secure_password, &salt).unwrap();
            let key2 = crypto_manager.derive_key(&secure_password, &salt).unwrap();
            
            prop_assert_eq!(key1.as_bytes(), key2.as_bytes());
        }
    }

    // Security-focused tests
    #[test]
    fn test_timing_attack_resistance() {
        let crypto_manager = CryptoManager::new();
        let correct_password = SecurePassword::new("TestPassword123!@#".to_string());
        let vault_crypto = crypto_manager.create_vault_crypto(&correct_password).unwrap();
        
        // Test multiple wrong passwords to ensure consistent timing
        let wrong_passwords = vec![
            "WrongPassword123!@#",
            "x",
            "AnotherWrongPassword123!@#",
            "CompletelyDifferentPassword456$%^",
        ];
        
        let mut times = Vec::new();
        for wrong_password in wrong_passwords {
            let wrong_pass = SecurePassword::new(wrong_password.to_string());
            let start = std::time::Instant::now();
            let _ = crypto_manager.verify_password(&wrong_pass, &vault_crypto);
            times.push(start.elapsed());
        }
        
        // All verification attempts should take roughly the same time
        // (within reasonable bounds for timing attack resistance)
        let avg_time = times.iter().sum::<std::time::Duration>() / times.len() as u32;
        for time in times {
            let diff = if time > avg_time { time - avg_time } else { avg_time - time };
            assert!(diff < std::time::Duration::from_millis(100), 
                   "Timing difference too large: {:?}", diff);
        }
    }

    #[test]
    fn test_salt_uniqueness() {
        let crypto_manager = CryptoManager::new();
        let password = SecurePassword::new("TestPassword123!@#".to_string());
        
        let mut salts = HashSet::new();
        // Reduced iterations for faster tests
        for _ in 0..10 {
            let vault_crypto = crypto_manager.create_vault_crypto(&password).unwrap();
            let salt = vault_crypto.salt.clone();
            assert!(salts.insert(salt), "Duplicate salt generated");
        }
    }

    #[test]
    fn test_nonce_uniqueness() {
        let crypto_manager = CryptoManager::new();
        let password = SecurePassword::new("TestPassword123!@#".to_string());
        let salt = argon2::password_hash::SaltString::generate(&mut rand::rngs::OsRng);
        let key = crypto_manager.derive_key(&password, &salt).unwrap();
        
        let mut nonces = HashSet::new();
        let plaintext = b"Hello, World!";
        
        // Reduced iterations for faster tests
        for _ in 0..50 {
            let (_, nonce) = crypto_manager.encrypt_data(plaintext, &key).unwrap();
            let nonce_hex = hex::encode(&nonce);
            assert!(nonces.insert(nonce_hex), "Duplicate nonce generated");
        }
    }

    #[test]
    fn test_memory_clearing() {
        // This test verifies that SecurePassword and EncryptionKey implement zeroize
        let password_data = "TestPassword123!@#".to_string();
        let key_data = [42u8; 32];
        
        {
            let _secure_password = SecurePassword::new(password_data.clone());
            let _encryption_key = EncryptionKey::from_bytes(key_data);
            // Memory should be cleared when these go out of scope
        }
        
        // We can't directly test memory clearing, but we can verify the types implement the trait
        // This is done at compile time by the zeroize derive macro
    }

    #[test]
    fn test_crypto_manager_default() {
        let crypto_manager1 = CryptoManager::new();
        let crypto_manager2 = CryptoManager::default();
        
        // Both should work the same way
        let password = SecurePassword::new("TestPassword123!@#".to_string());
        let strength1 = crypto_manager1.validate_password_strength(&password);
        let strength2 = crypto_manager2.validate_password_strength(&password);
        
        assert_eq!(strength1.is_valid, strength2.is_valid);
        assert_eq!(strength1.score, strength2.score);
    }
} 