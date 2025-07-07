//! # Command Handlers
//!
//! This module contains all Tauri command handlers organized by functionality.
//! Each command is a function that can be invoked from the frontend and provides
//! a specific piece of functionality for the application.
//!
//! ## Organization
//!
//! Commands are organized into logical groups:
//!
//! - **app_commands**: Application-level utilities and information
//! - **vault_commands**: Vault lifecycle and management operations
//! - **note_commands**: Note CRUD operations and management
//! - **folder_commands**: Folder operations and hierarchy management
//!
//! ## Security Considerations
//!
//! All commands that access encrypted data require valid session IDs.
//! Session management is handled by the vault module and includes:
//!
//! - Automatic session expiration (30 minutes)
//! - Session validation on each request
//! - Secure session cleanup on logout
//!
//! ## Error Handling
//!
//! Commands use the hierarchical error system defined in the errors module.
//! All errors are properly typed and provide meaningful messages to the frontend.

// Command modules
pub mod app_commands;
pub mod folder_commands;
pub mod note_commands;
pub mod vault_commands;

// Re-export all command functions
pub use app_commands::*;
pub use folder_commands::*;
pub use note_commands::*;
pub use vault_commands::*;
