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
    #[error("Note not found: {0}")]
    NoteNotFound(String),
    #[error("Invalid note title: {0}")]
    InvalidNoteTitle(String),
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

/// Individual note data
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Note {
    pub id: String,
    pub title: String,
    pub content: String,
    #[serde(default = "default_note_type")]
    pub note_type: String, // "text" or "whiteboard"
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
    pub tags: Vec<String>,
    pub folder_path: Option<String>,
}

impl Note {
    pub fn new(title: String, content: Option<String>) -> Self {
        let now = chrono::Utc::now();
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            title,
            content: content.unwrap_or_default(),
            note_type: "text".to_string(),
            created_at: now,
            updated_at: now,
            tags: Vec::new(),
            folder_path: None,
        }
    }

    pub fn new_with_type(title: String, content: Option<String>, note_type: String) -> Self {
        let now = chrono::Utc::now();
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            title,
            content: content.unwrap_or_default(),
            note_type,
            created_at: now,
            updated_at: now,
            tags: Vec::new(),
            folder_path: None,
        }
    }

    pub fn with_tags(mut self, tags: Vec<String>) -> Self {
        self.tags = tags;
        self
    }

    pub fn with_folder(mut self, folder_path: Option<String>) -> Self {
        self.folder_path = folder_path;
        self
    }
}

/// Note metadata for the index
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct NoteMetadata {
    pub id: String,
    pub title: String,
    #[serde(default = "default_note_type")]
    pub note_type: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
    pub tags: Vec<String>,
    pub folder_path: Option<String>,
    pub content_preview: String,
}

fn default_note_type() -> String {
    "text".to_string()
}

impl From<&Note> for NoteMetadata {
    fn from(note: &Note) -> Self {
        let content_preview = if note.content.len() > 100 {
            format!("{}...", &note.content[..97])
        } else {
            note.content.clone()
        };

        Self {
            id: note.id.clone(),
            title: note.title.clone(),
            note_type: note.note_type.clone(),
            created_at: note.created_at,
            updated_at: note.updated_at,
            tags: note.tags.clone(),
            folder_path: note.folder_path.clone(),
            content_preview,
        }
    }
}

/// Folder metadata for virtual folders
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct FolderMetadata {
    pub path: String,
    pub name: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

impl FolderMetadata {
    pub fn new(path: String) -> Self {
        let name = path.split('/').last().unwrap_or(&path).to_string();
        Self {
            path,
            name,
            created_at: chrono::Utc::now(),
        }
    }
}

/// Notes index containing metadata for all notes and folders
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct NotesIndex {
    pub notes: Vec<NoteMetadata>,
    #[serde(default)]
    pub folders: Vec<FolderMetadata>,
    pub last_updated: chrono::DateTime<chrono::Utc>,
}

impl NotesIndex {
    pub fn new() -> Self {
        Self {
            notes: Vec::new(),
            folders: Vec::new(),
            last_updated: chrono::Utc::now(),
        }
    }

    pub fn add_note(&mut self, note: &Note) {
        let metadata = NoteMetadata::from(note);
        self.notes.push(metadata);
        self.last_updated = chrono::Utc::now();
    }

    pub fn update_note(&mut self, note: &Note) {
        if let Some(existing) = self.notes.iter_mut().find(|n| n.id == note.id) {
            *existing = NoteMetadata::from(note);
            self.last_updated = chrono::Utc::now();
        }
    }

    pub fn remove_note(&mut self, note_id: &str) {
        self.notes.retain(|n| n.id != note_id);
        self.last_updated = chrono::Utc::now();
    }

    pub fn add_folder(&mut self, folder_path: String) -> Result<(), String> {
        // Validate folder path
        if folder_path.is_empty() {
            return Err("Folder path cannot be empty".to_string());
        }

        // Check if folder already exists
        if self.folders.iter().any(|f| f.path == folder_path) {
            return Err("Folder already exists".to_string());
        }

        // Ensure parent folders exist
        let parts: Vec<&str> = folder_path.split('/').collect();
        for i in 1..parts.len() {
            let parent_path = parts[0..i].join("/");
            if !self.folders.iter().any(|f| f.path == parent_path) {
                self.folders.push(FolderMetadata::new(parent_path));
            }
        }

        // Add the new folder
        self.folders.push(FolderMetadata::new(folder_path));
        self.last_updated = chrono::Utc::now();
        Ok(())
    }

    pub fn remove_folder(&mut self, folder_path: &str) -> Result<(), String> {
        // Check if any notes are in this folder or subfolders
        let has_notes = self.notes.iter().any(|note| {
            note.folder_path.as_ref()
                .map(|path| path == folder_path || path.starts_with(&format!("{}/", folder_path)))
                .unwrap_or(false)
        });

        if has_notes {
            return Err("Cannot delete folder that contains notes".to_string());
        }

        // Remove folder and all subfolders
        self.folders.retain(|f| {
            f.path != folder_path && !f.path.starts_with(&format!("{}/", folder_path))
        });

        self.last_updated = chrono::Utc::now();
        Ok(())
    }

    pub fn move_note(&mut self, note_id: &str, new_folder_path: Option<String>) -> Result<(), String> {
        // Find the note and update its folder path
        if let Some(note) = self.notes.iter_mut().find(|n| n.id == note_id) {
            note.folder_path = new_folder_path;
            note.updated_at = chrono::Utc::now();
            self.last_updated = chrono::Utc::now();
            Ok(())
        } else {
            Err(format!("Note with ID {} not found", note_id))
        }
    }

    pub fn move_folder(&mut self, old_path: &str, new_path: &str) -> Result<(), String> {
        // Check if new path already exists
        if self.folders.iter().any(|f| f.path == new_path) {
            return Err("Destination folder already exists".to_string());
        }

        // Check if old path exists
        if !self.folders.iter().any(|f| f.path == old_path) {
            return Err("Source folder does not exist".to_string());
        }

        // Update folder paths
        for folder in &mut self.folders {
            if folder.path == old_path {
                folder.path = new_path.to_string();
                folder.name = new_path.split('/').last().unwrap_or(new_path).to_string();
            } else if folder.path.starts_with(&format!("{}/", old_path)) {
                folder.path = folder.path.replace(&format!("{}/", old_path), &format!("{}/", new_path));
            }
        }

        // Update note folder paths
        for note in &mut self.notes {
            if let Some(ref folder_path) = note.folder_path {
                if folder_path == old_path {
                    note.folder_path = Some(new_path.to_string());
                    note.updated_at = chrono::Utc::now();
                } else if folder_path.starts_with(&format!("{}/", old_path)) {
                    note.folder_path = Some(folder_path.replace(&format!("{}/", old_path), &format!("{}/", new_path)));
                    note.updated_at = chrono::Utc::now();
                }
            }
        }

        self.last_updated = chrono::Utc::now();
        Ok(())
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
            if session.is_expired(Duration::from_secs(30 * 60)) {
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


    /// Create a new note in the vault
    pub fn create_note(&self, session_id: &str, title: Option<String>, content: Option<String>, tags: Option<Vec<String>>, folder_path: Option<String>, note_type: Option<String>) -> Result<Note, VaultError> {
        // Validate title if provided
        let title = if let Some(title) = title {
            let trimmed = title.trim().to_string();
            if trimmed.is_empty() {
                "Untitled".to_string()
            } else if trimmed.len() > 200 {
                return Err(VaultError::InvalidNoteTitle("Title cannot exceed 200 characters".to_string()));
            } else {
                trimmed
            }
        } else {
            "Untitled".to_string()
        };

        // Validate note type
        let note_type = note_type.unwrap_or_else(|| "text".to_string());
        if !["text", "whiteboard"].contains(&note_type.as_str()) {
            return Err(VaultError::InvalidNoteTitle("Invalid note type".to_string()));
        }

        // Get session to ensure vault is unlocked
        let session = Self::get_session(session_id)
            .ok_or_else(|| VaultError::InvalidPassword)?; // Session expired or invalid

        // Create note with type
        let mut note = Note::new_with_type(title, content, note_type);
        if let Some(tags) = tags {
            note = note.with_tags(tags);
        }
        if let Some(folder_path) = folder_path {
            note = note.with_folder(Some(folder_path));
        }

        // Encrypt and save note
        let note_content = serde_json::to_string_pretty(&note)?;
        let (encrypted_content, nonce) = self.crypto_manager.encrypt_data(
            note_content.as_bytes(),
            &session.encryption_key
        )?;

        // Save encrypted note file
        let note_filename = format!("{}.note", note.id);
        let note_file_path = self.vault_path.join("notes").join(&note_filename);
        
        // Create note file with metadata
        let note_file_data = serde_json::json!({
            "nonce": base64::encode(&nonce),
            "encrypted_content": base64::encode(&encrypted_content),
            "created_at": note.created_at,
            "updated_at": note.updated_at
        });
        
        std::fs::write(&note_file_path, serde_json::to_string_pretty(&note_file_data)?)?;

        // Update notes index
        self.update_notes_index(&session.encryption_key, |index| {
            index.add_note(&note);
        })?;

        Ok(note)
    }

    /// Load notes index from vault
    pub fn load_notes_index(&self, encryption_key: &EncryptionKey) -> Result<NotesIndex, VaultError> {
        let index_file = self.vault_path.join(".cocobolo_notes_index");
        
        if !index_file.exists() {
            // Create new index if it doesn't exist
            let index = NotesIndex::new();
            self.save_notes_index(&index, encryption_key)?;
            return Ok(index);
        }

        // Read and decrypt index
        let index_content = std::fs::read_to_string(&index_file)?;
        
        let index_data: serde_json::Value = serde_json::from_str(&index_content)?;

        let nonce_b64 = index_data["nonce"].as_str()
            .ok_or_else(|| VaultError::VaultCorrupted)?;
        let encrypted_content_b64 = index_data["encrypted_content"].as_str()
            .ok_or_else(|| VaultError::VaultCorrupted)?;

        let nonce = base64::decode(nonce_b64)
            .map_err(|_| VaultError::VaultCorrupted)?;
        let encrypted_content = base64::decode(encrypted_content_b64)
            .map_err(|_| VaultError::VaultCorrupted)?;

        let decrypted_content = self.crypto_manager.decrypt_data(
            &encrypted_content,
            &nonce,
            encryption_key
        )?;

        let index: NotesIndex = serde_json::from_slice(&decrypted_content)?;
        
        Ok(index)
    }

    /// Save notes index to vault
    fn save_notes_index(&self, index: &NotesIndex, encryption_key: &EncryptionKey) -> Result<(), VaultError> {
        let index_content = serde_json::to_string_pretty(index)?;
        let (encrypted_content, nonce) = self.crypto_manager.encrypt_data(
            index_content.as_bytes(),
            encryption_key
        )?;

        let index_file_data = serde_json::json!({
            "nonce": base64::encode(&nonce),
            "encrypted_content": base64::encode(&encrypted_content),
            "last_updated": index.last_updated
        });

        let index_file = self.vault_path.join(".cocobolo_notes_index");
        std::fs::write(&index_file, serde_json::to_string_pretty(&index_file_data)?)?;

        Ok(())
    }

    /// Update notes index with a closure
    fn update_notes_index<F>(&self, encryption_key: &EncryptionKey, update_fn: F) -> Result<(), VaultError>
    where
        F: FnOnce(&mut NotesIndex),
    {
        let mut index = self.load_notes_index(encryption_key)?;
        update_fn(&mut index);
        self.save_notes_index(&index, encryption_key)?;
        Ok(())
    }

    /// Get all notes metadata
    pub fn get_notes_list(&self, session_id: &str) -> Result<Vec<NoteMetadata>, VaultError> {
        let session = Self::get_session(session_id)
            .ok_or_else(|| VaultError::InvalidPassword)?;
        
        let index = self.load_notes_index(&session.encryption_key)?;
        Ok(index.notes)
    }

    /// Get all folder paths
    pub fn get_folders_list(&self, session_id: &str) -> Result<Vec<String>, VaultError> {
        let session = Self::get_session(session_id)
            .ok_or_else(|| VaultError::InvalidPassword)?;

        let index = self.load_notes_index(&session.encryption_key)?;
        let folders: Vec<String> = index.folders.iter().map(|f| f.path.clone()).collect();
        Ok(folders)
    }

    /// Load a specific note by ID
    pub fn load_note(&self, session_id: &str, note_id: &str) -> Result<Note, VaultError> {
        let session = Self::get_session(session_id)
            .ok_or_else(|| VaultError::InvalidPassword)?;

        let note_filename = format!("{}.note", note_id);
        let note_file_path = self.vault_path.join("notes").join(&note_filename);

        if !note_file_path.exists() {
            return Err(VaultError::NoteNotFound(note_id.to_string()));
        }

        // Read and decrypt note
        let note_data: serde_json::Value = serde_json::from_str(
            &std::fs::read_to_string(&note_file_path)?
        )?;

        let nonce_b64 = note_data["nonce"].as_str()
            .ok_or_else(|| VaultError::VaultCorrupted)?;
        let encrypted_content_b64 = note_data["encrypted_content"].as_str()
            .ok_or_else(|| VaultError::VaultCorrupted)?;

        let nonce = base64::decode(nonce_b64)
            .map_err(|_| VaultError::VaultCorrupted)?;
        let encrypted_content = base64::decode(encrypted_content_b64)
            .map_err(|_| VaultError::VaultCorrupted)?;

        let decrypted_content = self.crypto_manager.decrypt_data(
            &encrypted_content,
            &nonce,
            &session.encryption_key
        )?;

        let note: Note = serde_json::from_slice(&decrypted_content)?;
        Ok(note)
    }

    /// Save changes to an existing note
    pub fn create_folder(&self, session_id: &str, folder_path: String) -> Result<(), VaultError> {
        // Get session and encryption key
        let session = Self::get_session(session_id)
            .ok_or(VaultError::InvalidPassword)?;

        // Update the notes index to add the folder
        self.update_notes_index(&session.encryption_key, |index| {
            let _ = index.add_folder(folder_path.clone());
        })?;

        Ok(())
    }

    pub fn save_note(
        &self, 
        session_id: &str, 
        note_id: &str, 
        title: Option<String>, 
        content: Option<String>, 
        tags: Option<Vec<String>>, 
        folder_path: Option<String>
    ) -> Result<Note, VaultError> {
        let session = Self::get_session(session_id)
            .ok_or_else(|| VaultError::InvalidPassword)?;

        // Load existing note
        let mut note = self.load_note(session_id, note_id)?;

        // Update fields if provided
        if let Some(title) = title {
            let title = title.trim().to_string();
            if title.is_empty() {
                return Err(VaultError::InvalidNoteTitle("Title cannot be empty".to_string()));
            }
            if title.len() > 200 {
                return Err(VaultError::InvalidNoteTitle("Title cannot exceed 200 characters".to_string()));
            }
            note.title = title;
        }

        if let Some(content) = content {
            note.content = content;
        }

        if let Some(tags) = tags {
            note.tags = tags;
        }

        if let Some(folder_path) = folder_path {
            note.folder_path = Some(folder_path);
        }

        // Update timestamp
        note.updated_at = chrono::Utc::now();

        // Encrypt and save note
        let note_content = serde_json::to_string_pretty(&note)?;
        let (encrypted_content, nonce) = self.crypto_manager.encrypt_data(
            note_content.as_bytes(),
            &session.encryption_key
        )?;

        // Save encrypted note file
        let note_filename = format!("{}.note", note.id);
        let note_file_path = self.vault_path.join("notes").join(&note_filename);
        
        // Create note file with metadata
        let note_file_data = serde_json::json!({
            "nonce": base64::encode(&nonce),
            "encrypted_content": base64::encode(&encrypted_content),
            "created_at": note.created_at,
            "updated_at": note.updated_at
        });
        
        std::fs::write(&note_file_path, serde_json::to_string_pretty(&note_file_data)?)?;

        // Update notes index
        self.update_notes_index(&session.encryption_key, |index| {
            index.update_note(&note);
        })?;

        Ok(note)
    }

    /// Delete a note from the vault
    pub fn delete_note(&self, session_id: &str, note_id: &str) -> Result<(), VaultError> {
        let session = Self::get_session(session_id)
            .ok_or_else(|| VaultError::InvalidPassword)?;

        // Remove the note file
        let note_filename = format!("{}.note", note_id);
        let note_file_path = self.vault_path.join("notes").join(&note_filename);

        if note_file_path.exists() {
            std::fs::remove_file(&note_file_path)?;
        }

        // Update notes index to remove the note
        self.update_notes_index(&session.encryption_key, |index| {
            index.remove_note(note_id);
        })?;

        Ok(())
    }

    /// Delete a folder from the vault
    pub fn delete_folder(&self, session_id: &str, folder_path: &str) -> Result<(), VaultError> {
        let session = Self::get_session(session_id)
            .ok_or_else(|| VaultError::InvalidPassword)?;

        // Update notes index to remove the folder
        self.update_notes_index(&session.encryption_key, |index| {
            let _ = index.remove_folder(folder_path);
        })?;

        Ok(())
    }

    /// Move a note to a different folder
    pub fn move_note(&self, session_id: &str, note_id: &str, new_folder_path: Option<String>) -> Result<(), VaultError> {
        let session = Self::get_session(session_id)
            .ok_or_else(|| VaultError::InvalidPassword)?;

        // Update notes index to move the note
        self.update_notes_index(&session.encryption_key, |index| {
            let _ = index.move_note(note_id, new_folder_path.clone());
        })?;

        // Load the note and update its folder path directly
        let mut note = self.load_note(session_id, note_id)?;
        note.folder_path = new_folder_path;
        note.updated_at = chrono::Utc::now();

        // Encrypt and save the updated note
        let session = Self::get_session(session_id)
            .ok_or_else(|| VaultError::InvalidPassword)?;
            
        let note_content = serde_json::to_string_pretty(&note)?;
        let (encrypted_content, nonce) = self.crypto_manager.encrypt_data(
            note_content.as_bytes(),
            &session.encryption_key
        )?;

        // Save encrypted note file
        let note_filename = format!("{}.note", note.id);
        let note_file_path = self.vault_path.join("notes").join(&note_filename);
        
        let note_file_data = serde_json::json!({
            "nonce": base64::encode(&nonce),
            "encrypted_content": base64::encode(&encrypted_content),
            "created_at": note.created_at,
            "updated_at": note.updated_at
        });
        
        std::fs::write(&note_file_path, serde_json::to_string_pretty(&note_file_data)?)?;

        // Update notes index with the updated note
        self.update_notes_index(&session.encryption_key, |index| {
            index.update_note(&note);
        })?;

        Ok(())
    }

    /// Move a folder to a different location
    pub fn move_folder(&self, session_id: &str, old_path: &str, new_path: &str) -> Result<(), VaultError> {
        let session = Self::get_session(session_id)
            .ok_or_else(|| VaultError::InvalidPassword)?;

        // Update notes index to move the folder
        self.update_notes_index(&session.encryption_key, |index| {
            let _ = index.move_folder(old_path, new_path);
        })?;

        Ok(())
    }
}

mod base64 {
    use base64::{engine::general_purpose, Engine as _};

    pub fn encode<T: AsRef<[u8]>>(input: T) -> String {
        general_purpose::STANDARD.encode(input)
    }

    pub fn decode<T: AsRef<[u8]>>(input: T) -> Result<Vec<u8>, base64::DecodeError> {
        general_purpose::STANDARD.decode(input)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;
    use serial_test::serial;

    use std::time::Duration;
    use crate::crypto::SecurePassword;

    // Helper function to create a temporary vault directory
    fn setup_temp_vault() -> TempDir {
        TempDir::new().unwrap()
    }

    // Helper function to create a test vault manager
    fn create_test_vault_manager(temp_dir: &TempDir) -> VaultManager {
        VaultManager::new(temp_dir.path())
    }

    // Helper function to create a test password
    fn create_test_password() -> SecurePassword {
        SecurePassword::new("TestPassword123!@#".to_string())
    }

    #[test]
    fn test_vault_info_creation() {
        let info = VaultInfo::new("Test Vault".to_string());
        
        assert_eq!(info.name, "Test Vault");
        assert_eq!(info.version, "1.0.0");
        assert!(!info.is_encrypted);
        assert!(info.crypto.is_none());
        assert!(info.created_at <= chrono::Utc::now());
    }

    #[test]
    fn test_vault_info_encrypted_creation() {
        let crypto_manager = CryptoManager::new();
        let password = create_test_password();
        let vault_crypto = crypto_manager.create_vault_crypto(&password).unwrap();
        
        let info = VaultInfo::new_encrypted("Test Vault".to_string(), vault_crypto);
        
        assert_eq!(info.name, "Test Vault");
        assert_eq!(info.version, "1.0.0");
        assert!(info.is_encrypted);
        assert!(info.crypto.is_some());
    }

    #[test]
    fn test_note_creation() {
        let note = Note::new("Test Note".to_string(), Some("Test content".to_string()));
        
        assert_eq!(note.title, "Test Note");
        assert_eq!(note.content, "Test content");
        assert_eq!(note.note_type, "text");
        assert!(!note.id.is_empty());
        assert!(note.tags.is_empty());
        assert!(note.folder_path.is_none());
        assert!(note.created_at <= chrono::Utc::now());
        assert!(note.updated_at <= chrono::Utc::now());
    }

    #[test]
    fn test_note_creation_with_type() {
        let note = Note::new_with_type(
            "Whiteboard Note".to_string(),
            Some("{}".to_string()),
            "whiteboard".to_string()
        );
        
        assert_eq!(note.title, "Whiteboard Note");
        assert_eq!(note.content, "{}");
        assert_eq!(note.note_type, "whiteboard");
    }

    #[test]
    fn test_note_with_tags_and_folder() {
        let note = Note::new("Test".to_string(), None)
            .with_tags(vec!["tag1".to_string(), "tag2".to_string()])
            .with_folder(Some("folder1".to_string()));
        
        assert_eq!(note.tags, vec!["tag1", "tag2"]);
        assert_eq!(note.folder_path, Some("folder1".to_string()));
    }

    #[test]
    fn test_note_metadata_from_note() {
        let note = Note::new("Test Note".to_string(), Some("A".repeat(200)));
        let metadata = NoteMetadata::from(&note);
        
        assert_eq!(metadata.id, note.id);
        assert_eq!(metadata.title, note.title);
        assert_eq!(metadata.note_type, note.note_type);
        assert_eq!(metadata.created_at, note.created_at);
        assert_eq!(metadata.updated_at, note.updated_at);
        assert_eq!(metadata.tags, note.tags);
        assert_eq!(metadata.folder_path, note.folder_path);
        assert!(metadata.content_preview.len() <= 100);
        assert!(metadata.content_preview.ends_with("..."));
    }

    #[test]
    fn test_note_metadata_short_content() {
        let note = Note::new("Test Note".to_string(), Some("Short content".to_string()));
        let metadata = NoteMetadata::from(&note);
        
        assert_eq!(metadata.content_preview, "Short content");
        assert!(!metadata.content_preview.ends_with("..."));
    }

    #[test]
    fn test_folder_metadata_creation() {
        let folder = FolderMetadata::new("folder1/subfolder".to_string());
        
        assert_eq!(folder.path, "folder1/subfolder");
        assert_eq!(folder.name, "subfolder");
        assert!(folder.created_at <= chrono::Utc::now());
    }

    #[test]
    fn test_folder_metadata_root_folder() {
        let folder = FolderMetadata::new("root".to_string());
        
        assert_eq!(folder.path, "root");
        assert_eq!(folder.name, "root");
    }

    #[test]
    fn test_notes_index_creation() {
        let index = NotesIndex::new();
        
        assert!(index.notes.is_empty());
        assert!(index.folders.is_empty());
        assert!(index.last_updated <= chrono::Utc::now());
    }

    #[test]
    fn test_notes_index_add_note() {
        let mut index = NotesIndex::new();
        let note = Note::new("Test".to_string(), None);
        
        index.add_note(&note);
        
        assert_eq!(index.notes.len(), 1);
        assert_eq!(index.notes[0].id, note.id);
        assert_eq!(index.notes[0].title, note.title);
    }

    #[test]
    fn test_notes_index_update_note() {
        let mut index = NotesIndex::new();
        let mut note = Note::new("Test".to_string(), None);
        
        index.add_note(&note);
        
        note.title = "Updated Title".to_string();
        note.updated_at = chrono::Utc::now();
        
        index.update_note(&note);
        
        assert_eq!(index.notes.len(), 1);
        assert_eq!(index.notes[0].title, "Updated Title");
    }

    #[test]
    fn test_notes_index_remove_note() {
        let mut index = NotesIndex::new();
        let note = Note::new("Test".to_string(), None);
        let note_id = note.id.clone();
        
        index.add_note(&note);
        assert_eq!(index.notes.len(), 1);
        
        index.remove_note(&note_id);
        assert_eq!(index.notes.len(), 0);
    }

    #[test]
    fn test_notes_index_add_folder() {
        let mut index = NotesIndex::new();
        
        let result = index.add_folder("test_folder".to_string());
        assert!(result.is_ok());
        assert_eq!(index.folders.len(), 1);
        assert_eq!(index.folders[0].path, "test_folder");
        assert_eq!(index.folders[0].name, "test_folder");
    }

    #[test]
    fn test_notes_index_add_duplicate_folder() {
        let mut index = NotesIndex::new();
        
        index.add_folder("test_folder".to_string()).unwrap();
        let result = index.add_folder("test_folder".to_string());
        
        assert!(result.is_err());
        assert_eq!(index.folders.len(), 1);
    }

    #[test]
    fn test_notes_index_remove_folder() {
        let mut index = NotesIndex::new();
        
        index.add_folder("test_folder".to_string()).unwrap();
        assert_eq!(index.folders.len(), 1);
        
        let result = index.remove_folder("test_folder");
        assert!(result.is_ok());
        assert_eq!(index.folders.len(), 0);
    }

    #[test]
    fn test_notes_index_remove_folder_with_notes() {
        let mut index = NotesIndex::new();
        let note = Note::new("Test".to_string(), None)
            .with_folder(Some("test_folder".to_string()));
        
        index.add_folder("test_folder".to_string()).unwrap();
        index.add_note(&note);
        
        let result = index.remove_folder("test_folder");
        assert!(result.is_err());
        assert_eq!(index.folders.len(), 1);
    }

    #[test]
    fn test_notes_index_move_note() {
        let mut index = NotesIndex::new();
        let note = Note::new("Test".to_string(), None);
        let note_id = note.id.clone();
        
        index.add_note(&note);
        
        let result = index.move_note(&note_id, Some("new_folder".to_string()));
        assert!(result.is_ok());
        assert_eq!(index.notes[0].folder_path, Some("new_folder".to_string()));
    }

    #[test]
    fn test_notes_index_move_folder() {
        let mut index = NotesIndex::new();
        let note = Note::new("Test".to_string(), None)
            .with_folder(Some("old_folder".to_string()));
        
        index.add_folder("old_folder".to_string()).unwrap();
        index.add_note(&note);
        
        let result = index.move_folder("old_folder", "new_folder");
        assert!(result.is_ok());
        assert_eq!(index.folders[0].path, "new_folder");
        assert_eq!(index.notes[0].folder_path, Some("new_folder".to_string()));
    }

    #[test]
    fn test_rate_limit_state() {
        let mut state = RateLimitState::new();
        
        assert!(!state.is_locked());
        assert!(state.time_until_unlock().is_none());
        
        // Record failed attempts
        for _ in 0..5 {
            state.record_failed_attempt();
        }
        
        assert!(state.is_locked());
        assert!(state.time_until_unlock().is_some());
        
        state.reset();
        assert!(!state.is_locked());
        assert!(state.time_until_unlock().is_none());
    }

    #[test]
    fn test_vault_session_creation() {
        let vault_info = VaultInfo::new("Test".to_string());
        let key = EncryptionKey::from_bytes([42u8; 32]);
        
        let session = VaultSession::new(vault_info.clone(), key);
        
        assert_eq!(session.vault_info.name, vault_info.name);
        assert!(!session.is_expired(Duration::from_secs(3600)));
    }

    #[test]
    fn test_vault_session_expiry() {
        let vault_info = VaultInfo::new("Test".to_string());
        let key = EncryptionKey::from_bytes([42u8; 32]);
        
        let mut session = VaultSession::new(vault_info, key);
        
        // Manually set creation time to past
        session.created_at = Instant::now() - Duration::from_secs(7200);
        session.last_accessed = Instant::now() - Duration::from_secs(7200);
        
        assert!(session.is_expired(Duration::from_secs(3600)));
    }

    #[test]
    fn test_vault_manager_creation() {
        let temp_dir = setup_temp_vault();
        let manager = create_test_vault_manager(&temp_dir);
        
        assert_eq!(manager.vault_path(), temp_dir.path());
        assert!(!manager.vault_exists());
    }

    #[test]
    fn test_vault_manager_initialize_vault() {
        let temp_dir = setup_temp_vault();
        let manager = create_test_vault_manager(&temp_dir);
        
        let vault_info = manager.initialize_vault("Test Vault".to_string()).unwrap();
        
        assert_eq!(vault_info.name, "Test Vault");
        assert!(!vault_info.is_encrypted);
        assert!(manager.vault_exists());
        
        // Verify vault structure
        assert!(temp_dir.path().join(".cocobolo_vault").exists());
        assert!(temp_dir.path().join("notes").exists());
        // Note: .cocobolo_settings is only created for encrypted vaults
    }

    #[test]
    fn test_vault_manager_initialize_encrypted_vault() {
        let temp_dir = setup_temp_vault();
        let manager = create_test_vault_manager(&temp_dir);
        let password = create_test_password();
        
        let vault_info = manager.initialize_encrypted_vault("Test Vault".to_string(), &password).unwrap();
        
        assert_eq!(vault_info.name, "Test Vault");
        assert!(vault_info.is_encrypted);
        assert!(vault_info.crypto.is_some());
        assert!(manager.vault_exists());
    }

    #[test]
    fn test_vault_manager_initialize_existing_vault() {
        let temp_dir = setup_temp_vault();
        let manager = create_test_vault_manager(&temp_dir);
        
        manager.initialize_vault("Test Vault".to_string()).unwrap();
        
        let result = manager.initialize_vault("Another Vault".to_string());
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), VaultError::VaultExists(_)));
    }

    #[test]
    fn test_vault_manager_load_vault_info() {
        let temp_dir = setup_temp_vault();
        let manager = create_test_vault_manager(&temp_dir);
        
        let original_info = manager.initialize_vault("Test Vault".to_string()).unwrap();
        let loaded_info = manager.load_vault_info().unwrap();
        
        assert_eq!(loaded_info.name, original_info.name);
        assert_eq!(loaded_info.version, original_info.version);
        assert_eq!(loaded_info.is_encrypted, original_info.is_encrypted);
    }

    #[test]
    fn test_vault_manager_load_vault_info_not_found() {
        let temp_dir = setup_temp_vault();
        let manager = create_test_vault_manager(&temp_dir);
        
        let result = manager.load_vault_info();
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), VaultError::VaultNotFound(_)));
    }

    #[test]
    #[serial]
    fn test_vault_manager_unlock_vault() {
        let temp_dir = setup_temp_vault();
        let manager = create_test_vault_manager(&temp_dir);
        let password = create_test_password();
        
        manager.initialize_encrypted_vault("Test Vault".to_string(), &password).unwrap();
        
        let session_id = manager.unlock_vault(&password).unwrap();
        assert!(!session_id.is_empty());
        
        // Verify session exists
        let session = VaultManager::get_session(&session_id);
        assert!(session.is_some());
        
        // Close session
        assert!(VaultManager::close_session(&session_id));
        
        // Verify session is closed
        let session = VaultManager::get_session(&session_id);
        assert!(session.is_none());
    }

    #[test]
    #[serial]
    fn test_vault_manager_unlock_vault_wrong_password() {
        let temp_dir = setup_temp_vault();
        let manager = create_test_vault_manager(&temp_dir);
        let correct_password = create_test_password();
        let wrong_password = SecurePassword::new("WrongPassword123!@#".to_string());
        
        manager.initialize_encrypted_vault("Test Vault".to_string(), &correct_password).unwrap();
        
        let result = manager.unlock_vault(&wrong_password);
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), VaultError::InvalidPassword));
    }

    #[test]
    #[serial]
    fn test_vault_manager_rate_limiting() {
        let temp_dir = setup_temp_vault();
        let manager = create_test_vault_manager(&temp_dir);
        let correct_password = create_test_password();
        let wrong_password = SecurePassword::new("WrongPassword123!@#".to_string());
        
        manager.initialize_encrypted_vault("Test Vault".to_string(), &correct_password).unwrap();
        
        // Make multiple failed attempts
        for _ in 0..5 {
            let _ = manager.unlock_vault(&wrong_password);
        }
        
        let (is_rate_limited, seconds_remaining) = manager.get_rate_limit_status();
        assert!(is_rate_limited);
        assert!(seconds_remaining.is_some());
        assert!(seconds_remaining.unwrap() > 0);
    }

    #[test]
    #[serial]
    fn test_vault_manager_verify_password() {
        let temp_dir = setup_temp_vault();
        let manager = create_test_vault_manager(&temp_dir);
        let password = create_test_password();
        
        manager.initialize_encrypted_vault("Test Vault".to_string(), &password).unwrap();
        
        assert!(manager.verify_vault_password(&password).unwrap());
        
        let wrong_password = SecurePassword::new("WrongPassword123!@#".to_string());
        assert!(!manager.verify_vault_password(&wrong_password).unwrap());
    }

    #[test]
    #[serial]
    fn test_vault_manager_create_note() {
        let temp_dir = setup_temp_vault();
        let manager = create_test_vault_manager(&temp_dir);
        let password = create_test_password();
        
        manager.initialize_encrypted_vault("Test Vault".to_string(), &password).unwrap();
        let session_id = manager.unlock_vault(&password).unwrap();
        
        let note = manager.create_note(
            &session_id,
            Some("Test Note".to_string()),
            Some("Test content".to_string()),
            Some(vec!["tag1".to_string()]),
            Some("folder1".to_string()),
            None
        ).unwrap();
        
        assert_eq!(note.title, "Test Note");
        assert_eq!(note.content, "Test content");
        assert_eq!(note.tags, vec!["tag1"]);
        assert_eq!(note.folder_path, Some("folder1".to_string()));
        assert_eq!(note.note_type, "text");
        
        VaultManager::close_session(&session_id);
    }

    #[test]
    #[serial]
    fn test_vault_manager_create_note_invalid_session() {
        let temp_dir = setup_temp_vault();
        let manager = create_test_vault_manager(&temp_dir);
        
        let result = manager.create_note(
            "invalid_session",
            Some("Test".to_string()),
            None,
            None,
            None,
            None
        );
        
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), VaultError::InvalidPassword));
    }

    #[test]
    #[serial]
    fn test_vault_manager_load_and_save_note() {
        let temp_dir = setup_temp_vault();
        let manager = create_test_vault_manager(&temp_dir);
        let password = create_test_password();
        
        manager.initialize_encrypted_vault("Test Vault".to_string(), &password).unwrap();
        let session_id = manager.unlock_vault(&password).unwrap();
        
        // Create note
        let note = manager.create_note(
            &session_id,
            Some("Test Note".to_string()),
            Some("Original content".to_string()),
            None,
            None,
            None
        ).unwrap();
        
        // Load note
        let loaded_note = manager.load_note(&session_id, &note.id).unwrap();
        assert_eq!(loaded_note.title, "Test Note");
        assert_eq!(loaded_note.content, "Original content");
        
        // Save note with changes
        let updated_note = manager.save_note(
            &session_id,
            &note.id,
            Some("Updated Title".to_string()),
            Some("Updated content".to_string()),
            Some(vec!["new_tag".to_string()]),
            Some("new_folder".to_string())
        ).unwrap();
        
        assert_eq!(updated_note.title, "Updated Title");
        assert_eq!(updated_note.content, "Updated content");
        assert_eq!(updated_note.tags, vec!["new_tag"]);
        assert_eq!(updated_note.folder_path, Some("new_folder".to_string()));
        
        VaultManager::close_session(&session_id);
    }

    #[test]
    #[serial]
    fn test_vault_manager_get_notes_list() {
        let temp_dir = setup_temp_vault();
        let manager = create_test_vault_manager(&temp_dir);
        let password = create_test_password();
        
        manager.initialize_encrypted_vault("Test Vault".to_string(), &password).unwrap();
        let session_id = manager.unlock_vault(&password).unwrap();
        
        // Create multiple notes
        let note1 = manager.create_note(
            &session_id,
            Some("Note 1".to_string()),
            Some("Content 1".to_string()),
            None,
            None,
            None
        ).unwrap();
        
        let note2 = manager.create_note(
            &session_id,
            Some("Note 2".to_string()),
            Some("Content 2".to_string()),
            None,
            Some("folder1".to_string()),
            None
        ).unwrap();
        
        let notes_list = manager.get_notes_list(&session_id).unwrap();
        assert_eq!(notes_list.len(), 2);
        
        let note1_meta = notes_list.iter().find(|n| n.id == note1.id).unwrap();
        let note2_meta = notes_list.iter().find(|n| n.id == note2.id).unwrap();
        
        assert_eq!(note1_meta.title, "Note 1");
        assert_eq!(note1_meta.folder_path, None);
        assert_eq!(note2_meta.title, "Note 2");
        assert_eq!(note2_meta.folder_path, Some("folder1".to_string()));
        
        VaultManager::close_session(&session_id);
    }

    #[test]
    #[serial]
    fn test_vault_manager_folder_operations() {
        let temp_dir = setup_temp_vault();
        let manager = create_test_vault_manager(&temp_dir);
        let password = create_test_password();
        
        manager.initialize_encrypted_vault("Test Vault".to_string(), &password).unwrap();
        let session_id = manager.unlock_vault(&password).unwrap();
        
        // Create folder
        manager.create_folder(&session_id, "test_folder".to_string()).unwrap();
        
        // Get folders list
        let folders = manager.get_folders_list(&session_id).unwrap();
        assert_eq!(folders.len(), 1);
        assert_eq!(folders[0], "test_folder");
        
        // Create note in folder
        let note = manager.create_note(
            &session_id,
            Some("Test Note".to_string()),
            None,
            None,
            Some("test_folder".to_string()),
            None
        ).unwrap();
        
        // Move note to different folder
        manager.move_note(&session_id, &note.id, Some("new_folder".to_string())).unwrap();
        
        // Verify note moved
        let loaded_note = manager.load_note(&session_id, &note.id).unwrap();
        assert_eq!(loaded_note.folder_path, Some("new_folder".to_string()));
        
        // Move folder
        manager.move_folder(&session_id, "test_folder", "renamed_folder").unwrap();
        
        let folders = manager.get_folders_list(&session_id).unwrap();
        assert!(folders.contains(&"renamed_folder".to_string()));
        assert!(!folders.contains(&"test_folder".to_string()));
        
        VaultManager::close_session(&session_id);
    }

    #[test]
    #[serial]
    fn test_vault_manager_delete_note() {
        let temp_dir = setup_temp_vault();
        let manager = create_test_vault_manager(&temp_dir);
        let password = create_test_password();
        
        manager.initialize_encrypted_vault("Test Vault".to_string(), &password).unwrap();
        let session_id = manager.unlock_vault(&password).unwrap();
        
        // Create note
        let note = manager.create_note(
            &session_id,
            Some("Test Note".to_string()),
            None,
            None,
            None,
            None
        ).unwrap();
        
        // Verify note exists
        let notes_list = manager.get_notes_list(&session_id).unwrap();
        assert_eq!(notes_list.len(), 1);
        
        // Delete note
        manager.delete_note(&session_id, &note.id).unwrap();
        
        // Verify note is deleted
        let notes_list = manager.get_notes_list(&session_id).unwrap();
        assert_eq!(notes_list.len(), 0);
        
        // Verify note file is deleted
        let result = manager.load_note(&session_id, &note.id);
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), VaultError::NoteNotFound(_)));
        
        VaultManager::close_session(&session_id);
    }

    #[test]
    #[serial]
    fn test_vault_manager_delete_folder() {
        let temp_dir = setup_temp_vault();
        let manager = create_test_vault_manager(&temp_dir);
        let password = create_test_password();
        
        manager.initialize_encrypted_vault("Test Vault".to_string(), &password).unwrap();
        let session_id = manager.unlock_vault(&password).unwrap();
        
        // Create folder
        manager.create_folder(&session_id, "test_folder".to_string()).unwrap();
        
        // Verify folder exists
        let folders = manager.get_folders_list(&session_id).unwrap();
        assert_eq!(folders.len(), 1);
        
        // Delete folder
        manager.delete_folder(&session_id, "test_folder").unwrap();
        
        // Verify folder is deleted
        let folders = manager.get_folders_list(&session_id).unwrap();
        assert_eq!(folders.len(), 0);
        
        VaultManager::close_session(&session_id);
    }

    #[test]
    #[serial]
    fn test_vault_manager_session_expiry() {
        let temp_dir = setup_temp_vault();
        let manager = create_test_vault_manager(&temp_dir);
        let password = create_test_password();
        
        manager.initialize_encrypted_vault("Test Vault".to_string(), &password).unwrap();
        let session_id = manager.unlock_vault(&password).unwrap();
        
        // Verify session exists
        assert!(VaultManager::get_session(&session_id).is_some());
        
        // Wait for session to expire (this is a simplified test)
        // In real usage, sessions expire after 30 minutes of inactivity
        
        // Manually expire session by accessing the session map
        // (This is a test-only approach)
        {
            let mut sessions = SESSIONS.lock().unwrap();
            if let Some(session) = sessions.get_mut(&session_id) {
                session.created_at = Instant::now() - Duration::from_secs(3600);
                session.last_accessed = Instant::now() - Duration::from_secs(3600);
            }
        }
        
        // Session should now be expired
        assert!(VaultManager::get_session(&session_id).is_none());
    }

    #[test]
    fn test_default_note_type() {
        assert_eq!(default_note_type(), "text");
    }

    #[test]
    fn test_vault_error_display() {
        let error = VaultError::VaultNotFound("test_path".to_string());
        assert_eq!(error.to_string(), "Vault not found at path: test_path");
        
        let error = VaultError::InvalidPassword;
        assert_eq!(error.to_string(), "Invalid password");
        
        let error = VaultError::RateLimited(30);
        assert_eq!(error.to_string(), "Too many failed attempts. Try again in 30 seconds");
        
        let error = VaultError::NoteNotFound("note_id".to_string());
        assert_eq!(error.to_string(), "Note not found: note_id");
    }

    #[test]
    fn test_vault_info_serialization() {
        let info = VaultInfo::new("Test Vault".to_string());
        
        let serialized = serde_json::to_string(&info).unwrap();
        let deserialized: VaultInfo = serde_json::from_str(&serialized).unwrap();
        
        assert_eq!(info.name, deserialized.name);
        assert_eq!(info.version, deserialized.version);
        assert_eq!(info.is_encrypted, deserialized.is_encrypted);
    }

    #[test]
    fn test_note_serialization() {
        let note = Note::new("Test".to_string(), Some("Content".to_string()))
            .with_tags(vec!["tag1".to_string()])
            .with_folder(Some("folder1".to_string()));
        
        let serialized = serde_json::to_string(&note).unwrap();
        let deserialized: Note = serde_json::from_str(&serialized).unwrap();
        
        assert_eq!(note.id, deserialized.id);
        assert_eq!(note.title, deserialized.title);
        assert_eq!(note.content, deserialized.content);
        assert_eq!(note.note_type, deserialized.note_type);
        assert_eq!(note.tags, deserialized.tags);
        assert_eq!(note.folder_path, deserialized.folder_path);
    }

    #[test]
    fn test_notes_index_serialization() {
        let mut index = NotesIndex::new();
        let note = Note::new("Test".to_string(), None);
        
        index.add_note(&note);
        index.add_folder("test_folder".to_string()).unwrap();
        
        let serialized = serde_json::to_string(&index).unwrap();
        let deserialized: NotesIndex = serde_json::from_str(&serialized).unwrap();
        
        assert_eq!(index.notes.len(), deserialized.notes.len());
        assert_eq!(index.folders.len(), deserialized.folders.len());
        assert_eq!(index.notes[0].id, deserialized.notes[0].id);
        assert_eq!(index.folders[0].path, deserialized.folders[0].path);
    }

    #[test]
    fn test_base64_module() {
        let test_data = b"Hello, World!";
        let encoded = base64::encode(test_data);
        let decoded = base64::decode(&encoded).unwrap();
        
        assert_eq!(test_data, decoded.as_slice());
    }

    // Integration test for complete vault workflow
    #[test]
    #[serial]
    fn test_complete_vault_workflow() {
        let temp_dir = setup_temp_vault();
        let manager = create_test_vault_manager(&temp_dir);
        let password = create_test_password();
        
        // Initialize encrypted vault
        let vault_info = manager.initialize_encrypted_vault("My Vault".to_string(), &password).unwrap();
        assert_eq!(vault_info.name, "My Vault");
        assert!(vault_info.is_encrypted);
        
        // Unlock vault
        let session_id = manager.unlock_vault(&password).unwrap();
        
        // Create folders
        manager.create_folder(&session_id, "work".to_string()).unwrap();
        manager.create_folder(&session_id, "personal".to_string()).unwrap();
        
        // Create notes
        let work_note = manager.create_note(
            &session_id,
            Some("Project Plan".to_string()),
            Some("This is my project plan...".to_string()),
            Some(vec!["work".to_string(), "planning".to_string()]),
            Some("work".to_string()),
            None
        ).unwrap();
        
        let personal_note = manager.create_note(
            &session_id,
            Some("Shopping List".to_string()),
            Some("- Milk\n- Bread\n- Eggs".to_string()),
            Some(vec!["personal".to_string(), "shopping".to_string()]),
            Some("personal".to_string()),
            None
        ).unwrap();
        
        // Verify notes list
        let notes_list = manager.get_notes_list(&session_id).unwrap();
        assert_eq!(notes_list.len(), 2);
        
        // Verify folders list
        let folders_list = manager.get_folders_list(&session_id).unwrap();
        assert_eq!(folders_list.len(), 2);
        assert!(folders_list.contains(&"work".to_string()));
        assert!(folders_list.contains(&"personal".to_string()));
        
        // Load and verify notes
        let loaded_work_note = manager.load_note(&session_id, &work_note.id).unwrap();
        assert_eq!(loaded_work_note.title, "Project Plan");
        assert_eq!(loaded_work_note.folder_path, Some("work".to_string()));
        
        let loaded_personal_note = manager.load_note(&session_id, &personal_note.id).unwrap();
        assert_eq!(loaded_personal_note.title, "Shopping List");
        assert_eq!(loaded_personal_note.folder_path, Some("personal".to_string()));
        
        // Update a note
        let updated_note = manager.save_note(
            &session_id,
            &work_note.id,
            Some("Updated Project Plan".to_string()),
            Some("This is my updated project plan...".to_string()),
            Some(vec!["work".to_string(), "planning".to_string(), "updated".to_string()]),
            Some("work".to_string())
        ).unwrap();
        
        assert_eq!(updated_note.title, "Updated Project Plan");
        assert_eq!(updated_note.tags.len(), 3);
        assert!(updated_note.tags.contains(&"updated".to_string()));
        
        // Move a note
        manager.move_note(&session_id, &personal_note.id, Some("work".to_string())).unwrap();
        let moved_note = manager.load_note(&session_id, &personal_note.id).unwrap();
        assert_eq!(moved_note.folder_path, Some("work".to_string()));
        
        // Delete a note
        manager.delete_note(&session_id, &personal_note.id).unwrap();
        let notes_list = manager.get_notes_list(&session_id).unwrap();
        assert_eq!(notes_list.len(), 1);
        
        // Close session
        assert!(VaultManager::close_session(&session_id));
        
        // Verify session is closed
        assert!(VaultManager::get_session(&session_id).is_none());
        
        // Reopen vault
        let new_session_id = manager.unlock_vault(&password).unwrap();
        
        // Verify data persisted
        let notes_list = manager.get_notes_list(&new_session_id).unwrap();
        assert_eq!(notes_list.len(), 1);
        assert_eq!(notes_list[0].title, "Updated Project Plan");
        
        VaultManager::close_session(&new_session_id);
    }
} 