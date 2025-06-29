import { useSetAtom } from 'jotai';
import { updateNoteAtom, deleteNoteAtom } from '../stores/notesStore';
import type { Note, NoteMetadata } from '../types';
import { useCallback } from 'react';

export function useNoteUpdates() {
  const updateNote = useSetAtom(updateNoteAtom);
  const deleteNote = useSetAtom(deleteNoteAtom);

  const handleNoteUpdated = useCallback((updatedNote: Note) => {
    const noteMetadata: NoteMetadata = {
      id: updatedNote.id,
      title: updatedNote.title,
      note_type: updatedNote.note_type,
      content_preview: updatedNote.content.substring(0, 100),
      created_at: updatedNote.created_at,
      updated_at: updatedNote.updated_at,
      tags: updatedNote.tags,
      ...(updatedNote.folder_path && { folder_path: updatedNote.folder_path })
    };
    
    updateNote(noteMetadata);
  }, [updateNote]);

  const handleNoteDeleted = async (vaultPath: string, sessionId: string, noteId: string): Promise<boolean> => {
    return await deleteNote({ vaultPath, sessionId, noteId });
  };

  return { handleNoteUpdated, handleNoteDeleted };
} 