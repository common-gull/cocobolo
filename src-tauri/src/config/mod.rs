use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

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
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub last_accessed: Option<chrono::DateTime<chrono::Utc>>,
    pub is_favorite: bool,
}

impl KnownVault {
    pub fn new(name: String, path: PathBuf) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            name,
            path,
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
            .map_err(|_| {
                ConfigError::ConfigDirAccess("Unable to determine home directory".to_string())
            })?;

        let app_config_dir = PathBuf::from(home_dir).join(".config").join("cocobolo");
        std::fs::create_dir_all(&app_config_dir).map_err(|e| {
            ConfigError::ConfigDirAccess(format!("Failed to create config directory: {}", e))
        })?;

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
        let old_config: serde_json::Value =
            serde_json::from_str(config_content).map_err(|e| ConfigError::ParseError(e))?;

        // Start with default config
        let mut new_config = Self::default();

        // Migrate known fields
        if let Some(theme) = old_config.get("theme").and_then(|v| v.as_str()) {
            new_config.theme = theme.to_string();
        }

        if let Some(auto_save_interval) = old_config
            .get("auto_save_interval")
            .and_then(|v| v.as_u64())
        {
            new_config.auto_save_interval = auto_save_interval;
        }

        if let Some(show_markdown_preview) = old_config
            .get("show_markdown_preview")
            .and_then(|v| v.as_bool())
        {
            new_config.show_markdown_preview = show_markdown_preview;
        }

        // Migrate old vault_location if it exists
        if let Some(vault_location) = old_config.get("vault_location").and_then(|v| v.as_str()) {
            let path = PathBuf::from(vault_location);
            if path.exists() {
                let vault_name = path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("Migrated Vault")
                    .to_string();

                let known_vault = KnownVault::new(vault_name, path);
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
                        let vault_name = path
                            .file_name()
                            .and_then(|n| n.to_str())
                            .unwrap_or("Migrated Vault")
                            .to_string();

                        let known_vault = KnownVault::new(vault_name, path);
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
    pub fn add_known_vault(&mut self, name: String, path: PathBuf) -> Result<String, ConfigError> {
        // Validate that the path exists and is a directory
        if !path.exists() {
            return Err(ConfigError::InvalidVaultPath(format!(
                "Path does not exist: {}",
                path.display()
            )));
        }

        if !path.is_dir() {
            return Err(ConfigError::InvalidVaultPath(format!(
                "Path is not a directory: {}",
                path.display()
            )));
        }

        // Check if vault already exists
        if self.known_vaults.iter().any(|v| v.path == path) {
            return Err(ConfigError::InvalidVaultPath(format!(
                "Vault already exists at path: {}",
                path.display()
            )));
        }

        // Test write permissions
        let test_file = path.join(".cocobolo_write_test");
        match std::fs::write(&test_file, "test") {
            Ok(_) => {
                // Clean up test file
                let _ = std::fs::remove_file(&test_file);
            }
            Err(_) => {
                return Err(ConfigError::InvalidVaultPath(format!(
                    "Directory is not writable: {}",
                    path.display()
                )));
            }
        }

        let known_vault = KnownVault::new(name, path);
        let vault_id = known_vault.id.clone();
        self.known_vaults.push(known_vault);

        Ok(vault_id)
    }

    /// Remove a known vault by ID
    pub fn remove_known_vault(&mut self, vault_id: &str) -> Result<(), ConfigError> {
        let index = self
            .known_vaults
            .iter()
            .position(|v| v.id == vault_id)
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
        self.current_vault_id
            .as_ref()
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
        self.recent_vault_ids
            .iter()
            .filter_map(|id| self.get_known_vault(id))
            .collect()
    }

    /// Update vault metadata (name, favorite status, etc.)
    pub fn update_vault_metadata(
        &mut self,
        vault_id: &str,
        name: Option<String>,
        is_favorite: Option<bool>,
    ) -> Result<(), ConfigError> {
        let vault = self
            .get_known_vault_mut(vault_id)
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
        self.known_vaults.iter().filter(|v| v.is_favorite).collect()
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
}

#[cfg(test)]
mod tests {
    use super::*;
    use serial_test::serial;
    use std::env;
    use tempfile::TempDir;

    // Helper function to create a temporary config directory
    fn setup_temp_config() -> TempDir {
        TempDir::new().unwrap()
    }

    // Helper function to set up environment for config tests
    fn setup_config_env(temp_dir: &TempDir) {
        env::set_var("HOME", temp_dir.path());
        env::remove_var("USERPROFILE"); // Ensure we use HOME
    }

    #[test]
    fn test_known_vault_creation() {
        let temp_dir = setup_temp_config();
        let vault_path = temp_dir.path().join("test_vault");
        std::fs::create_dir_all(&vault_path).unwrap();

        let vault = KnownVault::new("Test Vault".to_string(), vault_path.clone());

        assert_eq!(vault.name, "Test Vault");
        assert_eq!(vault.path, vault_path);
        assert!(!vault.id.is_empty());
        assert!(vault.last_accessed.is_none());
        assert!(!vault.is_favorite);
        assert!(vault.created_at <= chrono::Utc::now());
    }

    #[test]
    fn test_known_vault_validity() {
        let temp_dir = setup_temp_config();
        let valid_path = temp_dir.path().join("valid_vault");
        let invalid_path = temp_dir.path().join("invalid_vault");

        std::fs::create_dir_all(&valid_path).unwrap();
        // Don't create invalid_path

        let valid_vault = KnownVault::new("Valid".to_string(), valid_path);
        let invalid_vault = KnownVault::new("Invalid".to_string(), invalid_path);

        assert!(valid_vault.is_valid());
        assert!(!invalid_vault.is_valid());
    }

    #[test]
    fn test_known_vault_update_last_accessed() {
        let temp_dir = setup_temp_config();
        let vault_path = temp_dir.path().join("test_vault");
        std::fs::create_dir_all(&vault_path).unwrap();

        let mut vault = KnownVault::new("Test".to_string(), vault_path);
        assert!(vault.last_accessed.is_none());

        vault.update_last_accessed();
        assert!(vault.last_accessed.is_some());
        assert!(vault.last_accessed.unwrap() <= chrono::Utc::now());
    }

    #[test]
    fn test_app_config_default() {
        let config = AppConfig::default();

        assert!(config.current_vault_id.is_none());
        assert!(config.known_vaults.is_empty());
        assert_eq!(config.theme, "system");
        assert_eq!(config.auto_save_interval, 300);
        assert!(config.show_markdown_preview);
        assert!(!config.window_maximized);
        assert!(config.window_width.is_none());
        assert!(config.window_height.is_none());
        assert!(config.recent_vault_ids.is_empty());
        assert_eq!(config.max_recent_vaults, 5);
    }

    #[test]
    #[serial]
    fn test_config_load_creates_default() {
        let temp_dir = setup_temp_config();
        setup_config_env(&temp_dir);

        let config = AppConfig::load().unwrap();

        // Should create default config
        assert!(config.current_vault_id.is_none());
        assert!(config.known_vaults.is_empty());
        assert_eq!(config.theme, "system");
    }

    #[test]
    #[serial]
    fn test_config_save_and_load() {
        let temp_dir = setup_temp_config();
        setup_config_env(&temp_dir);

        let mut config = AppConfig::default();
        config.theme = "dark".to_string();
        config.auto_save_interval = 600;
        config.show_markdown_preview = false;

        // Save config
        config.save().unwrap();

        // Load config
        let loaded_config = AppConfig::load().unwrap();

        assert_eq!(loaded_config.theme, "dark");
        assert_eq!(loaded_config.auto_save_interval, 600);
        assert!(!loaded_config.show_markdown_preview);
    }

    #[test]
    #[serial]
    fn test_add_known_vault() {
        let temp_dir = setup_temp_config();
        setup_config_env(&temp_dir);

        let vault_path = temp_dir.path().join("test_vault");
        std::fs::create_dir_all(&vault_path).unwrap();

        let mut config = AppConfig::default();
        let vault_id = config
            .add_known_vault("Test Vault".to_string(), vault_path.clone())
            .unwrap();

        assert_eq!(config.known_vaults.len(), 1);
        assert_eq!(config.known_vaults[0].name, "Test Vault");
        assert_eq!(config.known_vaults[0].path, vault_path);
        assert_eq!(config.known_vaults[0].id, vault_id);
    }

    #[test]
    #[serial]
    fn test_add_known_vault_invalid_path() {
        let temp_dir = setup_temp_config();
        setup_config_env(&temp_dir);

        let invalid_path = temp_dir.path().join("nonexistent");
        let mut config = AppConfig::default();

        let result = config.add_known_vault("Test".to_string(), invalid_path);
        assert!(result.is_err());
        assert!(matches!(
            result.unwrap_err(),
            ConfigError::InvalidVaultPath(_)
        ));
    }

    #[test]
    #[serial]
    fn test_add_known_vault_file_not_directory() {
        let temp_dir = setup_temp_config();
        setup_config_env(&temp_dir);

        let file_path = temp_dir.path().join("test_file.txt");
        std::fs::write(&file_path, "test").unwrap();

        let mut config = AppConfig::default();
        let result = config.add_known_vault("Test".to_string(), file_path);

        assert!(result.is_err());
        assert!(matches!(
            result.unwrap_err(),
            ConfigError::InvalidVaultPath(_)
        ));
    }

    #[test]
    #[serial]
    fn test_add_known_vault_duplicate_path() {
        let temp_dir = setup_temp_config();
        setup_config_env(&temp_dir);

        let vault_path = temp_dir.path().join("test_vault");
        std::fs::create_dir_all(&vault_path).unwrap();

        let mut config = AppConfig::default();
        config
            .add_known_vault("First".to_string(), vault_path.clone())
            .unwrap();

        let result = config.add_known_vault("Second".to_string(), vault_path);
        assert!(result.is_err());
        assert!(matches!(
            result.unwrap_err(),
            ConfigError::InvalidVaultPath(_)
        ));
    }

    #[test]
    #[serial]
    fn test_add_known_vault_not_writable() {
        let temp_dir = setup_temp_config();
        setup_config_env(&temp_dir);

        let vault_path = temp_dir.path().join("readonly_vault");
        std::fs::create_dir_all(&vault_path).unwrap();

        // Make directory read-only (Unix only)
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mut perms = std::fs::metadata(&vault_path).unwrap().permissions();
            perms.set_mode(0o444); // Read-only
            std::fs::set_permissions(&vault_path, perms).unwrap();

            let mut config = AppConfig::default();
            let result = config.add_known_vault("Test".to_string(), vault_path.clone());

            // Restore permissions for cleanup
            let mut perms = std::fs::metadata(&vault_path).unwrap().permissions();
            perms.set_mode(0o755);
            std::fs::set_permissions(&vault_path, perms).unwrap();

            assert!(result.is_err());
            assert!(matches!(
                result.unwrap_err(),
                ConfigError::InvalidVaultPath(_)
            ));
        }
    }

    #[test]
    #[serial]
    fn test_remove_known_vault() {
        let temp_dir = setup_temp_config();
        setup_config_env(&temp_dir);

        let vault_path = temp_dir.path().join("test_vault");
        std::fs::create_dir_all(&vault_path).unwrap();

        let mut config = AppConfig::default();
        let vault_id = config
            .add_known_vault("Test".to_string(), vault_path)
            .unwrap();

        assert_eq!(config.known_vaults.len(), 1);

        config.remove_known_vault(&vault_id).unwrap();
        assert_eq!(config.known_vaults.len(), 0);
    }

    #[test]
    #[serial]
    fn test_remove_known_vault_not_found() {
        let mut config = AppConfig::default();
        let result = config.remove_known_vault("nonexistent_id");

        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), ConfigError::VaultNotFound(_)));
    }

    #[test]
    #[serial]
    fn test_remove_known_vault_clears_current() {
        let temp_dir = setup_temp_config();
        setup_config_env(&temp_dir);

        let vault_path = temp_dir.path().join("test_vault");
        std::fs::create_dir_all(&vault_path).unwrap();

        let mut config = AppConfig::default();
        let vault_id = config
            .add_known_vault("Test".to_string(), vault_path)
            .unwrap();
        config.set_current_vault(Some(vault_id.clone())).unwrap();

        assert_eq!(config.current_vault_id, Some(vault_id.clone()));

        config.remove_known_vault(&vault_id).unwrap();
        assert!(config.current_vault_id.is_none());
    }

    #[test]
    #[serial]
    fn test_get_known_vault() {
        let temp_dir = setup_temp_config();
        setup_config_env(&temp_dir);

        let vault_path = temp_dir.path().join("test_vault");
        std::fs::create_dir_all(&vault_path).unwrap();

        let mut config = AppConfig::default();
        let vault_id = config
            .add_known_vault("Test".to_string(), vault_path.clone())
            .unwrap();

        let vault = config.get_known_vault(&vault_id).unwrap();
        assert_eq!(vault.name, "Test");
        assert_eq!(vault.path, vault_path);

        assert!(config.get_known_vault("nonexistent").is_none());
    }

    #[test]
    #[serial]
    fn test_get_known_vault_mut() {
        let temp_dir = setup_temp_config();
        setup_config_env(&temp_dir);

        let vault_path = temp_dir.path().join("test_vault");
        std::fs::create_dir_all(&vault_path).unwrap();

        let mut config = AppConfig::default();
        let vault_id = config
            .add_known_vault("Test".to_string(), vault_path)
            .unwrap();

        {
            let vault = config.get_known_vault_mut(&vault_id).unwrap();
            vault.name = "Modified Test".to_string();
        }

        let vault = config.get_known_vault(&vault_id).unwrap();
        assert_eq!(vault.name, "Modified Test");
    }

    #[test]
    #[serial]
    fn test_set_current_vault() {
        let temp_dir = setup_temp_config();
        setup_config_env(&temp_dir);

        let vault_path = temp_dir.path().join("test_vault");
        std::fs::create_dir_all(&vault_path).unwrap();

        let mut config = AppConfig::default();
        let vault_id = config
            .add_known_vault("Test".to_string(), vault_path)
            .unwrap();

        config.set_current_vault(Some(vault_id.clone())).unwrap();
        assert_eq!(config.current_vault_id, Some(vault_id.clone()));

        // Should update last accessed
        let vault = config.get_known_vault(&vault_id).unwrap();
        assert!(vault.last_accessed.is_some());

        // Should add to recent vaults
        assert!(config.recent_vault_ids.contains(&vault_id));
    }

    #[test]
    #[serial]
    fn test_set_current_vault_nonexistent() {
        let mut config = AppConfig::default();
        let result = config.set_current_vault(Some("nonexistent".to_string()));

        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), ConfigError::VaultNotFound(_)));
    }

    #[test]
    #[serial]
    fn test_set_current_vault_none() {
        let temp_dir = setup_temp_config();
        setup_config_env(&temp_dir);

        let vault_path = temp_dir.path().join("test_vault");
        std::fs::create_dir_all(&vault_path).unwrap();

        let mut config = AppConfig::default();
        let vault_id = config
            .add_known_vault("Test".to_string(), vault_path)
            .unwrap();
        config.set_current_vault(Some(vault_id)).unwrap();

        config.set_current_vault(None).unwrap();
        assert!(config.current_vault_id.is_none());
    }

    #[test]
    #[serial]
    fn test_get_current_vault() {
        let temp_dir = setup_temp_config();
        setup_config_env(&temp_dir);

        let vault_path = temp_dir.path().join("test_vault");
        std::fs::create_dir_all(&vault_path).unwrap();

        let mut config = AppConfig::default();
        let vault_id = config
            .add_known_vault("Test".to_string(), vault_path.clone())
            .unwrap();

        assert!(config.get_current_vault().is_none());

        config.set_current_vault(Some(vault_id)).unwrap();
        let current_vault = config.get_current_vault().unwrap();
        assert_eq!(current_vault.name, "Test");
        assert_eq!(current_vault.path, vault_path);
    }

    #[test]
    #[serial]
    fn test_recent_vaults_management() {
        let temp_dir = setup_temp_config();
        setup_config_env(&temp_dir);

        let mut config = AppConfig::default();
        config.max_recent_vaults = 3;

        // Add multiple vaults
        let mut vault_ids = Vec::new();
        for i in 0..5 {
            let vault_path = temp_dir.path().join(format!("vault_{}", i));
            std::fs::create_dir_all(&vault_path).unwrap();
            let vault_id = config
                .add_known_vault(format!("Vault {}", i), vault_path)
                .unwrap();
            vault_ids.push(vault_id);
        }

        // Set them as current in order
        for vault_id in &vault_ids {
            config.set_current_vault(Some(vault_id.clone())).unwrap();
        }

        // Should only keep the last 3 in recent
        assert_eq!(config.recent_vault_ids.len(), 3);
        assert!(config.recent_vault_ids.contains(&vault_ids[4]));
        assert!(config.recent_vault_ids.contains(&vault_ids[3]));
        assert!(config.recent_vault_ids.contains(&vault_ids[2]));
        assert!(!config.recent_vault_ids.contains(&vault_ids[1]));
        assert!(!config.recent_vault_ids.contains(&vault_ids[0]));
    }

    #[test]
    #[serial]
    fn test_get_recent_vaults() {
        let temp_dir = setup_temp_config();
        setup_config_env(&temp_dir);

        let mut config = AppConfig::default();

        // Add vaults
        let vault_path1 = temp_dir.path().join("vault1");
        let vault_path2 = temp_dir.path().join("vault2");
        std::fs::create_dir_all(&vault_path1).unwrap();
        std::fs::create_dir_all(&vault_path2).unwrap();

        let vault_id1 = config
            .add_known_vault("Vault 1".to_string(), vault_path1)
            .unwrap();
        let vault_id2 = config
            .add_known_vault("Vault 2".to_string(), vault_path2)
            .unwrap();

        config.set_current_vault(Some(vault_id1.clone())).unwrap();
        config.set_current_vault(Some(vault_id2.clone())).unwrap();

        let recent_vaults = config.get_recent_vaults();
        assert_eq!(recent_vaults.len(), 2);
        assert_eq!(recent_vaults[0].id, vault_id2); // Most recent first
        assert_eq!(recent_vaults[1].id, vault_id1);
    }

    #[test]
    #[serial]
    fn test_update_vault_metadata() {
        let temp_dir = setup_temp_config();
        setup_config_env(&temp_dir);

        let vault_path = temp_dir.path().join("test_vault");
        std::fs::create_dir_all(&vault_path).unwrap();

        let mut config = AppConfig::default();
        let vault_id = config
            .add_known_vault("Test".to_string(), vault_path)
            .unwrap();

        config
            .update_vault_metadata(&vault_id, Some("Updated Name".to_string()), Some(true))
            .unwrap();

        let vault = config.get_known_vault(&vault_id).unwrap();
        assert_eq!(vault.name, "Updated Name");
        assert!(vault.is_favorite);
    }

    #[test]
    #[serial]
    fn test_update_vault_metadata_partial() {
        let temp_dir = setup_temp_config();
        setup_config_env(&temp_dir);

        let vault_path = temp_dir.path().join("test_vault");
        std::fs::create_dir_all(&vault_path).unwrap();

        let mut config = AppConfig::default();
        let vault_id = config
            .add_known_vault("Test".to_string(), vault_path)
            .unwrap();

        // Update only name
        config
            .update_vault_metadata(&vault_id, Some("New Name".to_string()), None)
            .unwrap();

        let vault = config.get_known_vault(&vault_id).unwrap();
        assert_eq!(vault.name, "New Name");
        assert!(!vault.is_favorite); // Should remain unchanged

        // Update only favorite status
        config
            .update_vault_metadata(&vault_id, None, Some(true))
            .unwrap();

        let vault = config.get_known_vault(&vault_id).unwrap();
        assert_eq!(vault.name, "New Name"); // Should remain unchanged
        assert!(vault.is_favorite);
    }

    #[test]
    #[serial]
    fn test_get_favorite_vaults() {
        let temp_dir = setup_temp_config();
        setup_config_env(&temp_dir);

        let mut config = AppConfig::default();

        // Add multiple vaults
        let vault_path1 = temp_dir.path().join("vault1");
        let vault_path2 = temp_dir.path().join("vault2");
        let vault_path3 = temp_dir.path().join("vault3");
        std::fs::create_dir_all(&vault_path1).unwrap();
        std::fs::create_dir_all(&vault_path2).unwrap();
        std::fs::create_dir_all(&vault_path3).unwrap();

        let vault_id1 = config
            .add_known_vault("Vault 1".to_string(), vault_path1)
            .unwrap();
        let vault_id2 = config
            .add_known_vault("Vault 2".to_string(), vault_path2)
            .unwrap();
        let vault_id3 = config
            .add_known_vault("Vault 3".to_string(), vault_path3)
            .unwrap();

        // Mark some as favorites
        config
            .update_vault_metadata(&vault_id1, None, Some(true))
            .unwrap();
        config
            .update_vault_metadata(&vault_id3, None, Some(true))
            .unwrap();

        let favorite_vaults = config.get_favorite_vaults();
        assert_eq!(favorite_vaults.len(), 2);
        assert!(favorite_vaults.iter().any(|v| v.id == vault_id1));
        assert!(favorite_vaults.iter().any(|v| v.id == vault_id3));
        assert!(!favorite_vaults.iter().any(|v| v.id == vault_id2));
    }

    #[test]
    #[serial]
    fn test_cleanup_invalid_vaults() {
        let temp_dir = setup_temp_config();
        setup_config_env(&temp_dir);

        let mut config = AppConfig::default();

        // Add valid vault
        let valid_path = temp_dir.path().join("valid_vault");
        std::fs::create_dir_all(&valid_path).unwrap();
        let valid_id = config
            .add_known_vault("Valid".to_string(), valid_path)
            .unwrap();

        // Add invalid vault - create it first so it passes validation
        let invalid_path = temp_dir.path().join("invalid_vault");
        std::fs::create_dir_all(&invalid_path).unwrap();
        let invalid_id = config
            .add_known_vault("Invalid".to_string(), invalid_path.clone())
            .unwrap();

        // Manually remove the directory to simulate it becoming invalid
        std::fs::remove_dir_all(&invalid_path).ok();

        // Set invalid vault as current and add to recent
        config.set_current_vault(Some(invalid_id.clone())).unwrap();

        assert_eq!(config.known_vaults.len(), 2);
        assert_eq!(config.current_vault_id, Some(invalid_id.clone()));
        assert!(config.recent_vault_ids.contains(&invalid_id));

        let removed_ids = config.cleanup_invalid_vaults();

        assert_eq!(removed_ids.len(), 1);
        assert_eq!(removed_ids[0], invalid_id);
        assert_eq!(config.known_vaults.len(), 1);
        assert_eq!(config.known_vaults[0].id, valid_id);
        assert!(config.current_vault_id.is_none());
        assert!(!config.recent_vault_ids.contains(&invalid_id));
    }

    #[test]
    #[serial]
    fn test_migrate_old_config() {
        let temp_dir = setup_temp_config();
        setup_config_env(&temp_dir);

        // Create old format config
        let vault_path = temp_dir.path().join("old_vault");
        std::fs::create_dir_all(&vault_path).unwrap();

        let old_config = serde_json::json!({
            "vault_location": vault_path.to_str().unwrap(),
            "theme": "dark",
            "auto_save_interval": 600,
            "show_markdown_preview": false
        });

        let config_path = temp_dir
            .path()
            .join(".config")
            .join("cocobolo")
            .join("config.json");
        std::fs::create_dir_all(config_path.parent().unwrap()).unwrap();
        std::fs::write(&config_path, old_config.to_string()).unwrap();

        // Load config should migrate automatically
        let config = AppConfig::load().unwrap();

        assert_eq!(config.theme, "dark");
        assert_eq!(config.auto_save_interval, 600);
        assert!(!config.show_markdown_preview);
        assert_eq!(config.known_vaults.len(), 1);
        assert_eq!(config.known_vaults[0].path, vault_path);
        assert!(config.current_vault_id.is_some());
    }

    #[test]
    #[serial]
    fn test_config_file_path() {
        let temp_dir = setup_temp_config();
        setup_config_env(&temp_dir);

        let config_path = AppConfig::config_file_path().unwrap();
        let expected_path = temp_dir
            .path()
            .join(".config")
            .join("cocobolo")
            .join("config.json");

        assert_eq!(config_path, expected_path);
        assert!(config_path.parent().unwrap().exists());
    }

    #[test]
    #[serial]
    fn test_config_file_path_no_home() {
        env::remove_var("HOME");
        env::remove_var("USERPROFILE");

        let result = AppConfig::config_file_path();
        assert!(result.is_err());
        assert!(matches!(
            result.unwrap_err(),
            ConfigError::ConfigDirAccess(_)
        ));
    }

    #[test]
    fn test_default_max_recent_vaults() {
        assert_eq!(default_max_recent_vaults(), 5);
    }

    #[test]
    fn test_config_error_display() {
        let error = ConfigError::ConfigDirAccess("test error".to_string());
        assert_eq!(
            error.to_string(),
            "Failed to access config directory: test error"
        );

        let error = ConfigError::InvalidVaultPath("test path".to_string());
        assert_eq!(error.to_string(), "Invalid vault path: test path");

        let error = ConfigError::VaultNotFound("test_id".to_string());
        assert_eq!(error.to_string(), "Vault not found: test_id");
    }

    #[test]
    fn test_config_serialization() {
        let temp_dir = setup_temp_config();
        let vault_path = temp_dir.path().join("test_vault");
        std::fs::create_dir_all(&vault_path).unwrap();

        let mut config = AppConfig::default();
        config.theme = "dark".to_string();
        let vault_id = config
            .add_known_vault("Test".to_string(), vault_path)
            .unwrap();
        config.set_current_vault(Some(vault_id)).unwrap();

        // Serialize and deserialize
        let serialized = serde_json::to_string(&config).unwrap();
        let deserialized: AppConfig = serde_json::from_str(&serialized).unwrap();

        assert_eq!(config.theme, deserialized.theme);
        assert_eq!(config.current_vault_id, deserialized.current_vault_id);
        assert_eq!(config.known_vaults.len(), deserialized.known_vaults.len());
        assert_eq!(config.known_vaults[0].id, deserialized.known_vaults[0].id);
    }
}
