import { useEffect } from 'react';
import { useAtomValue } from 'jotai';
import { useNavigate } from 'react-router';
import { notesAtom } from '../stores/notesStore';

/**
 * Hook to check if a note still exists in the state
 * Navigates back to /app if the note no longer exists
 */
export function useNoteExistence(noteId?: string) {
  const notes = useAtomValue(notesAtom);
  const navigate = useNavigate();

  useEffect(() => {
    if (!noteId) return;

    // Check if the note exists in the current notes state
    const noteExists = notes.some(note => note.id === noteId);
    
    // If notes array is not empty and the note doesn't exist, navigate back
    if (notes.length > 0 && !noteExists) {
      navigate('/app', { replace: true });
    }
  }, [noteId, notes, navigate]);
} 