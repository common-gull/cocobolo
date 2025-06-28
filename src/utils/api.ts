import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import type { AppInfo, VaultLocationInfo, AppConfig, PasswordStrength, VaultSetupInfo, VaultInfo } from '../types';

export class ApiError extends Error {
  public override cause?: unknown;
  
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.cause = cause;
  }
}

export const api = {
  // App info
  async getAppInfo(): Promise<AppInfo> {
    try {
      return await invoke<AppInfo>('get_app_info');
    } catch (error) {
      throw new ApiError('Failed to get app info', error);
    }
  },

  // Vault location management
  async selectVaultDirectory(): Promise<string | null> {
    try {
      const result = await open({
        directory: true,
        multiple: false,
        title: 'Select Vault Location',
      });
      
      return result as string | null;
    } catch (error) {
      throw new ApiError('Failed to open directory dialog', error);
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
      await invoke('set_vault_location', { path });
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

  // Utility
  async greet(name: string): Promise<string> {
    try {
      return await invoke<string>('greet', { name });
    } catch (error) {
      throw new ApiError('Failed to greet', error);
    }
  },
}; 