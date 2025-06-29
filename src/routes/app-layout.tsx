import { useEffect, useRef } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router';
import { useAtomValue, useSetAtom } from 'jotai';
import { api } from '../utils/api';
import { MainLayout } from '../components/Layout/MainLayout';
import { useNoteUpdates } from '../hooks/useNoteUpdates';
import { 
  addNoteAtom,
  sessionIdAtom,
  vaultInfoAtom,
  vaultPathAtom,
  hasVaultSessionAtom,
  initializeVaultSessionAtom,
  clearVaultSessionAtom,
  appLoadingAtom
} from '../stores/notesStore';
import type { NoteMetadata } from '../types';

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const initializationRef = useRef(false);
  
  // Use Jotai atoms instead of local state
  const sessionId = useAtomValue(sessionIdAtom);
  const vaultInfo = useAtomValue(vaultInfoAtom);
  const vaultPath = useAtomValue(vaultPathAtom);
  const hasSession = useAtomValue(hasVaultSessionAtom);
  const appLoading = useAtomValue(appLoadingAtom);
  
  const initializeSession = useSetAtom(initializeVaultSessionAtom);
  const clearSession = useSetAtom(clearVaultSessionAtom);
  const { handleNoteUpdated, handleNoteDeleted } = useNoteUpdates();
  const addNote = useSetAtom(addNoteAtom);

  // Extract noteId from URL if we're on a document route
  const selectedNoteId = location.pathname.startsWith('/documents/') 
    ? location.pathname.split('/documents/')[1] || undefined
    : undefined;

  // Redirect invalid document URLs to app
  useEffect(() => {
    if (location.pathname === '/documents/' || location.pathname === '/documents') {
      navigate('/app', { replace: true });
    }
  }, [location.pathname, navigate]);

  // Initialize session on mount - only once using ref to prevent duplicates
  useEffect(() => {
    if (!initializationRef.current) {
      initializationRef.current = true;
      initializeSession();
    }
  }, [initializeSession]);

  // Handle navigation based on session state - simplified
  useEffect(() => {
    // Only redirect when we're certain there's no session and not loading
    if (!appLoading && !hasSession) {
      // Check if we have session data in storage that might not be loaded yet
      const hasStoredSession = sessionStorage.getItem('sessionId') && sessionStorage.getItem('vaultInfo');
      
      if (!hasStoredSession) {
        navigate('/', { replace: true });
      }
    }
  }, [appLoading, hasSession, navigate]);

  // Session management - check session status periodically
  useEffect(() => {
    if (!sessionId) return;

    const checkSession = async () => {
      try {
        const isValid = await api.checkSessionStatus(sessionId);
        if (!isValid) {
          // Session expired, clear and redirect
          await clearSession();
          navigate('/vault-unlock');
        }
      } catch (error) {
        console.error('Failed to check session status:', error);
      }
    };

    // Check session every 5 minutes
    const interval = setInterval(checkSession, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [sessionId, navigate, clearSession]);

  const handleLogout = async () => {
    await clearSession();
    navigate('/');
  };

  const handleSelectNote = (noteId: string) => {
    navigate(`/documents/${noteId}`);
  };

  const handleCreateNote = async () => {
    if (!vaultPath || !sessionId) return;

    try {
      const result = await api.createNote(
        vaultPath,
        sessionId,
        'Untitled',
        '',
        undefined,
        undefined,
        'text'
      );

      if (result.success && result.note) {
        const noteMetadata: NoteMetadata = {
          id: result.note.id,
          title: result.note.title,
          note_type: result.note.note_type,
          content_preview: result.note.content.substring(0, 100),
          created_at: result.note.created_at,
          updated_at: result.note.updated_at,
          tags: result.note.tags,
          ...(result.note.folder_path && { folder_path: result.note.folder_path })
        };
        addNote(noteMetadata);
        navigate(`/documents/${result.note.id}`);
      } else {
        console.error('Failed to create note:', result.error_message);
      }
    } catch (error) {
      console.error('Failed to create note:', error);
    }
  };

  const handleCreateWhiteboard = async () => {
    if (!vaultPath || !sessionId) return;

    try {
      const result = await api.createNote(
        vaultPath,
        sessionId,
        'Untitled Whiteboard',
        '{}',
        undefined,
        undefined,
        'whiteboard'
      );

      if (result.success && result.note) {
        const noteMetadata: NoteMetadata = {
          id: result.note.id,
          title: result.note.title,
          note_type: result.note.note_type,
          content_preview: result.note.content.substring(0, 100),
          created_at: result.note.created_at,
          updated_at: result.note.updated_at,
          tags: result.note.tags,
          ...(result.note.folder_path && { folder_path: result.note.folder_path })
        };
        addNote(noteMetadata);
        navigate(`/documents/${result.note.id}`);
      } else {
        console.error('Failed to create whiteboard:', result.error_message);
      }
    } catch (error) {
      console.error('Failed to create whiteboard:', error);
    }
  };

  // Show loading while session is being initialized
  if (appLoading) {
    return null;
  }

  // Don't render anything if we don't have session info yet
  if (!hasSession) {
    return null;
  }

  return (
    <MainLayout
      vaultInfo={{
        name: vaultInfo!.name,
        isEncrypted: vaultInfo!.is_encrypted,
      }}
      sessionId={sessionId!}
      vaultPath={vaultPath!}
      selectedNoteId={selectedNoteId}
      onLogout={handleLogout}
      onSelectNote={handleSelectNote}
      onCreateNote={handleCreateNote}
      onCreateWhiteboard={handleCreateWhiteboard}
      showSidebar={true}
    >
      <Outlet context={{ 
        sessionId, 
        vaultInfo, 
        vaultPath, 
        handleNoteUpdated, 
        handleNoteDeleted 
      }} />
    </MainLayout>
  );
} 