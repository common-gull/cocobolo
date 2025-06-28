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
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AppConfig {
    pub vault_location: Option<PathBuf>,
    pub theme: String,
    pub auto_save_interval: u64,
    pub show_markdown_preview: bool,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            vault_location: None,
            theme: "system".to_string(),
            auto_save_interval: 300, // 5 minutes in seconds
            show_markdown_preview: true,
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
        let config: Self = serde_json::from_str(&config_content)?;
        Ok(config)
    }

    /// Save configuration to file
    pub fn save(&self) -> Result<(), ConfigError> {
        let config_path = Self::config_file_path()?;
        let config_content = serde_json::to_string_pretty(self)?;
        std::fs::write(&config_path, config_content)?;
        Ok(())
    }

    /// Set vault location and validate it
    pub fn set_vault_location<P: AsRef<Path>>(&mut self, path: P) -> Result<(), ConfigError> {
        let path = path.as_ref();
        
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

        // Test write permissions by creating a temporary file
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

        self.vault_location = Some(path.to_path_buf());
        Ok(())
    }

    /// Get vault location if set and valid
    pub fn get_vault_location(&self) -> Option<&PathBuf> {
        self.vault_location.as_ref()
    }

    /// Check if vault location is configured and valid
    #[allow(dead_code)]
    pub fn is_vault_configured(&self) -> bool {
        if let Some(vault_path) = &self.vault_location {
            vault_path.exists() && vault_path.is_dir()
        } else {
            false
        }
    }
} 