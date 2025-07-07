export interface VaultInfo {
  name: string;
  created_at: string;
  version: string;
  is_encrypted: boolean;
  crypto?: VaultCrypto;
}

export interface VaultCrypto {
  password_hash: string;
  salt: string;
  argon2_params: Argon2Params;
  key_test_vector: string;
  key_test_nonce: string;
}

export interface Argon2Params {
  memory: number;
  iterations: number;
  parallelism: number;
  version: number;
}

export interface VaultLocationInfo {
  path: string;
  is_valid: boolean;
  is_writable: boolean;
  has_existing_vault: boolean;
  vault_info?: VaultInfo;
}

// Multi-vault support types
export interface KnownVault {
  id: string;
  name: string;
  path: string;
  created_at: string;
  last_accessed?: string;
  is_favorite: boolean;
}

export interface AddVaultRequest {
  name: string;
  path: string;
}

export interface AddVaultResult {
  success: boolean;
  vault_id?: string;
  error_message?: string;
}

export interface UpdateVaultMetadataRequest {
  vault_id: string;
  name?: string;
  is_favorite?: boolean;
}

export interface PasswordStrength {
  is_valid: boolean;
  score: number; // 0-4 strength score
  issues: string[];
  suggestions: string[];
}

export interface VaultSetupInfo {
  needs_password: boolean;
  is_encrypted: boolean;
  vault_info?: VaultInfo;
}

export interface VaultPasswordSetupState {
  vaultName: string;
  password: string;
  confirmPassword: string;
  isCreating: boolean;
  error: string | null;
  showPassword: boolean;
  passwordStrength: PasswordStrength | null;
}

export interface VaultUnlockResult {
  success: boolean;
  session_id?: string;
  vault_info?: VaultInfo;
  error_message?: string;
}

export interface RateLimitInfo {
  is_rate_limited: boolean;
  seconds_remaining?: number;
}

export interface VaultUnlockState {
  password: string;
  isUnlocking: boolean;
  error: string | null;
  showPassword: boolean;
  rateLimitInfo: RateLimitInfo | null;
}

// Note types
export type NoteType = 'text' | 'whiteboard';

// Note-related types
export interface Note {
  id: string;
  title: string;
  content: string;
  note_type: NoteType;
  created_at: string;
  updated_at: string;
  tags: string[];
  folder_path?: string;
}

export interface NoteMetadata {
  id: string;
  title: string;
  note_type: NoteType;
  created_at: string;
  updated_at: string;
  tags: string[];
  folder_path?: string;
  content_preview: string; // First 100 chars of content
}

export interface CreateNoteResult {
  success: boolean;
  note?: Note;
  error_message?: string;
}

export interface SaveNoteResult {
  success: boolean;
  note?: Note;
  error_message?: string;
} 