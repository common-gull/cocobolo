import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import type { NoteMetadata, VaultInfo } from '../types';

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
export const selectedVaultPathAtom = atom<string | null>(null);
export const vaultValidationLoadingAtom = atom<boolean>(false);
export const vaultValidationResultAtom = atom<any>(null);
export const vaultLocationErrorAtom = atom<string | null>(null);

// Common UI state atoms
export const appLoadingAtom = atom<boolean>(false);
export const appErrorAtom = atom<string | null>(null);

// Notes atoms (existing)
export const notesAtom = atom<NoteMetadata[]>([]);
export const foldersAtom = atom<string[]>([]);
export const notesLoadingAtom = atom<boolean>(false);
export const notesErrorAtom = atom<string | null>(null);
export const selectedNoteIdAtom = atom<string | null>(null);

// Derived atoms
export const notesWithFoldersAtom = atom((get) => {
  const notes = get(notesAtom);
  const folders = get(foldersAtom);
  return { notes, folders };
});

export const hasVaultSessionAtom = atom((get) => {
  const sessionId = get(sessionIdAtom);
  const vaultInfo = get(vaultInfoAtom);
  const vaultPath = get(vaultPathAtom);
  
  const hasSession = !!(sessionId && vaultInfo && vaultPath);
  
  return hasSession;
});

export const vaultLocationChangesAtom = atom((get) => {
  const currentLocation = get(currentVaultLocationAtom);
  const selectedPath = get(selectedVaultPathAtom);
  
  return {
    currentLocation,
    isSet: !!selectedPath,
    hasChanged: !!selectedPath && selectedPath !== currentLocation
  };
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

export const deleteNoteAtom = atom(
  null,
  async (get, set, { vaultPath, sessionId, noteId }: { vaultPath: string; sessionId: string; noteId: string }) => {
    try {
      const { api } = await import('../utils/api');
      const success = await api.deleteNote(vaultPath, sessionId, noteId);
      
      if (success) {
        const currentNotes = get(notesAtom);
        const filteredNotes = currentNotes.filter(note => note.id !== noteId);
        set(notesAtom, filteredNotes);
      }
      
      return success;
    } catch (error) {
      console.error('Failed to delete note:', error);
      return false;
    }
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
        } catch (pathError) {
          console.error('Failed to load vault path:', pathError);
          // Don't fail the entire initialization if path loading fails
        }
      }
    } catch (error) {
      console.error('Failed to initialize vault session:', error);
      set(appErrorAtom, error instanceof Error ? error.message : 'Failed to initialize session');
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

// Action atoms for vault location management
export const validateVaultLocationAtom = atom(
  null,
  async (_get, set, path: string) => {
    try {
      set(selectedVaultPathAtom, path);
      set(vaultValidationLoadingAtom, true);
      set(vaultValidationResultAtom, null);
      set(vaultLocationErrorAtom, null);

      const { api } = await import('../utils/api');
      const validationResult = await api.validateVaultLocation(path);
      
      set(vaultValidationResultAtom, validationResult);
      set(vaultValidationLoadingAtom, false);
    } catch (error) {
      set(vaultValidationLoadingAtom, false);
      set(vaultLocationErrorAtom, error instanceof Error ? error.message : 'Unknown error');
    }
  }
);

export const confirmVaultLocationAtom = atom(
  null,
  async (get, set) => {
    const selectedPath = get(selectedVaultPathAtom);
    const validationResult = get(vaultValidationResultAtom);
    
    if (!selectedPath || !validationResult?.is_valid) {
      return false;
    }

    try {
      set(vaultLocationErrorAtom, null);
      
      const { api } = await import('../utils/api');
      await api.setVaultLocation(selectedPath);
      set(currentVaultLocationAtom, selectedPath);
      set(vaultValidationResultAtom, null);
      
      return true;
    } catch (error) {
      set(vaultLocationErrorAtom, error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }
); 