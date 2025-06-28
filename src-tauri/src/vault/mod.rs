use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use thiserror::Error;

use crate::crypto::{CryptoError, CryptoManager, SecurePassword, VaultCrypto};

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

    /// Verify password for encrypted vault
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
        let vault_info_content = std::fs::read_to_string(&vault_info_file)?;
        
        let vault_info: VaultInfo = serde_json::from_str(&vault_info_content)
            .map_err(|e| VaultError::InvalidFormat(e.to_string()))?;

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