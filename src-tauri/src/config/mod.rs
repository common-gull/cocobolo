use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

use thiserror::Error;

#[derive(Error, Debug)]
pub enum ConfigError {
    #[error("Failed to access config directory: {0}")]
    ConfigDirAccess(String),
    #[error("Failed to read config file: {0}")]
    ReadError(#[from] std::io::Error),
    #[error("Failed to parse config: {0}")]
    ParseError(#[from] serde_json::Error),
    #[error("Invalid vault path: {0}")]
    InvalidVaultPath(String),
    #[error("Vault not found: {0}")]
    VaultNotFound(String),
}

/// Metadata for a known vault
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct KnownVault {
    pub id: String,
    pub name: String,
    pub path: PathBuf,
    pub is_encrypted: bool,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub last_accessed: Option<chrono::DateTime<chrono::Utc>>,
    pub is_favorite: bool,
}

impl KnownVault {
    pub fn new(name: String, path: PathBuf, is_encrypted: bool) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            name,
            path,
            is_encrypted,
            created_at: chrono::Utc::now(),
            last_accessed: None,
            is_favorite: false,
        }
    }

    /// Check if the vault path still exists and is valid
    pub fn is_valid(&self) -> bool {
        self.path.exists() && self.path.is_dir()
    }

    /// Update the last accessed timestamp
    pub fn update_last_accessed(&mut self) {
        self.last_accessed = Some(chrono::Utc::now());
    }

    /// Check if the directory is writable
    pub fn is_writable(&self) -> bool {
        let test_file = self.path.join(".cocobolo_write_test");
        match std::fs::write(&test_file, "test") {
            Ok(_) => {
                let _ = std::fs::remove_file(&test_file);
                true
            }
            Err(_) => false,
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AppConfig {
    /// Currently active vault ID (if any)
    #[serde(default)]
    pub current_vault_id: Option<String>,
    /// List of known vaults
    #[serde(default)]
    pub known_vaults: Vec<KnownVault>,
    /// UI theme setting
    pub theme: String,
    /// Auto-save interval in seconds
    pub auto_save_interval: u64,
    /// Whether to show markdown preview by default
    pub show_markdown_preview: bool,
    /// Window settings
    #[serde(default)]
    pub window_maximized: bool,
    #[serde(default)]
    pub window_width: Option<u32>,
    #[serde(default)]
    pub window_height: Option<u32>,
    /// Recent vault IDs (for quick access)
    #[serde(default)]
    pub recent_vault_ids: Vec<String>,
    /// Maximum number of recent vaults to track
    #[serde(default = "default_max_recent_vaults")]
    pub max_recent_vaults: usize,
}

fn default_max_recent_vaults() -> usize {
    5
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            current_vault_id: None,
            known_vaults: Vec::new(),
            theme: "system".to_string(),
            auto_save_interval: 300, // 5 minutes in seconds
            show_markdown_preview: true,
            window_maximized: false,
            window_width: None,
            window_height: None,
            recent_vault_ids: Vec::new(),
            max_recent_vaults: 5,
        }
    }
}

impl AppConfig {
    /// Get the config file path
    fn config_file_path() -> Result<PathBuf, ConfigError> {
        // For now, use a simple approach - we'll improve this when we have access to the app handle
        let home_dir = std::env::var("HOME")
            .or_else(|_| std::env::var("USERPROFILE"))
            .map_err(|_| ConfigError::ConfigDirAccess("Unable to determine home directory".to_string()))?;
        
        let app_config_dir = PathBuf::from(home_dir).join(".config").join("cocobolo");
        std::fs::create_dir_all(&app_config_dir)
            .map_err(|e| ConfigError::ConfigDirAccess(format!("Failed to create config directory: {}", e)))?;
        
        Ok(app_config_dir.join("config.json"))
    }

    /// Load configuration from file
    pub fn load() -> Result<Self, ConfigError> {
        let config_path = Self::config_file_path()?;
        
        if !config_path.exists() {
            // Create default config if it doesn't exist
            let default_config = Self::default();
            default_config.save()?;
            return Ok(default_config);
        }

        let config_content = std::fs::read_to_string(&config_path)?;
        
        // Try to parse the config, and if it fails due to missing fields, try migration
        let mut config: Self = match serde_json::from_str(&config_content) {
            Ok(config) => config,
            Err(e) => {
                // If parsing fails, it might be an old format. Try to migrate.
                eprintln!("Failed to parse config ({}), attempting migration...", e);
                Self::migrate_old_config(&config_content)?
            }
        };
        
        // Always attempt migration to handle any remaining old format fields
        config.migrate_from_old_format(&config_content)?;
        
        Ok(config)
    }

    /// Migrate old config format when parsing completely fails
    fn migrate_old_config(config_content: &str) -> Result<Self, ConfigError> {
        // Try to parse as a generic JSON value first
        let old_config: serde_json::Value = serde_json::from_str(config_content)
            .map_err(|e| ConfigError::ParseError(e))?;
        
        // Start with default config
        let mut new_config = Self::default();
        
        // Migrate known fields
        if let Some(theme) = old_config.get("theme").and_then(|v| v.as_str()) {
            new_config.theme = theme.to_string();
        }
        
        if let Some(auto_save_interval) = old_config.get("auto_save_interval").and_then(|v| v.as_u64()) {
            new_config.auto_save_interval = auto_save_interval;
        }
        
        if let Some(show_markdown_preview) = old_config.get("show_markdown_preview").and_then(|v| v.as_bool()) {
            new_config.show_markdown_preview = show_markdown_preview;
        }
        
        // Migrate old vault_location if it exists
        if let Some(vault_location) = old_config.get("vault_location").and_then(|v| v.as_str()) {
            let path = PathBuf::from(vault_location);
            if path.exists() {
                let vault_name = path.file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("Migrated Vault")
                    .to_string();
                
                let known_vault = KnownVault::new(vault_name, path, false); // Assume not encrypted for migration
                new_config.known_vaults.push(known_vault.clone());
                new_config.current_vault_id = Some(known_vault.id);
            }
        }
        
        // Save the migrated config
        new_config.save()?;
        
        Ok(new_config)
    }

    /// Migrate from old config format that had a single vault_location field
    fn migrate_from_old_format(&mut self, config_content: &str) -> Result<(), ConfigError> {
        // Try to parse as old format to check for vault_location field
        if let Ok(old_config) = serde_json::from_str::<serde_json::Value>(config_content) {
            if let Some(vault_location) = old_config.get("vault_location") {
                if let Some(path_str) = vault_location.as_str() {
                    let path = PathBuf::from(path_str);
                    if path.exists() && self.known_vaults.is_empty() {
                        // Migrate the old vault location to the new format
                        let vault_name = path.file_name()
                            .and_then(|n| n.to_str())
                            .unwrap_or("Migrated Vault")
                            .to_string();
                        
                        let known_vault = KnownVault::new(vault_name, path, false); // Assume not encrypted for migration
                        self.known_vaults.push(known_vault.clone());
                        self.current_vault_id = Some(known_vault.id);
                        
                        // Save the migrated config
                        self.save()?;
                    }
                }
            }
        }
        Ok(())
    }

    /// Save configuration to file
    pub fn save(&self) -> Result<(), ConfigError> {
        let config_path = Self::config_file_path()?;
        let config_content = serde_json::to_string_pretty(self)?;
        std::fs::write(&config_path, config_content)?;
        Ok(())
    }

    /// Add a new known vault
    pub fn add_known_vault(&mut self, name: String, path: PathBuf, is_encrypted: bool) -> Result<String, ConfigError> {
        // Validate that the path exists and is a directory
        if !path.exists() {
            return Err(ConfigError::InvalidVaultPath(
                format!("Path does not exist: {}", path.display())
            ));
        }

        if !path.is_dir() {
            return Err(ConfigError::InvalidVaultPath(
                format!("Path is not a directory: {}", path.display())
            ));
        }

        // Check if vault already exists
        if self.known_vaults.iter().any(|v| v.path == path) {
            return Err(ConfigError::InvalidVaultPath(
                format!("Vault already exists at path: {}", path.display())
            ));
        }

        // Test write permissions
        let test_file = path.join(".cocobolo_write_test");
        match std::fs::write(&test_file, "test") {
            Ok(_) => {
                // Clean up test file
                let _ = std::fs::remove_file(&test_file);
            }
            Err(_) => {
                return Err(ConfigError::InvalidVaultPath(
                    format!("Directory is not writable: {}", path.display())
                ));
            }
        }

        let known_vault = KnownVault::new(name, path, is_encrypted);
        let vault_id = known_vault.id.clone();
        self.known_vaults.push(known_vault);
        
        Ok(vault_id)
    }

    /// Remove a known vault by ID
    pub fn remove_known_vault(&mut self, vault_id: &str) -> Result<(), ConfigError> {
        let index = self.known_vaults.iter().position(|v| v.id == vault_id)
            .ok_or_else(|| ConfigError::VaultNotFound(vault_id.to_string()))?;
        
        self.known_vaults.remove(index);
        
        // Clear current vault if it was the removed one
        if self.current_vault_id.as_ref() == Some(&vault_id.to_string()) {
            self.current_vault_id = None;
        }
        
        // Remove from recent vaults
        self.recent_vault_ids.retain(|id| id != vault_id);
        
        Ok(())
    }

    /// Get a known vault by ID
    pub fn get_known_vault(&self, vault_id: &str) -> Option<&KnownVault> {
        self.known_vaults.iter().find(|v| v.id == vault_id)
    }

    /// Get a mutable reference to a known vault by ID
    pub fn get_known_vault_mut(&mut self, vault_id: &str) -> Option<&mut KnownVault> {
        self.known_vaults.iter_mut().find(|v| v.id == vault_id)
    }

    /// Get all known vaults
    pub fn get_known_vaults(&self) -> &[KnownVault] {
        &self.known_vaults
    }

    /// Set the current active vault
    pub fn set_current_vault(&mut self, vault_id: Option<String>) -> Result<(), ConfigError> {
        if let Some(ref id) = vault_id {
            // Verify the vault exists
            if !self.known_vaults.iter().any(|v| v.id == *id) {
                return Err(ConfigError::VaultNotFound(id.clone()));
            }
            
            // Update last accessed time
            if let Some(vault) = self.get_known_vault_mut(id) {
                vault.update_last_accessed();
            }
            
            // Add to recent vaults
            self.add_to_recent_vaults(id.clone());
        }
        
        self.current_vault_id = vault_id;
        Ok(())
    }

    /// Get the current active vault
    pub fn get_current_vault(&self) -> Option<&KnownVault> {
        self.current_vault_id.as_ref()
            .and_then(|id| self.get_known_vault(id))
    }

    /// Add a vault to recent vaults list
    fn add_to_recent_vaults(&mut self, vault_id: String) {
        // Remove if already exists
        self.recent_vault_ids.retain(|id| *id != vault_id);
        
        // Add to front
        self.recent_vault_ids.insert(0, vault_id);
        
        // Trim to max size
        self.recent_vault_ids.truncate(self.max_recent_vaults);
    }

    /// Get recent vaults in order of most recent first
    pub fn get_recent_vaults(&self) -> Vec<&KnownVault> {
        self.recent_vault_ids.iter()
            .filter_map(|id| self.get_known_vault(id))
            .collect()
    }

    /// Update vault metadata (name, favorite status, etc.)
    pub fn update_vault_metadata(&mut self, vault_id: &str, name: Option<String>, is_favorite: Option<bool>) -> Result<(), ConfigError> {
        let vault = self.get_known_vault_mut(vault_id)
            .ok_or_else(|| ConfigError::VaultNotFound(vault_id.to_string()))?;
        
        if let Some(name) = name {
            vault.name = name;
        }
        
        if let Some(is_favorite) = is_favorite {
            vault.is_favorite = is_favorite;
        }
        
        Ok(())
    }

    /// Get favorite vaults
    pub fn get_favorite_vaults(&self) -> Vec<&KnownVault> {
        self.known_vaults.iter()
            .filter(|v| v.is_favorite)
            .collect()
    }

    /// Clean up invalid vaults (paths that no longer exist)
    pub fn cleanup_invalid_vaults(&mut self) -> Vec<String> {
        let mut removed_ids = Vec::new();
        
        self.known_vaults.retain(|vault| {
            if !vault.is_valid() {
                removed_ids.push(vault.id.clone());
                false
            } else {
                true
            }
        });
        
        // Clean up references to removed vaults
        for removed_id in &removed_ids {
            if self.current_vault_id.as_ref() == Some(removed_id) {
                self.current_vault_id = None;
            }
            self.recent_vault_ids.retain(|id| id != removed_id);
        }
        
        removed_ids
    }

    // Legacy compatibility methods
    
    /// Set vault location (for backward compatibility)
    #[deprecated(note = "Use add_known_vault instead")]
    pub fn set_vault_location<P: AsRef<Path>>(&mut self, path: P) -> Result<(), ConfigError> {
        let path = path.as_ref().to_path_buf();
        let vault_name = path.file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("Default Vault")
            .to_string();
        
        let vault_id = self.add_known_vault(vault_name, path, false)?;
        self.set_current_vault(Some(vault_id))?;
        Ok(())
    }

    /// Get vault location (for backward compatibility)
    #[deprecated(note = "Use get_current_vault instead")]
    pub fn get_vault_location(&self) -> Option<&PathBuf> {
        self.get_current_vault().map(|v| &v.path)
    }

    /// Check if vault location is configured and valid (for backward compatibility)
    #[deprecated(note = "Use get_current_vault and check is_valid instead")]
    #[allow(dead_code)]
    pub fn is_vault_configured(&self) -> bool {
        self.get_current_vault()
            .map(|v| v.is_valid())
            .unwrap_or(false)
    }
} 