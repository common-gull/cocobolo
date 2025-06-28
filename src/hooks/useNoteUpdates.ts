import { useSetAtom } from 'jotai';
import { updateNoteAtom, deleteNoteAtom } from '../stores/notesStore';
import type { Note, NoteMetadata } from '../types';

export function useNoteUpdates() {
  const updateNote = useSetAtom(updateNoteAtom);
  const deleteNote = useSetAtom(deleteNoteAtom);

  const handleNoteUpdated = (updatedNote: Note) => {
    // Convert Note to NoteMetadata for the store
    const noteMetadata: NoteMetadata = {
      id: updatedNote.id,
      title: updatedNote.title,
      content_preview: updatedNote.content.substring(0, 100),
      created_at: updatedNote.created_at,
      updated_at: updatedNote.updated_at,
      tags: updatedNote.tags
    };
    
    if (updatedNote.folder_path) {
      noteMetadata.folder_path = updatedNote.folder_path;
    }
    
    updateNote(noteMetadata);
  };

  const handleNoteDeleted = async (vaultPath: string, sessionId: string, noteId: string): Promise<boolean> => {
    return await deleteNote({ vaultPath, sessionId, noteId });
  };

  return { handleNoteUpdated, handleNoteDeleted };
} 