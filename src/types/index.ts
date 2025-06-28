export interface AppInfo {
  name: string;
  version: string;
  description: string;
}

export interface VaultInfo {
  name: string;
  created_at: string;
  version: string;
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
  theme: string;
  auto_save_interval: number;
  show_markdown_preview: boolean;
}

export interface VaultSelectionState {
  selectedPath: string | null;
  isValidating: boolean;
  validationResult: VaultLocationInfo | null;
  error: string | null;
} 