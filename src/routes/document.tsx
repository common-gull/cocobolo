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
import type { Note } from '../types';

// Lazy load the editor components for better performance
const MarkdownEditor = lazy(() => import('../components/MarkdownEditor').then(module => ({ default: module.MarkdownEditor })));
const WhiteboardEditor = lazy(() => import('../components/WhiteboardEditor').then(module => ({ default: module.WhiteboardEditor })));

// Preload the components to reduce loading time
const preloadComponents = () => {
  import('../components/MarkdownEditor');
  import('../components/WhiteboardEditor');
};

// Start preloading when this module loads
preloadComponents();

interface AppContext {
  sessionId: string;
  vaultInfo: any;
  vaultPath: string;
  handleNoteUpdated: (note: any) => void;
  handleNoteDeleted: (vaultPath: string, sessionId: string, noteId: string) => Promise<boolean>;
}

export default function Document() {
  const { noteId } = useParams<{ noteId: string }>();
  const navigate = useNavigate();
  const { effectiveTheme } = useTheme();
  const { sessionId, vaultPath, handleNoteUpdated, handleNoteDeleted } = useOutletContext<AppContext>();
  
  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!noteId || !sessionId || !vaultPath) return;

    // Only load the note if it's different from the currently loaded one
    if (note && note.id === noteId) {
      setLoading(false);
      return;
    }

    const loadNote = async () => {
      try {
        setLoading(true);
        setError(null);
        const loadedNote = await api.loadNote(vaultPath, sessionId, noteId);
        setNote(loadedNote);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load note');
      } finally {
        setLoading(false);
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

  const handleNoteDeletedLocal = useCallback(async (noteIdToDelete: string) => {
    if (vaultPath && sessionId) {
      const success = await handleNoteDeleted(vaultPath, sessionId, noteIdToDelete);
      if (success) {
        // Navigate back to main view after deletion
        navigate('/app', { replace: true });
      }
    }
  }, [vaultPath, sessionId, handleNoteDeleted, navigate]);

  if (loading) {
    return (
      <Center h="100%">
        <Stack align="center" gap="md">
          <Loader size="lg" />
          <Text>Loading note...</Text>
        </Stack>
      </Center>
    );
  }

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
          noteId={note.id}
          onSaved={async (noteId: string) => {
            // Reload the note after save
            try {
              const updatedNote = await api.loadNote(vaultPath, sessionId, noteId);
              setNote(updatedNote);
              handleNoteUpdated(updatedNote);
            } catch (err) {
              console.error('Failed to reload note after save:', err);
            }
          }}
          onCancel={handleCloseEditor}
          onError={handleEditorError}
          onNoteUpdated={handleNoteUpdated}
          onNoteDeleted={async (noteId: string) => {
            await handleNoteDeletedLocal(noteId);
          }}
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