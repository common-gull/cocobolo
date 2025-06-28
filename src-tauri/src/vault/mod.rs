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
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
    pub tags: Vec<String>,
    pub folder_path: Option<String>,
    pub content_preview: String,
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

    pub fn get_folders(&self) -> &[FolderMetadata] {
        &self.folders
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

    /// Create a new note in the vault
    pub fn create_note(&self, session_id: &str, title: Option<String>, content: Option<String>, tags: Option<Vec<String>>, folder_path: Option<String>) -> Result<Note, VaultError> {
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

        // Get session to ensure vault is unlocked
        let session = Self::get_session(session_id)
            .ok_or_else(|| VaultError::InvalidPassword)?; // Session expired or invalid

        // Create note
        let mut note = Note::new(title, content);
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
        let index_data: serde_json::Value = serde_json::from_str(
            &std::fs::read_to_string(&index_file)?
        )?;

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
        Ok(index.folders.iter().map(|f| f.path.clone()).collect())
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
            if let Err(e) = index.add_folder(folder_path.clone()) {
                eprintln!("Failed to add folder {}: {}", folder_path, e);
            }
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
            if let Err(e) = index.remove_folder(folder_path) {
                eprintln!("Failed to remove folder {}: {}", folder_path, e);
            }
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