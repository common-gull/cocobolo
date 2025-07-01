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