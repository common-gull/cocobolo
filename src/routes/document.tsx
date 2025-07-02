import { useEffect, useState, lazy, Suspense, useCallback } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router';
import { 
  Container, 
  Loader,
  Center,
  Alert,
  Stack,
  Text
} from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import { api } from '../utils/api';
import { useTheme } from '../hooks/useTheme';
import { useNoteExistence } from '../hooks/useNoteExistence';
import type { Note } from '../types';
import { WhiteboardEditor } from '../components/WhiteboardEditor';

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
  handleNoteUpdated: (note: any) => void;
  handleNoteRemoved: (noteId: string) => void;
}

export default function Document() {
  const { noteId } = useParams<{ noteId: string }>();
  const navigate = useNavigate();
  const { effectiveTheme } = useTheme();
  const { sessionId, vaultPath, handleNoteUpdated, handleNoteRemoved } = useOutletContext<AppContext>();
  
  const [note, setNote] = useState<Note | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Check if note still exists and navigate back if it doesn't
  useNoteExistence(noteId);

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

  const handleNoteDeletedLocal = useCallback((noteIdToDelete: string) => {
    // Remove from state and navigate back
    handleNoteRemoved(noteIdToDelete);
    navigate('/app', { replace: true });
  }, [handleNoteRemoved, navigate]);

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
          onNoteDeleted={handleNoteDeletedLocal}
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
          onNoteDeleted={handleNoteDeletedLocal}
        />
      )}
    </Suspense>
  );
} 