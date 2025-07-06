use serde::Serialize;
use thiserror::Error;

use crate::config::ConfigError;
use crate::crypto::CryptoError;
use crate::vault::VaultError;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("IO operation failed: {0}")]
    Io(#[from] std::io::Error),

    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    #[error("Configuration error: {0}")]
    Config(#[from] ConfigError),

    #[error("Vault operation error: {0}")]
    Vault(#[from] VaultOperationError),

    #[error("Note operation error: {0}")]
    Note(#[from] NoteOperationError),

    #[error("Folder operation error: {0}")]
    Folder(#[from] FolderOperationError),

    #[error("Crypto operation error: {0}")]
    Crypto(#[from] CryptoError),

    #[error("Authentication error: {0}")]
    Authentication(#[from] AuthenticationError),

    #[error("Validation error: {0}")]
    Validation(#[from] ValidationError),

    #[error("Legacy vault error: {0}")]
    LegacyVault(#[from] VaultError),

    #[error("Application error: {0}")]
    Application(String),
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::ser::Serializer,
    {
        serializer.serialize_str(self.to_string().as_ref())
    }
}

#[derive(Error, Debug)]
pub enum VaultOperationError {
    #[error("Vault not found at path: {path}")]
    VaultNotFound { path: String },

    #[error("Invalid vault format")]
    InvalidFormat,

    #[error("Vault already exists")]
    AlreadyExists,

    #[error("Session expired or invalid")]
    InvalidSession,

    #[error("Rate limit exceeded")]
    RateLimitExceeded,

    #[error("Vault is locked")]
    VaultLocked,

    #[error("Invalid vault password")]
    InvalidPassword,

    #[error("Vault setup incomplete")]
    SetupIncomplete,
}

#[derive(Error, Debug)]
pub enum NoteOperationError {
    #[error("Note not found: {id}")]
    NoteNotFound { id: String },

    #[error("Invalid note format")]
    InvalidFormat,

    #[error("Note content too large")]
    ContentTooLarge,

    #[error("Concurrent modification detected")]
    ConcurrentModification,

    #[error("Invalid note ID")]
    InvalidId,

    #[error("Note creation failed")]
    CreationFailed,

    #[error("Note save failed")]
    SaveFailed,
}

#[derive(Error, Debug)]
pub enum FolderOperationError {
    #[error("Folder not found: {path}")]
    FolderNotFound { path: String },

    #[error("Folder already exists: {path}")]
    FolderExists { path: String },

    #[error("Folder not empty")]
    FolderNotEmpty,

    #[error("Invalid folder name")]
    InvalidName,

    #[error("Folder creation failed")]
    CreationFailed,

    #[error("Folder deletion failed")]
    DeletionFailed,

    #[error("Folder move failed")]
    MoveFailed,

    #[error("Folder rename failed")]
    RenameFailed,
}

#[derive(Error, Debug)]
pub enum AuthenticationError {
    #[error("Invalid credentials")]
    InvalidCredentials,

    #[error("Session expired")]
    SessionExpired,

    #[error("Session not found")]
    SessionNotFound,

    #[error("Authentication required")]
    AuthenticationRequired,

    #[error("Password verification failed")]
    PasswordVerificationFailed,

    #[error("Rate limit exceeded for authentication attempts")]
    RateLimitExceeded,
}

#[derive(Error, Debug)]
pub enum ValidationError {
    #[error("Invalid input: {field}")]
    InvalidInput { field: String },

    #[error("Missing required field: {field}")]
    MissingField { field: String },

    #[error("Invalid path: {path}")]
    InvalidPath { path: String },

    #[error("Invalid file name: {name}")]
    InvalidFileName { name: String },

    #[error("Password too weak")]
    WeakPassword,

    #[error("Invalid vault name")]
    InvalidVaultName,

    #[error("Invalid session ID")]
    InvalidSessionId,
}
