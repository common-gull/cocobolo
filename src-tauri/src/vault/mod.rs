use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use thiserror::Error;

use crate::crypto::{CryptoError, CryptoManager, EncryptionKey, SecurePassword, VaultCrypto};

#[derive(Error, Debug)]
pub enum VaultError {
    #[error("Vault not found at path: {0}")]
    VaultNotFound(String),
    #[error("Invalid vault format: {0}")]
    InvalidFormat(String),
    #[error("Vault already exists at path: {0}")]
    VaultExists(String),
    #[error("Vault is not initialized with encryption: {0}")]
    NotEncrypted(String),
    #[error("Invalid password")]
    InvalidPassword,
    #[error("Too many failed attempts. Try again in {0} seconds")]
    RateLimited(u64),
    #[error("Vault is corrupted or invalid")]
    VaultCorrupted,
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
    #[error("Serialization error: {0}")]
    SerializationError(#[from] serde_json::Error),
    #[error("Cryptographic error: {0}")]
    CryptoError(#[from] CryptoError),
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct VaultInfo {
    pub name: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub version: String,
    pub is_encrypted: bool,
    pub crypto: Option<VaultCrypto>,
}

impl VaultInfo {
    pub fn new(name: String) -> Self {
        Self {
            name,
            created_at: chrono::Utc::now(),
            version: "1.0.0".to_string(),
            is_encrypted: false,
            crypto: None,
        }
    }

    pub fn new_encrypted(name: String, crypto: VaultCrypto) -> Self {
        Self {
            name,
            created_at: chrono::Utc::now(),
            version: "1.0.0".to_string(),
            is_encrypted: true,
            crypto: Some(crypto),
        }
    }
}

/// Rate limiting state for vault unlock attempts
#[derive(Debug, Clone)]
struct RateLimitState {
    attempts: u32,
    last_attempt: Instant,
    locked_until: Option<Instant>,
}

impl RateLimitState {
    fn new() -> Self {
        Self {
            attempts: 0,
            last_attempt: Instant::now(),
            locked_until: None,
        }
    }

    fn is_locked(&self) -> bool {
        if let Some(locked_until) = self.locked_until {
            Instant::now() < locked_until
        } else {
            false
        }
    }

    fn time_until_unlock(&self) -> Option<Duration> {
        if let Some(locked_until) = self.locked_until {
            let now = Instant::now();
            if now < locked_until {
                Some(locked_until - now)
            } else {
                None
            }
        } else {
            None
        }
    }

    fn record_failed_attempt(&mut self) {
        self.attempts += 1;
        self.last_attempt = Instant::now();
        
        // Exponential backoff: 2^attempts seconds, capped at 1 hour
        let backoff_seconds = (2_u32.pow(self.attempts.min(12))).min(3600);
        self.locked_until = Some(Instant::now() + Duration::from_secs(backoff_seconds as u64));
    }

    fn reset(&mut self) {
        self.attempts = 0;
        self.locked_until = None;
        self.last_attempt = Instant::now();
    }
}

/// Vault session representing an unlocked vault
#[derive(Debug)]
pub struct VaultSession {
    pub vault_info: VaultInfo,
    pub encryption_key: EncryptionKey,
    pub created_at: Instant,
    pub last_accessed: Instant,
}

impl VaultSession {
    pub fn new(vault_info: VaultInfo, encryption_key: EncryptionKey) -> Self {
        let now = Instant::now();
        Self {
            vault_info,
            encryption_key,
            created_at: now,
            last_accessed: now,
        }
    }

    pub fn update_access(&mut self) {
        self.last_accessed = Instant::now();
    }

    pub fn is_expired(&self, timeout_duration: Duration) -> bool {
        Instant::now() - self.last_accessed > timeout_duration
    }
}

/// Global rate limiting and session management
type RateLimitMap = Arc<Mutex<HashMap<String, RateLimitState>>>;
type SessionMap = Arc<Mutex<HashMap<String, VaultSession>>>;

lazy_static::lazy_static! {
    static ref RATE_LIMITS: RateLimitMap = Arc::new(Mutex::new(HashMap::new()));
    static ref SESSIONS: SessionMap = Arc::new(Mutex::new(HashMap::new()));
}

pub struct VaultManager {
    vault_path: PathBuf,
    crypto_manager: CryptoManager,
}

impl VaultManager {
    /// Create a new vault manager for the given path
    pub fn new<P: AsRef<Path>>(vault_path: P) -> Self {
        Self {
            vault_path: vault_path.as_ref().to_path_buf(),
            crypto_manager: CryptoManager::new(),
        }
    }

    /// Check if a vault exists at the current path
    pub fn vault_exists(&self) -> bool {
        let vault_info_file = self.vault_path.join(".cocobolo_vault");
        vault_info_file.exists()
    }

    /// Check if vault is encrypted
    pub fn is_vault_encrypted(&self) -> Result<bool, VaultError> {
        if !self.vault_exists() {
            return Ok(false);
        }

        let vault_info = self.load_vault_info()?;
        Ok(vault_info.is_encrypted)
    }

    /// Get rate limit status for vault
    pub fn get_rate_limit_status(&self) -> (bool, Option<u64>) {
        let vault_key = self.vault_path.display().to_string();
        let rate_limits = RATE_LIMITS.lock().unwrap();
        
        if let Some(state) = rate_limits.get(&vault_key) {
            if state.is_locked() {
                let seconds_remaining = state.time_until_unlock()
                    .map(|d| d.as_secs())
                    .unwrap_or(0);
                (true, Some(seconds_remaining))
            } else {
                (false, None)
            }
        } else {
            (false, None)
        }
    }

    /// Initialize a new vault at the current path
    #[allow(dead_code)]
    pub fn initialize_vault(&self, vault_name: String) -> Result<VaultInfo, VaultError> {
        if self.vault_exists() {
            return Err(VaultError::VaultExists(
                self.vault_path.display().to_string()
            ));
        }

        // Create vault directory if it doesn't exist
        std::fs::create_dir_all(&self.vault_path)?;

        // Create vault info
        let vault_info = VaultInfo::new(vault_name);
        
        // Save vault info file
        let vault_info_file = self.vault_path.join(".cocobolo_vault");
        let vault_info_content = serde_json::to_string_pretty(&vault_info)?;
        std::fs::write(&vault_info_file, vault_info_content)?;

        // Create notes directory
        let notes_dir = self.vault_path.join("notes");
        std::fs::create_dir_all(&notes_dir)?;

        Ok(vault_info)
    }

    /// Initialize a new encrypted vault with password
    pub fn initialize_encrypted_vault(&self, vault_name: String, password: &SecurePassword) -> Result<VaultInfo, VaultError> {
        if self.vault_exists() {
            return Err(VaultError::VaultExists(
                self.vault_path.display().to_string()
            ));
        }

        // Create vault directory if it doesn't exist
        std::fs::create_dir_all(&self.vault_path)?;

        // Generate encryption metadata
        let vault_crypto = self.crypto_manager.create_vault_crypto(password)?;

        // Create encrypted vault info
        let vault_info = VaultInfo::new_encrypted(vault_name, vault_crypto);
        
        // Save vault info file
        let vault_info_file = self.vault_path.join(".cocobolo_vault");
        let vault_info_content = serde_json::to_string_pretty(&vault_info)?;
        std::fs::write(&vault_info_file, vault_info_content)?;

        // Create notes directory
        let notes_dir = self.vault_path.join("notes");
        std::fs::create_dir_all(&notes_dir)?;

        // Create encrypted settings file
        let settings_file = self.vault_path.join(".cocobolo_settings");
        let default_settings = serde_json::json!({
            "theme": "system",
            "auto_save_interval": 300,
            "show_markdown_preview": true
        });
        
        let settings_content = serde_json::to_string_pretty(&default_settings)?;
        std::fs::write(&settings_file, settings_content)?;

        Ok(vault_info)
    }

    /// Unlock vault with password and create session
    pub fn unlock_vault(&self, password: &SecurePassword) -> Result<String, VaultError> {
        let vault_key = self.vault_path.display().to_string();

        // Check rate limiting
        {
            let mut rate_limits = RATE_LIMITS.lock().unwrap();
            let state = rate_limits.entry(vault_key.clone()).or_insert_with(RateLimitState::new);
            
            if state.is_locked() {
                let seconds_remaining = state.time_until_unlock()
                    .map(|d| d.as_secs())
                    .unwrap_or(0);
                return Err(VaultError::RateLimited(seconds_remaining));
            }
        }

        // Load and verify vault
        let vault_info = self.load_vault_info().map_err(|_| VaultError::VaultCorrupted)?;
        
        if !vault_info.is_encrypted {
            return Err(VaultError::NotEncrypted(
                "Vault is not encrypted".to_string()
            ));
        }

        let vault_crypto = vault_info.crypto.as_ref()
            .ok_or(VaultError::VaultCorrupted)?;

        // Verify password and derive key
        let verification_result = self.crypto_manager.verify_password(password, vault_crypto);
        
        match verification_result {
            Ok(true) => {
                // Password is correct - reset rate limiting and create session
                {
                    let mut rate_limits = RATE_LIMITS.lock().unwrap();
                    if let Some(state) = rate_limits.get_mut(&vault_key) {
                        state.reset();
                    }
                }

                // Derive encryption key for session
                let salt = argon2::password_hash::SaltString::from_b64(&vault_crypto.salt)
                    .map_err(|_| VaultError::VaultCorrupted)?;
                let encryption_key = self.crypto_manager.derive_key(password, &salt)?;

                // Create session
                let session_id = uuid::Uuid::new_v4().to_string();
                let session = VaultSession::new(vault_info, encryption_key);
                
                {
                    let mut sessions = SESSIONS.lock().unwrap();
                    sessions.insert(session_id.clone(), session);
                }

                Ok(session_id)
            }
            Ok(false) | Err(_) => {
                // Password is incorrect or verification failed - record failed attempt
                {
                    let mut rate_limits = RATE_LIMITS.lock().unwrap();
                    let state = rate_limits.entry(vault_key).or_insert_with(RateLimitState::new);
                    state.record_failed_attempt();
                }
                
                Err(VaultError::InvalidPassword)
            }
        }
    }

    /// Get session by ID
    pub fn get_session(session_id: &str) -> Option<VaultSession> {
        let mut sessions = SESSIONS.lock().unwrap();
        if let Some(session) = sessions.get_mut(session_id) {
            // Check if session is expired (30 minutes timeout)
            if session.is_expired(Duration::from_secs(1800)) {
                sessions.remove(session_id);
                None
            } else {
                session.update_access();
                // Return a clone since we can't return a reference to the locked data
                Some(VaultSession {
                    vault_info: session.vault_info.clone(),
                    encryption_key: session.encryption_key.clone(),
                    created_at: session.created_at,
                    last_accessed: session.last_accessed,
                })
            }
        } else {
            None
        }
    }

    /// Close session
    pub fn close_session(session_id: &str) -> bool {
        let mut sessions = SESSIONS.lock().unwrap();
        sessions.remove(session_id).is_some()
    }

    /// Verify password for encrypted vault (legacy method)
    pub fn verify_vault_password(&self, password: &SecurePassword) -> Result<bool, VaultError> {
        let vault_info = self.load_vault_info()?;
        
        if !vault_info.is_encrypted {
            return Err(VaultError::NotEncrypted(
                "Vault is not encrypted".to_string()
            ));
        }

        let vault_crypto = vault_info.crypto.as_ref()
            .ok_or_else(|| VaultError::InvalidFormat("Missing crypto metadata".to_string()))?;

        Ok(self.crypto_manager.verify_password(password, vault_crypto)?)
    }

    /// Load vault info from the current path
    pub fn load_vault_info(&self) -> Result<VaultInfo, VaultError> {
        if !self.vault_exists() {
            return Err(VaultError::VaultNotFound(
                self.vault_path.display().to_string()
            ));
        }

        let vault_info_file = self.vault_path.join(".cocobolo_vault");
        let vault_info_content = std::fs::read_to_string(&vault_info_file)
            .map_err(|_| VaultError::VaultCorrupted)?;
        
        let vault_info: VaultInfo = serde_json::from_str(&vault_info_content)
            .map_err(|_| VaultError::VaultCorrupted)?;

        Ok(vault_info)
    }

    /// Get the vault path
    #[allow(dead_code)]
    pub fn vault_path(&self) -> &Path {
        &self.vault_path
    }

    /// Get the crypto manager for password validation
    pub fn crypto_manager(&self) -> &CryptoManager {
        &self.crypto_manager
    }
} 