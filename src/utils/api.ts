import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import type { 
  AppInfo, 
  VaultLocationInfo, 
  AppConfig, 
  PasswordStrength, 
  VaultSetupInfo, 
  VaultInfo,
  VaultUnlockResult,
  RateLimitInfo,
  Note,
  NoteMetadata,
  CreateNoteResult,
  SaveNoteResult
} from '../types';

export class ApiError extends Error {
  public override cause?: unknown;
  
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.cause = cause;
  }
}

export const api = {
  // Basic app functions
  async getAppInfo(): Promise<AppInfo> {
    try {
      return await invoke<AppInfo>('get_app_info');
    } catch (error) {
      throw new ApiError('Failed to get app info', error);
    }
  },

  async greet(name: string): Promise<string> {
    try {
      return await invoke<string>('greet', { name });
    } catch (error) {
      throw new ApiError('Failed to greet', error);
    }
  },

  // Vault location management
  async selectVaultDirectory(): Promise<string | null> {
    try {
      const result = await open({
        directory: true,
        multiple: false,
        title: 'Select Vault Directory',
      });
      
      return result || null;
    } catch (error) {
      throw new ApiError('Failed to select directory', error);
    }
  },

  async validateVaultLocation(path: string): Promise<VaultLocationInfo> {
    try {
      return await invoke<VaultLocationInfo>('validate_vault_location', { path });
    } catch (error) {
      throw new ApiError('Failed to validate vault location', error);
    }
  },

  async setVaultLocation(path: string): Promise<void> {
    try {
      await invoke<void>('set_vault_location', { path });
    } catch (error) {
      throw new ApiError('Failed to set vault location', error);
    }
  },

  async getCurrentVaultLocation(): Promise<string | null> {
    try {
      return await invoke<string | null>('get_current_vault_location');
    } catch (error) {
      throw new ApiError('Failed to get current vault location', error);
    }
  },

  async getAppConfig(): Promise<AppConfig> {
    try {
      return await invoke<AppConfig>('get_app_config');
    } catch (error) {
      throw new ApiError('Failed to get app config', error);
    }
  },

  // Password and encryption management
  async validatePasswordStrength(password: string): Promise<PasswordStrength> {
    try {
      return await invoke<PasswordStrength>('validate_password_strength', { password });
    } catch (error) {
      throw new ApiError('Failed to validate password strength', error);
    }
  },

  async checkVaultSetupStatus(path: string): Promise<VaultSetupInfo> {
    try {
      return await invoke<VaultSetupInfo>('check_vault_setup_status', { path });
    } catch (error) {
      throw new ApiError('Failed to check vault setup status', error);
    }
  },

  async createEncryptedVault(path: string, vaultName: string, password: string): Promise<VaultInfo> {
    try {
      return await invoke<VaultInfo>('create_encrypted_vault', { 
        path, 
        vaultName, 
        password 
      });
    } catch (error) {
      throw new ApiError('Failed to create encrypted vault', error);
    }
  },

  async verifyVaultPassword(path: string, password: string): Promise<boolean> {
    try {
      return await invoke<boolean>('verify_vault_password', { path, password });
    } catch (error) {
      throw new ApiError('Failed to verify vault password', error);
    }
  },

  // Vault unlock and session management
  async getVaultRateLimitStatus(path: string): Promise<RateLimitInfo> {
    try {
      return await invoke<RateLimitInfo>('get_vault_rate_limit_status', { path });
    } catch (error) {
      throw new ApiError('Failed to get rate limit status', error);
    }
  },

  async unlockVault(path: string, password: string): Promise<VaultUnlockResult> {
    try {
      return await invoke<VaultUnlockResult>('unlock_vault', { path, password });
    } catch (error) {
      throw new ApiError('Failed to unlock vault', error);
    }
  },

  async closeVaultSession(sessionId: string): Promise<boolean> {
    try {
      return await invoke<boolean>('close_vault_session', { sessionId });
    } catch (error) {
      throw new ApiError('Failed to close vault session', error);
    }
  },

  async checkSessionStatus(sessionId: string): Promise<boolean> {
    try {
      return await invoke<boolean>('check_session_status', { sessionId });
    } catch (error) {
      throw new ApiError('Failed to check session status', error);
    }
  },

  // Note management
  async createNote(
    vaultPath: string,
    sessionId: string,
    title?: string,
    content?: string,
    tags?: string[],
    folderPath?: string
  ): Promise<CreateNoteResult> {
    try {
      return await invoke<CreateNoteResult>('create_note', {
        vaultPath,
        sessionId,
        title,
        content,
        tags,
        folderPath
      });
    } catch (error) {
      throw new ApiError('Failed to create note', error);
    }
  },

  async createFolder(
    vaultPath: string,
    sessionId: string,
    folderPath: string
  ): Promise<void> {
    try {
      await invoke<void>('create_folder', {
        vaultPath,
        sessionId,
        folderPath
      });
    } catch (error) {
      throw new ApiError('Failed to create folder', error);
    }
  },

  async getNotesList(
    vaultPath: string,
    sessionId: string
  ): Promise<NoteMetadata[]> {
    try {
      return await invoke<NoteMetadata[]>('get_notes_list', {
        vaultPath,
        sessionId
      });
    } catch (error) {
      throw new ApiError('Failed to get notes list', error);
    }
  },

  async getFoldersList(
    vaultPath: string,
    sessionId: string
  ): Promise<string[]> {
    try {
      return await invoke<string[]>('get_folders_list', {
        vaultPath,
        sessionId
      });
    } catch (error) {
      throw new ApiError('Failed to get folders list', error);
    }
  },

  async loadNote(
    vaultPath: string,
    sessionId: string,
    noteId: string
  ): Promise<Note> {
    try {
      return await invoke<Note>('load_note', {
        vaultPath,
        sessionId,
        noteId
      });
    } catch (error) {
      throw new ApiError('Failed to load note', error);
    }
  },

  async saveNote(
    vaultPath: string,
    sessionId: string,
    noteId: string,
    title?: string,
    content?: string,
    tags?: string[],
    folderPath?: string
  ): Promise<SaveNoteResult> {
    try {
      return await invoke<SaveNoteResult>('save_note', {
        vaultPath,
        sessionId,
        noteId,
        title,
        content,
        tags,
        folderPath
      });
    } catch (error) {
      throw new ApiError('Failed to save note', error);
    }
  },

  async deleteNote(
    vaultPath: string,
    sessionId: string,
    noteId: string
  ): Promise<boolean> {
    try {
      return await invoke<boolean>('delete_note', {
        vaultPath,
        sessionId,
        noteId
      });
    } catch (error) {
      throw new ApiError('Failed to delete note', error);
    }
  },

  async deleteFolder(
    vaultPath: string,
    sessionId: string,
    folderPath: string
  ): Promise<boolean> {
    try {
      return await invoke<boolean>('delete_folder', {
        vaultPath,
        sessionId,
        folderPath
      });
    } catch (error) {
      throw new ApiError('Failed to delete folder', error);
    }
  },

  async moveNote(
    vaultPath: string,
    sessionId: string,
    noteId: string,
    newFolderPath?: string
  ): Promise<boolean> {
    try {
      return await invoke<boolean>('move_note', {
        vaultPath,
        sessionId,
        noteId,
        newFolderPath
      });
    } catch (error) {
      throw new ApiError('Failed to move note', error);
    }
  },

  async moveFolder(
    vaultPath: string,
    sessionId: string,
    oldPath: string,
    newPath: string
  ): Promise<boolean> {
    try {
      return await invoke<boolean>('move_folder', {
        vaultPath,
        sessionId,
        oldPath,
        newPath
      });
    } catch (error) {
      throw new ApiError('Failed to move folder', error);
    }
  },
}; 