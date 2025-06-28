import { atom } from 'jotai';
import type { NoteMetadata } from '../types';

// Base atoms
export const notesAtom = atom<NoteMetadata[]>([]);
export const foldersAtom = atom<string[]>([]);
export const notesLoadingAtom = atom<boolean>(false);
export const notesErrorAtom = atom<string | null>(null);
export const selectedNoteIdAtom = atom<string | null>(null);

// Derived atom for notes with folders
export const notesWithFoldersAtom = atom((get) => {
  const notes = get(notesAtom);
  const folders = get(foldersAtom);
  return { notes, folders };
});

// Action atoms for updating notes
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

// Action atom for deleting a note (calls backend and updates store)
export const deleteNoteAtom = atom(
  null,
  async (get, set, { vaultPath, sessionId, noteId }: { vaultPath: string; sessionId: string; noteId: string }) => {
    try {
      const { api } = await import('../utils/api');
      const success = await api.deleteNote(vaultPath, sessionId, noteId);
      
      if (success) {
        // Remove from store
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

// Action atom for loading notes
export const loadNotesAtom = atom(
  null,
  async (_get, set, { vaultPath, sessionId }: { vaultPath: string; sessionId: string }) => {
    set(notesLoadingAtom, true);
    set(notesErrorAtom, null);
    
    try {
      const { api } = await import('../utils/api');
      
      // Fetch both notes and folders
      const [notes, folders] = await Promise.all([
        api.getNotesList(vaultPath, sessionId),
        api.getFoldersList(vaultPath, sessionId)
      ]);
      

      
      // Sort notes by creation date (newest first)
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