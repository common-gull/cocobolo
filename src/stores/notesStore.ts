import {atom} from 'jotai';
import {atomWithStorage} from 'jotai/utils';

import type {NoteMetadata, VaultInfo} from '../types';

// Theme atoms (migrated from ThemeContext)
export type Theme = 'light' | 'dark' | 'system';

export const themeAtom = atomWithStorage<Theme>('cocobolo-theme', 'system');

export const systemThemeAtom = atom<'light' | 'dark'>(() => {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
});

export const effectiveThemeAtom = atom<'light' | 'dark'>((get) => {
  const theme = get(themeAtom);
  const systemTheme = get(systemThemeAtom);
  return theme === 'system' ? systemTheme : theme;
});

// Vault session atoms (consolidating from multiple routes)
export const sessionIdAtom = atom<string | null>(null);
export const vaultInfoAtom = atom<VaultInfo | null>(null);
export const vaultPathAtom = atom<string | null>(null);

// Vault location atoms (migrating from useVaultLocation hook)
export const currentVaultLocationAtom = atom<string | null>(null);
export const vaultConfigLoadingAtom = atom<boolean>(true);

// Common UI state atoms
export const appLoadingAtom = atom<boolean>(false);
export const appErrorAtom = atom<string | null>(null);

// Notes atoms (existing)
export const notesAtom = atom<NoteMetadata[]>([]);
export const foldersAtom = atom<string[]>([]);
export const notesLoadingAtom = atom<boolean>(false);
export const notesErrorAtom = atom<string | null>(null);
export const selectedNoteIdAtom = atom<string | null>(null);

export const hasVaultSessionAtom = atom((get) => {
  const sessionId = get(sessionIdAtom);
  const vaultInfo = get(vaultInfoAtom);
  const vaultPath = get(vaultPathAtom);

  return !!(sessionId && vaultInfo && vaultPath);
});

// Action atoms for notes (existing)
export const addNoteAtom = atom(
  null,
  (get, set, newNote: NoteMetadata) => {
    const currentNotes = get(notesAtom);
    set(notesAtom, [newNote, ...currentNotes]);
  }
);

export const updateNoteAtom = atom(
  null,
  (get, set, updatedNote: NoteMetadata) => {
    const currentNotes = get(notesAtom);
    const updatedNotes = currentNotes.map(note => 
      note.id === updatedNote.id ? updatedNote : note
    );
    set(notesAtom, updatedNotes);
  }
);

export const removeNoteAtom = atom(
  null,
  (get, set, noteId: string) => {
    const currentNotes = get(notesAtom);
    const filteredNotes = currentNotes.filter(note => note.id !== noteId);
    set(notesAtom, filteredNotes);
  }
);

export const addFolderAtom = atom(
  null,
  (get, set, folderPath: string) => {
    const currentFolders = get(foldersAtom);
    if (!currentFolders.includes(folderPath)) {
      set(foldersAtom, [...currentFolders, folderPath]);
    }
  }
);

// Helper function to generate unique folder names
export const generateUniquefolderNameAtom = atom(
  (get) => (baseName: string = 'New Folder') => {
    const currentFolders = get(foldersAtom);
    
    // Check if base name is available
    if (!currentFolders.includes(baseName)) {
      return baseName;
    }
    
    // Try incrementing numbers
    let counter = 1;
    let candidateName = `${baseName} ${counter}`;
    while (currentFolders.includes(candidateName)) {
      counter++;
      candidateName = `${baseName} ${counter}`;
    }
    
    return candidateName;
  }
);

export const loadNotesAtom = atom(
  null,
  async (_get, set, { vaultPath, sessionId }: { vaultPath: string; sessionId: string }) => {
    set(notesLoadingAtom, true);
    set(notesErrorAtom, null);
    
    try {
      const { api } = await import('../utils/api');
      
      const [notes, folders] = await Promise.all([
        api.getNotesList(vaultPath, sessionId),
        api.getFoldersList(vaultPath, sessionId)
      ]);
      
      const sortedNotes = notes.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      
      set(notesAtom, sortedNotes);
      set(foldersAtom, folders);
      set(notesLoadingAtom, false);
    } catch (error) {
      console.error('Failed to load notes:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load notes';
      set(notesErrorAtom, errorMessage);
      set(notesLoadingAtom, false);
    }
  }
);

// Action atoms for vault session management
export const initializeVaultSessionAtom = atom(
  null,
  async (get, set) => {
    // Check if already loading to prevent multiple simultaneous initializations
    const currentlyLoading = get(appLoadingAtom);
    if (currentlyLoading) {
      return;
    }

    try {
      set(appLoadingAtom, true);
      set(appErrorAtom, null);

      // Load from sessionStorage synchronously first
      const storedSessionId = sessionStorage.getItem('sessionId');
      const storedVaultInfo = sessionStorage.getItem('vaultInfo');
      
      if (storedSessionId && storedVaultInfo) {
        const vaultInfo = JSON.parse(storedVaultInfo);
        
        // Set session data immediately
        set(sessionIdAtom, storedSessionId);
        set(vaultInfoAtom, vaultInfo);
        
        // Load vault path asynchronously
        try {
          const { api } = await import('../utils/api');
          const path = await api.getCurrentVaultLocation();
          
          set(vaultPathAtom, path);
          set(currentVaultLocationAtom, path);
          set(vaultConfigLoadingAtom, false); // Mark config as loaded
        } catch (pathError) {
          console.error('Failed to load vault path:', pathError);
          // Don't fail the entire initialization if path loading fails
          set(vaultConfigLoadingAtom, false); // Mark config as loaded even on error
        }
      } else {
        // No stored session, still need to load current vault location
        try {
          const { api } = await import('../utils/api');
          const path = await api.getCurrentVaultLocation();
          set(currentVaultLocationAtom, path);
          set(vaultConfigLoadingAtom, false); // Mark config as loaded
        } catch (pathError) {
          console.error('Failed to load vault path:', pathError);
          set(vaultConfigLoadingAtom, false); // Mark config as loaded even on error
        }
      }
    } catch (error) {
      console.error('Failed to initialize vault session:', error);
      set(appErrorAtom, error instanceof Error ? error.message : 'Failed to initialize session');
      set(vaultConfigLoadingAtom, false); // Mark config as loaded even on error
    } finally {
      // Always set loading to false, even on error
      set(appLoadingAtom, false);
    }
  }
);

export const clearVaultSessionAtom = atom(
  null,
  async (get, set) => {
    try {
      // Get session ID before clearing
      const sessionId = get(sessionIdAtom);
      
      // Clear session storage
      sessionStorage.removeItem('sessionId');
      sessionStorage.removeItem('vaultInfo');
      
      // Clear atoms
      set(sessionIdAtom, null);
      set(vaultInfoAtom, null);
      set(vaultPathAtom, null);
      set(notesAtom, []);
      set(foldersAtom, []);
      set(selectedNoteIdAtom, null);
      set(appErrorAtom, null);
      
      // Clear vault session on backend if we had a session ID
      if (sessionId) {
        try {
          const { api } = await import('../utils/api');
          await api.closeVaultSession(sessionId);
        } catch (error) {
          console.error('Failed to clear backend session:', error);
        }
      }
    } catch (error) {
      console.error('Failed to clear vault session:', error);
    }
  }
);
