use anyhow::Result;
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
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

#[derive(Serialize, Deserialize, Debug)]
pub struct AppInfo {
    pub name: String,
    pub version: String,
    pub description: String,
}

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn get_app_info() -> Result<AppInfo, AppError> {
    Ok(AppInfo {
        name: "Cocobolo".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        description: "A secure, encrypted note-taking application".to_string(),
    })
}

#[tauri::command]
fn greet(name: &str) -> Result<String, AppError> {
    if name.trim().is_empty() {
        return Err(AppError::Application("Name cannot be empty".to_string()));
    }
    Ok(format!("Hello, {}! Welcome to Cocobolo - your secure note-taking companion!", name))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![greet, get_app_info])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
