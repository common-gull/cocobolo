import { 
  Container, 
  Loader,
  Center,
  Alert,
  Stack,
  Text
} from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import { useAtomValue, useSetAtom } from 'jotai';
import { useEffect, useState, lazy, Suspense, useCallback } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router';

import { WhiteboardEditor } from '../components/WhiteboardEditor';
import { useTheme } from '../hooks/useTheme';
import { notesAtom, updateNoteAtom, removeNoteAtom } from '../stores/notesStore';
import type { Note, NoteMetadata } from '../types';
import { api } from '../utils/api';

// Lazy load the editor components for better performance
const MarkdownEditor = lazy(() => import('../components/MarkdownEditor').then(module => ({ default: module.MarkdownEditor })));

// Preload the components to reduce loading time
const preloadComponents = () => {
  import('../components/MarkdownEditor');
};

// Start preloading when this module loads
preloadComponents();

interface AppContext {
  sessionId: string;
  vaultInfo: any;
  vaultPath: string;
}

export default function Document() {
  const { noteId } = useParams<{ noteId: string }>();
  const navigate = useNavigate();
  const { effectiveTheme } = useTheme();
  const { sessionId, vaultPath } = useOutletContext<AppContext>();
  
  const [note, setNote] = useState<Note | null>(null);
  const [error, setError] = useState<string | null>(null);

  // State management hooks
  const notes = useAtomValue(notesAtom);
  const updateNote = useSetAtom(updateNoteAtom);
  const removeNote = useSetAtom(removeNoteAtom);

  // Check if note still exists and navigate back if it doesn't
  useEffect(() => {
    if (!noteId) return;

    // Check if the note exists in the current notes state
    const noteExists = notes.some(note => note.id === noteId);
    
    // If notes array is not empty and the note doesn't exist, navigate back
    if (notes.length > 0 && !noteExists) {
      navigate('/app', { replace: true });
    }
  }, [noteId, notes, navigate]);

  // Note update handler
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

  useEffect(() => {
    if (!noteId || !sessionId || !vaultPath) return;

    // Only load the note if it's different from the currently loaded one
    if (note && note.id === noteId) {
      return;
    }

    const loadNote = async () => {
      try {
        setError(null);
        const loadedNote = await api.loadNote(vaultPath, sessionId, noteId);
        setNote(loadedNote);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load note');
      }
    };

    loadNote();
  }, [noteId, sessionId, vaultPath, note]);

  const handleCloseEditor = useCallback(() => {
    navigate('/app');
  }, [navigate]);

  const handleEditorError = useCallback((errorMessage: string) => {
    setError(errorMessage);
  }, []);

  const handleNoteDeleted = useCallback((noteIdToDelete: string) => {
    // Remove from state and navigate back
    removeNote(noteIdToDelete);
    navigate('/app', { replace: true });
  }, [removeNote, navigate]);

  if (error) {
    return (
      <Container size="sm" mt="xl">
        <Alert icon={<IconAlertTriangle size={16} />} title="Error" color="red">
          {error}
        </Alert>
      </Container>
    );
  }

  if (!note) {
    return (
      <Container size="sm" mt="xl">
        <Alert icon={<IconAlertTriangle size={16} />} title="Note Not Found" color="yellow">
          The requested note could not be found.
        </Alert>
      </Container>
    );
  }

  return (
    <Suspense fallback={
      <Center h="100%">
        <Stack align="center" gap="md">
          <Loader size="lg" />
          <Text>Loading editor...</Text>
        </Stack>
      </Center>
    }>
      {note.note_type === 'whiteboard' ? (
        <WhiteboardEditor
          vaultPath={vaultPath}
          sessionId={sessionId}
          note={note}
          onCancel={handleCloseEditor}
          onError={handleEditorError}
          onNoteUpdated={handleNoteUpdated}
          onNoteDeleted={handleNoteDeleted}
        />
      ) : (
        <MarkdownEditor
          note={note}
          vaultPath={vaultPath}
          sessionId={sessionId}
          isDarkMode={effectiveTheme === 'dark'}
          onClose={handleCloseEditor}
          onError={handleEditorError}
          onNoteUpdated={handleNoteUpdated}
          onNoteDeleted={handleNoteDeleted}
        />
      )}
    </Suspense>
  );
} 