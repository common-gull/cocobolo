//! # Data Types and Structures
//!
//! This module contains all request and response data structures used for communication
//! between the frontend and backend. All types are designed to be serializable and
//! provide clear, type-safe interfaces for the application's API.
//!
//! ## Organization
//!
//! Types are organized by functionality:
//!
//! - **App Types**: Application information and configuration
//! - **Vault Types**: Vault management and metadata
//! - **Note Types**: Note data and operations
//! - **Folder Types**: Folder hierarchy and management
//! - **Auth Types**: Authentication and session management
//!
//! ## Serialization
//!
//! All types implement `Serialize` and `Deserialize` traits for JSON communication.
//! Optional fields are used extensively to provide flexible APIs while maintaining
//! backward compatibility.
//!
//! ## Security Considerations
//!
//! - Sensitive data (passwords, keys) are never included in serializable types
//! - File paths are validated before use
//! - Input validation is performed on all user-provided data

use serde::{Deserialize, Serialize};

// Re-export types from other modules for convenience
pub use crate::crypto::PasswordStrength;
pub use crate::vault::{Note, VaultInfo};

/// Application information structure
///
/// Contains basic information about the application including version,
/// name, and description. Used for about dialogs and system information.
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AppInfo {
    pub name: String,
    pub version: String,
    pub description: String,
}

/// Application configuration structure
///
/// Contains user preferences and application settings. This structure
/// is persisted to disk and synchronized across application sessions.
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AppConfig {
    pub theme: String,
    pub auto_save_interval: u32,
    pub show_markdown_preview: bool,
    pub window_maximized: bool,
    pub window_width: Option<u32>,
    pub window_height: Option<u32>,
}

/// Vault location validation information
///
/// Contains information about a potential vault location including
/// validity, permissions, and existing vault detection.
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct VaultLocationInfo {
    pub path: String,
    pub is_valid: bool,
    pub is_writable: bool,
    pub has_existing_vault: bool,
    pub vault_info: Option<VaultInfo>,
}

/// Known vault metadata
///
/// Contains information about vaults that the application is aware of,
/// including access history and user preferences.
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct KnownVaultInfo {
    pub id: String,
    pub name: String,
    pub path: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub last_accessed: Option<chrono::DateTime<chrono::Utc>>,
    pub is_favorite: bool,
}

/// Vault setup status information
///
/// Contains information about the current state of vault setup,
/// including whether encryption is needed and vault validity.
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct VaultSetupStatus {
    pub needs_password: bool,
    pub is_encrypted: bool,
    pub vault_info: Option<VaultInfo>,
}

/// Vault unlock result
///
/// Contains the result of a vault unlock operation including
/// success status, session information, and error details.
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct VaultUnlockResult {
    pub success: bool,
    pub session_id: Option<String>,
    pub vault_info: Option<VaultInfo>,
    pub error_message: Option<String>,
}

/// Rate limiting information
///
/// Contains information about rate limiting status for password
/// attempts and other security-sensitive operations.
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct RateLimitInfo {
    pub is_rate_limited: bool,
    pub seconds_remaining: Option<u64>,
}

/// Note metadata for listings
///
/// Contains essential note information for list displays
/// without the full content for performance reasons.
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct NoteMetadata {
    pub id: String,
    pub title: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
    pub tags: Vec<String>,
    pub folder_path: Option<String>,
    pub note_type: String,
    pub content_preview: String,
}

/// Request structure for adding a known vault
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AddVaultRequest {
    pub name: String,
    pub path: String,
}

/// Result structure for adding a known vault
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AddVaultResult {
    pub success: bool,
    pub vault_id: Option<String>,
    pub error_message: Option<String>,
}

/// Request structure for updating vault metadata
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct UpdateVaultMetadataRequest {
    pub vault_id: String,
    pub name: Option<String>,
    pub is_favorite: Option<bool>,
}

/// Request structure for creating a note
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CreateNoteRequest {
    pub title: String,
    pub content: Option<String>,
    pub tags: Option<Vec<String>>,
    pub folder_path: Option<String>,
}

/// Result structure for creating a note
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CreateNoteResult {
    pub success: bool,
    pub note: Option<Note>,
    pub error_message: Option<String>,
}

/// Result structure for saving a note
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SaveNoteResult {
    pub success: bool,
    pub note: Option<Note>,
    pub error_message: Option<String>,
}
