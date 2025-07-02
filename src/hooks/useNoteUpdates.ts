import { useSetAtom } from 'jotai';
import { updateNoteAtom, removeNoteAtom } from '../stores/notesStore';
import type { Note, NoteMetadata } from '../types';

export function useNoteUpdates() {
  const updateNote = useSetAtom(updateNoteAtom);
  const removeNote = useSetAtom(removeNoteAtom);

  const handleNoteUpdated = (updatedNote: Note) => {
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
  };

  const handleNoteRemoved = (noteId: string) => {
    removeNote(noteId);
  };

  return { handleNoteUpdated, handleNoteRemoved };
} 