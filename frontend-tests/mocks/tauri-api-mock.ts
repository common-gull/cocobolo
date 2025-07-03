import { Page } from '@playwright/test';

/**
 * Configuration for mock responses
 */
export interface MockResponse {
  response: any;
  delay?: number; // Optional delay in milliseconds
  shouldFail?: boolean; // Whether this response should throw an error
  errorMessage?: string; // Custom error message if shouldFail is true
}

export interface MockConfig {
  // Static response - always returns the same value
  static?: any;
  // Sequence of responses - returns responses in order, repeats last one
  sequence?: MockResponse[];
  // Function that generates response based on arguments
  dynamic?: (args: any, callCount: number) => any;
  // Reset call count after this many calls (useful for testing cycles)
  resetAfter?: number;
}

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

    // Enhanced mock configuration storage
    const mockConfigs: Record<string, any> = {};
    const callCounts: Record<string, number> = {};

    // Helper function to get response from mock configuration
    const getMockResponse = async (cmd: string, args: any) => {
      const config = mockConfigs[cmd];
      if (!config) return null;

      // Initialize call count
      if (!(cmd in callCounts)) {
        callCounts[cmd] = 0;
      }
      const currentCount = callCounts[cmd]!;
      callCounts[cmd] = currentCount + 1;

      // Reset call count if specified
      if (config.resetAfter && callCounts[cmd]! > config.resetAfter) {
        callCounts[cmd] = 1;
      }

      let result: any;
      let delay = 0;
      let shouldFail = false;
      let errorMessage = 'Mock error';

      if (config.static !== undefined) {
        // Static response
        result = config.static;
      } else if (config.sequence && config.sequence.length > 0) {
        // Sequence responses
        const sequence = config.sequence;
        const index = Math.min(callCounts[cmd]! - 1, sequence.length - 1);
        const mockResponse = sequence[index];
        
        if (mockResponse) {
          result = mockResponse.response;
          delay = mockResponse.delay || 0;
          shouldFail = mockResponse.shouldFail || false;
          errorMessage = mockResponse.errorMessage || 'Mock error';
        }
      } else if (config.dynamic) {
        // Dynamic response
        result = config.dynamic(args, callCounts[cmd]!);
      } else if (config.dynamicFnString) {
        // Dynamic response from string function
        try {
          // Evaluate the function string and call it
          const dynamicFn = eval(`(${config.dynamicFnString})`);
          result = dynamicFn(args, callCounts[cmd]!);
        } catch (error) {
          console.error('Error evaluating dynamic function:', error);
          result = { error: 'Dynamic function evaluation failed' };
        }
      }

      // Apply delay if specified
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      // Throw error if specified
      if (shouldFail) {
        throw new Error(errorMessage);
      }

      return result;
    };

    // Mock invoke function
    const mockInvoke = async (cmd: string, args: any = {}) => {
      console.log('Mock Tauri invoke:', cmd, args);

      // Check for custom mock configuration first
      const customResponse = await getMockResponse(cmd, args);
      if (customResponse !== null) {
        return customResponse;
      }

      // Add small delay to simulate async behavior
      await new Promise(resolve => setTimeout(resolve, 10));

      // Default mock implementations
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
            attempts: mockState.rateLimitAttempts,
            max_attempts: 3,
            is_rate_limited: isRateLimited,
            seconds_remaining: isRateLimited ? Math.ceil((60000 - timeSinceLastAttempt) / 1000) : 0
          };

        case 'check_session_status':
          return mockState.currentSession === args?.sessionId;

        case 'logout':
          mockState.currentSession = null;
          return true;

        case 'create_vault':
          // Mock vault creation - always succeeds with test data
          return {
            success: true,
            vault_info: {
              name: args?.name || 'New Vault',
              created_at: new Date().toISOString(),
              version: '1.0.0',
              is_encrypted: true
            },
            session_id: 'mock-session-123',
            error_message: null
          };

        case 'get_notes_list':
          if (args?.sessionId !== mockState.currentSession) {
            throw new Error('Invalid session');
          }

          return mockState.notes.map(note => ({
            id: note.id,
            title: note.title,
            note_type: note.note_type,
            content_preview: note.content.substring(0, 100),
            created_at: note.created_at,
            updated_at: note.updated_at,
            tags: note.tags,
            ...(note.folder_path && { folder_path: note.folder_path })
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
            title: args?.title || 'Untitled',
            content: args?.content || '',
            note_type: args?.noteType || 'text',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            tags: args?.tags || [],
            ...(args?.folderPath && { folder_path: args.folderPath })
          };

          mockState.notes.unshift(newNote);

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

    // Store mock state and configuration globally for test access
    (window as any).__MOCK_STATE__ = mockState;
    (window as any).__MOCK_CONFIGS__ = mockConfigs;
    (window as any).__CALL_COUNTS__ = callCounts;
  });
}

/**
 * Clear mock state between tests
 */
export async function clearTauriMocks(page: Page) {
  await page.evaluate(() => {
    const mockState = (window as any).__MOCK_STATE__;
    const mockConfigs = (window as any).__MOCK_CONFIGS__;
    const callCounts = (window as any).__CALL_COUNTS__;
    
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

    // Clear custom mock configurations
    if (mockConfigs) {
      Object.keys(mockConfigs).forEach(key => {
        delete mockConfigs[key];
      });
    }

    // Clear call counts
    if (callCounts) {
      Object.keys(callCounts).forEach(key => {
        delete callCounts[key];
      });
    }
  });
}

/**
 * Set up custom mock responses for specific commands with enhanced configuration
 */
export async function mockTauriCommand(
  page: Page, 
  command: string, 
  config: MockConfig
) {
  await page.evaluate(({ command, config }) => {
    const mockConfigs = (window as any).__MOCK_CONFIGS__;
    if (mockConfigs) {
      // Handle dynamic functions by converting them to strings
      if (config.dynamic) {
        const dynamicFn = config.dynamic;
        if (typeof dynamicFn === 'function') {
          // Convert function to string and store it separately
          (mockConfigs as any)[command] = {
            ...config,
            dynamic: null,
            dynamicFnString: dynamicFn.toString()
          };
        } else {
          mockConfigs[command] = config;
        }
      } else {
        mockConfigs[command] = config;
      }
    }
  }, { command, config });
}

/**
 * Convenience function to set a static response for a command
 */
export async function mockTauriCommandStatic(
  page: Page,
  command: string,
  response: any
) {
  await mockTauriCommand(page, command, { static: response });
}

/**
 * Convenience function to set a sequence of responses for a command
 */
export async function mockTauriCommandSequence(
  page: Page,
  command: string,
  responses: MockResponse[]
) {
  await mockTauriCommand(page, command, { sequence: responses });
}

/**
 * Convenience function to set a dynamic response function for a command
 */
export async function mockTauriCommandDynamic(
  page: Page,
  command: string,
  responseFn: (args: any, callCount: number) => any
) {
  // Convert function to string for serialization
  const fnString = responseFn.toString();
  
  await page.evaluate(({ command, fnString }) => {
    const mockConfigs = (window as any).__MOCK_CONFIGS__;
    if (mockConfigs) {
      mockConfigs[command] = {
        dynamicFnString: fnString
      };
    }
  }, { command, fnString });
}

/**
 * Get call count for a specific command (useful for assertions)
 */
export async function getTauriCommandCallCount(
  page: Page,
  command: string
): Promise<number> {
  return await page.evaluate((command) => {
    const callCounts = (window as any).__CALL_COUNTS__;
    return callCounts?.[command] || 0;
  }, command);
}

/**
 * Reset call count for a specific command
 */
export async function resetTauriCommandCallCount(
  page: Page,
  command: string
) {
  await page.evaluate((command) => {
    const callCounts = (window as any).__CALL_COUNTS__;
    if (callCounts) {
      callCounts[command] = 0;
    }
  }, command);
} 