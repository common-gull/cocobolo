use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum VaultError {
    #[error("Vault not found at path: {0}")]
    VaultNotFound(String),
    #[error("Invalid vault format: {0}")]
    InvalidFormat(String),
    #[error("Vault already exists at path: {0}")]
    VaultExists(String),
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
    #[error("Serialization error: {0}")]
    SerializationError(#[from] serde_json::Error),
}

#[derive(Serialize, Deserialize, Debug)]
pub struct VaultInfo {
    pub name: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub version: String,
}

impl VaultInfo {
    pub fn new(name: String) -> Self {
        Self {
            name,
            created_at: chrono::Utc::now(),
            version: "1.0.0".to_string(),
        }
    }
}

pub struct VaultManager {
    vault_path: PathBuf,
}

impl VaultManager {
    /// Create a new vault manager for the given path
    pub fn new<P: AsRef<Path>>(vault_path: P) -> Self {
        Self {
            vault_path: vault_path.as_ref().to_path_buf(),
        }
    }

    /// Check if a vault exists at the current path
    pub fn vault_exists(&self) -> bool {
        let vault_info_file = self.vault_path.join(".cocobolo_vault");
        vault_info_file.exists()
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
} 