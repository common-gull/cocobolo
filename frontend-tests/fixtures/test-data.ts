import type { 
  KnownVault, 
  Note, 
  NoteMetadata, 
  VaultInfo, 
  AppConfig 
} from '../../src/types';

/**
 * Test data fixtures for consistent testing
 */

export const mockVaults: KnownVault[] = [
  {
    id: 'vault-1',
    name: 'Personal Notes',
    path: '/mock/path/personal',
    created_at: '2025-01-01T00:00:00Z',
    last_accessed: '2025-01-02T00:00:00Z',
    is_favorite: true
  },
  {
    id: 'vault-2',
    name: 'Work Notes',
    path: '/mock/path/work',
    created_at: '2025-01-01T00:00:00Z',
    is_favorite: false
  },
  {
    id: 'vault-3',
    name: 'Archive',
    path: '/mock/path/archive',
    created_at: '2024-12-01T00:00:00Z',
    is_favorite: false
  }
];

export const mockVaultInfo: VaultInfo = {
  name: 'Test Vault',
  created_at: '2025-01-01T00:00:00Z',
  version: '1.0.0',
  is_encrypted: true,
  crypto: {
    password_hash: 'mock_hash',
    salt: 'mock_salt',
    argon2_params: {
      memory: 65536,
      iterations: 3,
      parallelism: 4,
      version: 19
    },
    key_test_vector: 'mock_vector',
    key_test_nonce: 'mock_nonce'
  }
};

export const mockNotes: Note[] = [
  {
    id: 'note-1',
    title: 'Welcome to Cocobolo',
    content: '# Welcome to Cocobolo\n\nThis is your first note! You can use Markdown to format your text.\n\n## Features\n\n- Encrypted storage\n- Markdown support\n- Rich text editing\n- Search functionality',
    note_type: 'text',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    tags: ['welcome', 'getting-started']
  },
  {
    id: 'note-2',
    title: 'Meeting Notes - Q1 Planning',
    content: '# Q1 Planning Meeting\n\n**Date:** January 15, 2025\n**Attendees:** Alice, Bob, Charlie\n\n## Agenda\n\n1. Review Q4 results\n2. Set Q1 goals\n3. Resource allocation\n\n## Action Items\n\n- [ ] Finalize budget proposal\n- [ ] Schedule team kickoff\n- [ ] Update project timeline',
    note_type: 'text',
    created_at: '2025-01-02T00:00:00Z',
    updated_at: '2025-01-02T00:00:00Z',
    tags: ['meeting', 'work', 'planning'],
    folder_path: 'work'
  },
  {
    id: 'note-3',
    title: 'Recipe Collection',
    content: '# My Favorite Recipes\n\n## Pasta Carbonara\n\n**Ingredients:**\n- 400g spaghetti\n- 200g pancetta\n- 4 eggs\n- 100g Parmesan cheese\n- Black pepper\n\n**Instructions:**\n1. Cook pasta al dente\n2. Fry pancetta until crispy\n3. Mix eggs with cheese\n4. Combine everything off heat',
    note_type: 'text',
    created_at: '2025-01-03T00:00:00Z',
    updated_at: '2025-01-03T00:00:00Z',
    tags: ['recipe', 'cooking', 'personal'],
    folder_path: 'personal'
  },
  {
    id: 'note-4',
    title: 'Whiteboard Brainstorm',
    content: '{"elements":[{"type":"rectangle","x":100,"y":100,"width":200,"height":100,"strokeColor":"#000","backgroundColor":"#fff"}]}',
    note_type: 'whiteboard',
    created_at: '2025-01-04T00:00:00Z',
    updated_at: '2025-01-04T00:00:00Z',
    tags: ['brainstorm', 'visual'],
    folder_path: 'work'
  }
];

export const mockNotesMetadata: NoteMetadata[] = mockNotes.map(note => ({
  id: note.id,
  title: note.title,
  note_type: note.note_type,
  created_at: note.created_at,
  updated_at: note.updated_at,
  tags: note.tags,
  ...(note.folder_path && { folder_path: note.folder_path }),
  content_preview: note.content.substring(0, 100)
}));

export const mockAppConfig: AppConfig = {
  vault_location: '/mock/vault/path',
  current_vault_id: 'vault-1',
  known_vaults: mockVaults,
  theme: 'system',
  auto_save_interval: 5000,
  show_markdown_preview: true,
  window_maximized: false,
  window_width: 1200,
  window_height: 800,
  recent_vault_ids: ['vault-1', 'vault-2'],
  max_recent_vaults: 5
};

export const mockFolders = [
  'work',
  'personal',
  'archive',
  'projects'
];

export const mockTags = [
  'welcome',
  'getting-started',
  'meeting',
  'work',
  'planning',
  'recipe',
  'cooking',
  'personal',
  'brainstorm',
  'visual'
];

// Test scenarios
export const testScenarios = {
  emptyVault: {
    vaults: [],
    notes: [],
    folders: []
  },
  singleVault: {
    vaults: [mockVaults[0]],
    notes: [mockNotes[0]],
    folders: []
  },
  fullVault: {
    vaults: mockVaults,
    notes: mockNotes,
    folders: mockFolders
  },
  workOnlyNotes: {
    vaults: mockVaults,
    notes: mockNotes.filter(note => note.tags.includes('work')),
    folders: ['work']
  }
};

// Common test passwords
export const testPasswords = {
  correct: 'correct-password',
  incorrect: 'wrong-password',
  weak: '123',
  strong: 'MyStr0ng!P@ssw0rd2025'
};

// Common test paths
export const testPaths = {
  validVault: '/mock/path/valid-vault',
  invalidVault: '/mock/path/invalid-vault',
  existingVault: '/mock/path/existing-vault',
  newVault: '/mock/path/new-vault',
  readOnlyVault: '/mock/path/readonly-vault'
};

// Error messages for testing
export const errorMessages = {
  invalidPassword: 'Invalid password',
  vaultNotFound: 'Vault not found',
  noteNotFound: 'Note not found',
  accessDenied: 'Access denied',
  networkError: 'Network error',
  rateLimited: 'Too many failed attempts'
};

// Success messages for testing
export const successMessages = {
  vaultCreated: 'Vault created successfully',
  vaultUnlocked: 'Vault unlocked',
  noteSaved: 'Note saved',
  noteDeleted: 'Note deleted',
  folderCreated: 'Folder created'
}; 