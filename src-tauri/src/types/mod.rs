use serde::{Deserialize, Serialize};
use crate::vault::{Note, VaultInfo};

#[derive(Serialize, Deserialize, Debug)]
pub struct AppInfo {
    pub name: String,
    pub version: String,
    pub description: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct VaultLocationInfo {
    pub path: String,
    pub is_valid: bool,
    pub is_writable: bool,
    pub has_existing_vault: bool,
    pub vault_info: Option<VaultInfo>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct VaultSetupInfo {
    pub needs_password: bool,
    pub is_encrypted: bool,
    pub vault_info: Option<VaultInfo>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct VaultUnlockResult {
    pub success: bool,
    pub session_id: Option<String>,
    pub vault_info: Option<VaultInfo>,
    pub error_message: Option<String>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct RateLimitInfo {
    pub is_rate_limited: bool,
    pub seconds_remaining: Option<u64>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct CreateNoteRequest {
    pub title: String,
    pub content: Option<String>,
    pub tags: Option<Vec<String>>,
    pub folder_path: Option<String>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct CreateNoteResult {
    pub success: bool,
    pub note: Option<Note>,
    pub error_message: Option<String>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct SaveNoteRequest {
    pub id: String,
    pub title: Option<String>,
    pub content: Option<String>,
    pub tags: Option<Vec<String>>,
    pub folder_path: Option<String>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct SaveNoteResult {
    pub success: bool,
    pub note: Option<Note>,
    pub error_message: Option<String>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct AddVaultRequest {
    pub name: String,
    pub path: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct AddVaultResult {
    pub success: bool,
    pub vault_id: Option<String>,
    pub error_message: Option<String>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct UpdateVaultMetadataRequest {
    pub vault_id: String,
    pub name: Option<String>,
    pub is_favorite: Option<bool>,
}