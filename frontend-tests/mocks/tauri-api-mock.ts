import { Page } from '@playwright/test';

/**
 * Mock Tauri API calls using a direct script injection approach
 * This sets up the mocks before the page loads any Tauri code
 */

export async function setupTauriMocks(page: Page) {
  // Inject the mock setup script before the page loads
  await page.addInitScript(() => {
    // Set up crypto for tests (required by Tauri)
    if (!window.crypto) {
      (window as any).crypto = {
        getRandomValues: (buffer: any) => {
          for (let i = 0; i < buffer.length; i++) {
            buffer[i] = Math.floor(Math.random() * 256);
          }
          return buffer;
        }
      };
    }

    // Mock state that persists across calls
    const mockState = {
      currentSession: null as string | null,
      rateLimitAttempts: 0,
      lastFailedAttempt: 0,
      folders: ['work'] as string[], // Track folders separately
      notes: [
        {
          id: 'note-1',
          title: 'Welcome to Cocobolo',
          content: '# Welcome\n\nThis is a test note.',
          note_type: 'text',
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
          tags: ['welcome', 'test']
        },
        {
          id: 'note-2',
          title: 'Meeting Notes',
          content: '# Meeting\n\nTest meeting notes.',
          note_type: 'text',
          created_at: '2025-01-02T00:00:00Z',
          updated_at: '2025-01-02T00:00:00Z',
          tags: ['meeting', 'work'],
          folder_path: 'work'
        }
      ],
      vaults: [
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
        }
      ]
    };

    // Mock invoke function
    const mockInvoke = async (cmd: string, args: any = {}) => {
      console.log('Mock Tauri invoke:', cmd, args);

      // Add small delay to simulate async behavior
      await new Promise(resolve => setTimeout(resolve, 10));

      switch (cmd) {
        case 'get_app_info':
          return {
            name: 'Cocobolo',
            version: '0.0.1',
            description: 'Secure encrypted notes application'
          };

        case 'greet':
          return 'Hello, ' + (args?.name || 'World') + '!';

        case 'get_known_vaults':
          console.log('Mock known vaults:', mockState.vaults);
          return mockState.vaults;

        case 'get_recent_vaults':
          console.log('Mock recent vaults:', mockState.vaults);
          // Return the most recently accessed vaults (sorted by last_accessed)
          return mockState.vaults
            .filter(vault => vault.last_accessed)
            .sort((a, b) => new Date(b.last_accessed!).getTime() - new Date(a.last_accessed!).getTime())
            .slice(0, 5);

        case 'get_favorite_vaults':
          console.log('Mock favorite vaults:', mockState.vaults);
          // Return only favorite vaults
          return mockState.vaults.filter(vault => vault.is_favorite);

        case 'get_app_config':
          return {
            vault_location: '/mock/vault/path',
            current_vault_id: 'vault-1',
            known_vaults: mockState.vaults,
            theme: 'system',
            auto_save_interval: 5000,
            show_markdown_preview: true,
            window_maximized: false,
            window_width: 1200,
            window_height: 800,
            recent_vault_ids: ['vault-1', 'vault-2'],
            max_recent_vaults: 5
          };

        case 'validate_vault_location':
          return {
            path: args?.path || '/mock/path',
            is_valid: true,
            is_writable: !args?.path?.includes('readonly'),
            has_existing_vault: args?.path?.includes('existing'),
            vault_info: args?.path?.includes('existing') ? {
              name: 'Test Vault',
              created_at: '2025-01-01T00:00:00Z',
              version: '1.0.0',
              is_encrypted: true
            } : undefined
          };

        case 'validate_password_strength':
          const password = args?.password || '';
          const length = password.length;
          const hasUpper = /[A-Z]/.test(password);
          const hasLower = /[a-z]/.test(password);
          const hasNumber = /\d/.test(password);
          const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
          
          let score = 0;
          if (length >= 8) score++;
          if (hasUpper) score++;
          if (hasLower) score++;
          if (hasNumber) score++;
          if (hasSpecial) score++;

          const issues = [];
          const suggestions = [];

          if (length < 8) {
            issues.push('Password is too short');
            suggestions.push('Use at least 8 characters');
          }
          if (!hasUpper) suggestions.push('Add uppercase letters');
          if (!hasLower) suggestions.push('Add lowercase letters');
          if (!hasNumber) suggestions.push('Add numbers');
          if (!hasSpecial) suggestions.push('Add special characters');

          return {
            is_valid: score >= 3,
            score: Math.min(score, 4),
            issues,
            suggestions
          };

        case 'unlock_vault':
          const now = Date.now();
          if (mockState.rateLimitAttempts >= 3 && now - mockState.lastFailedAttempt < 60000) {
            return {
              success: false,
              error_message: 'Too many failed attempts. Try again later.'
            };
          }

          if (args?.password === 'correct-password') {
            mockState.currentSession = 'mock-session-123';
            mockState.rateLimitAttempts = 0;
            return {
              success: true,
              session_id: 'mock-session-123',
              vault_info: {
                name: 'Test Vault',
                created_at: '2025-01-01T00:00:00Z',
                version: '1.0.0',
                is_encrypted: true
              }
            };
          } else {
            mockState.rateLimitAttempts++;
            mockState.lastFailedAttempt = now;
            return {
              success: false,
              error_message: 'Invalid password'
            };
          }

        case 'get_vault_rate_limit_status':
          const timeSinceLastAttempt = Date.now() - mockState.lastFailedAttempt;
          const isRateLimited = mockState.rateLimitAttempts >= 3 && timeSinceLastAttempt < 60000;
          
          return {
            is_rate_limited: isRateLimited,
            seconds_remaining: isRateLimited ? Math.ceil((60000 - timeSinceLastAttempt) / 1000) : undefined
          };

        case 'check_session_status':
          return args?.sessionId === mockState.currentSession;

        case 'get_notes_list':
          if (args?.sessionId !== mockState.currentSession) {
            throw new Error('Invalid session');
          }
          
          return mockState.notes.map(note => ({
            id: note.id,
            title: note.title,
            note_type: note.note_type,
            created_at: note.created_at,
            updated_at: note.updated_at,
            tags: note.tags,
            ...(note.folder_path && { folder_path: note.folder_path }),
            content_preview: note.content.substring(0, 100)
          }));

        case 'load_note':
          if (args?.sessionId !== mockState.currentSession) {
            throw new Error('Invalid session');
          }
          
          const note = mockState.notes.find(n => n.id === args?.noteId);
          if (!note) {
            throw new Error('Note not found');
          }
          
          return note;

        case 'create_note':
          if (args?.sessionId !== mockState.currentSession) {
            throw new Error('Invalid session');
          }

          const newNote = {
            id: 'note-' + Date.now(),
            title: args?.title || 'Untitled Note',
            content: args?.content || '',
            note_type: args?.noteType || 'text',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            tags: args?.tags || [],
            ...(args?.folderPath && { folder_path: args.folderPath })
          };

          mockState.notes.push(newNote);

          return {
            success: true,
            note: newNote
          };

        case 'save_note':
          if (args?.sessionId !== mockState.currentSession) {
            throw new Error('Invalid session');
          }

          const noteToSave = mockState.notes.find(n => n.id === args?.noteId);
          if (!noteToSave) {
            return {
              success: false,
              error_message: 'Note not found'
            };
          }

          if (args?.title !== undefined) noteToSave.title = args.title;
          if (args?.content !== undefined) noteToSave.content = args.content;
          if (args?.tags !== undefined) noteToSave.tags = args.tags;
          if (args?.folderPath !== undefined) {
            if (args.folderPath) {
              noteToSave.folder_path = args.folderPath;
            } else {
              delete (noteToSave as any).folder_path;
            }
          }
          noteToSave.updated_at = new Date().toISOString();

          return {
            success: true,
            note: noteToSave
          };

        case 'delete_note':
          if (args?.sessionId !== mockState.currentSession) {
            throw new Error('Invalid session');
          }

          const initialLength = mockState.notes.length;
          mockState.notes = mockState.notes.filter(note => note.id !== args?.noteId);
          
          return mockState.notes.length < initialLength;

        case 'get_folders_list':
          if (args?.sessionId !== mockState.currentSession) {
            throw new Error('Invalid session');
          }

          // Return folders from both the explicit folders list and notes with folder_path
          const foldersFromNotes = new Set<string>();
          mockState.notes.forEach(note => {
            if ((note as any).folder_path) {
              foldersFromNotes.add((note as any).folder_path);
            }
          });
          
          // Combine explicit folders with folders from notes
          const allFolders = new Set([...mockState.folders, ...foldersFromNotes]);
          return Array.from(allFolders);

        case 'add_known_vault':
          const newVault = {
            id: 'vault-' + Date.now(),
            name: args?.name || 'New Vault',
            path: args?.path || '/mock/path/new',
            created_at: new Date().toISOString(),
            is_favorite: false
          };
          mockState.vaults.push(newVault);
          return {
            success: true,
            vault_id: newVault.id,
            error_message: null
          };

        case 'remove_known_vault':
          const initialVaultLength = mockState.vaults.length;
          mockState.vaults = mockState.vaults.filter(vault => vault.id !== args?.vaultId);
          return mockState.vaults.length < initialVaultLength;

        case 'set_current_vault':
          // Just return success - we don't need to track current vault in tests
          return;

        case 'update_vault_metadata':
          const vaultToUpdate = mockState.vaults.find(vault => vault.id === args?.vault_id);
          if (vaultToUpdate) {
            if (args?.name !== undefined) vaultToUpdate.name = args.name;
            if (args?.is_favorite !== undefined) vaultToUpdate.is_favorite = args.is_favorite;
          }
          return;

        case 'check_vault_setup_status':
          return {
            needs_password: true,
            is_encrypted: true,
            vault_info: {
              name: 'Test Vault',
              created_at: '2025-01-01T00:00:00Z',
              version: '1.0.0',
              is_encrypted: true
            }
          };

        case 'get_current_vault_location':
          return '/mock/vault/path';

        case 'get_current_vault':
          return mockState.vaults[0] || null;

        case 'create_folder':
          if (args?.sessionId !== mockState.currentSession) {
            throw new Error('Invalid session');
          }
          
          const folderName = args?.folderName || args?.name;
          if (folderName && !mockState.folders.includes(folderName)) {
            mockState.folders.push(folderName);
          }
          return true;

        default:
          throw new Error('Mock command not implemented: ' + cmd);
      }
    };

    // Set up Tauri internals mock
    (window as any).__TAURI_INTERNALS__ = {
      invoke: mockInvoke,
      transformCallback: (callback: any) => callback,
    };

    // Set up Tauri API mock
    (window as any).__TAURI__ = {
      core: {
        invoke: mockInvoke
      },
      dialog: {
        open: async (options: any) => {
          console.log('Mock dialog open:', options);
          if (options?.directory) {
            return '/mock/selected/directory';
          }
          return '/mock/selected/file.txt';
        }
      }
    };

    // Store mock state globally for test access
    (window as any).__MOCK_STATE__ = mockState;
  });
}

/**
 * Clear mock state between tests
 */
export async function clearTauriMocks(page: Page) {
  await page.evaluate(() => {
    const mockState = (window as any).__MOCK_STATE__;
    if (mockState) {
      mockState.currentSession = null;
      mockState.rateLimitAttempts = 0;
      mockState.lastFailedAttempt = 0;
      // Reset folders to initial state
      mockState.folders = ['work'];
      // Reset notes to initial state
      mockState.notes = [
        {
          id: 'note-1',
          title: 'Welcome to Cocobolo',
          content: '# Welcome\n\nThis is a test note.',
          note_type: 'text',
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
          tags: ['welcome', 'test']
        },
        {
          id: 'note-2',
          title: 'Meeting Notes',
          content: '# Meeting\n\nTest meeting notes.',
          note_type: 'text',
          created_at: '2025-01-02T00:00:00Z',
          updated_at: '2025-01-02T00:00:00Z',
          tags: ['meeting', 'work'],
          folder_path: 'work'
        }
      ];
    }
  });
}

/**
 * Set up custom mock responses for specific commands
 */
export async function mockTauriCommand(
  page: Page, 
  command: string, 
  response: any
) {
  await page.evaluate(({ command, response }) => {
    // Store custom responses
    if (!(window as any).__MOCK_RESPONSES__) {
      (window as any).__MOCK_RESPONSES__ = {};
    }
    (window as any).__MOCK_RESPONSES__[command] = response;
  }, { command, response });
} 