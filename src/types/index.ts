export interface AppInfo {
  name: string;
  version: string;
  description: string;
}

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

export interface AppConfig {
  vault_location?: string;
  theme: 'light' | 'dark' | 'system';
  auto_save_interval: number;
  show_markdown_preview: boolean;
}

export interface VaultSelectionState {
  selectedPath: string | null;
  isValidating: boolean;
  validationResult: VaultLocationInfo | null;
  error: string | null;
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

export interface PasswordSetupState {
  password: string;
  confirmPassword: string;
  vaultName: string;
  passwordStrength: PasswordStrength | null;
  isValidating: boolean;
  isCreating: boolean;
  error: string | null;
  showPassword: boolean;
  showConfirmPassword: boolean;
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

export type AppView = 'home' | 'vault-setup' | 'password-setup' | 'vault-unlock' | 'main-app'; 