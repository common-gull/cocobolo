import { useEffect, useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router';
import { useSetAtom } from 'jotai';
import { api } from '../utils/api';
import { MainLayout } from '../components/Layout/MainLayout';
import { useNoteUpdates } from '../hooks/useNoteUpdates';
import { addNoteAtom } from '../stores/notesStore';
import type { VaultInfo, NoteMetadata } from '../types';

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [vaultInfo, setVaultInfo] = useState<VaultInfo | null>(null);
  const [vaultPath, setVaultPath] = useState<string | null>(null);
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

  useEffect(() => {
    // Get session info from sessionStorage
    const storedSessionId = sessionStorage.getItem('sessionId');
    const storedVaultInfo = sessionStorage.getItem('vaultInfo');
    
    if (storedSessionId && storedVaultInfo) {
      setSessionId(storedSessionId);
      setVaultInfo(JSON.parse(storedVaultInfo));
    } else {
      // No valid session, redirect to home
      navigate('/');
      return;
    }

    // Get vault path
    const loadVaultPath = async () => {
      try {
        const path = await api.getCurrentVaultLocation();
        setVaultPath(path);
      } catch (error) {
        console.error('Failed to get vault path:', error);
      }
    };

    loadVaultPath();
  }, [navigate]);

  // Session management
  useEffect(() => {
    if (!sessionId) return;

    // Check session status periodically
    const checkSession = async () => {
      try {
        const isValid = await api.checkSessionStatus(sessionId);
        if (!isValid) {
          // Session expired, clear storage and redirect
          sessionStorage.removeItem('sessionId');
          sessionStorage.removeItem('vaultInfo');
          navigate('/vault-unlock');
        }
      } catch (error) {
        console.error('Failed to check session status:', error);
      }
    };

    // Check session every 5 minutes
    const interval = setInterval(checkSession, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [sessionId, navigate]);

  const handleLogout = async () => {
    if (sessionId) {
      try {
        await api.closeVaultSession(sessionId);
      } catch (error) {
        console.error('Failed to logout:', error);
      }
    }
    
    // Clear session storage
    sessionStorage.removeItem('sessionId');
    sessionStorage.removeItem('vaultInfo');
    
    // Navigate to home
    navigate('/');
  };

  const handleSelectNote = (noteId: string) => {
    console.log('handleSelectNote called with noteId:', noteId);
    navigate(`/documents/${noteId}`);
  };

  const handleCreateNote = async () => {
    try {
      const result = await api.createNote(
        vaultPath!,
        sessionId!,
        'Untitled',
        '',
        undefined,
        undefined,
        'text'
      );

      if (result.success && result.note) {
        // Convert Note to NoteMetadata and add to store
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
    console.log('handleCreateWhiteboard called - this should only happen when create button is clicked');
    try {
      const result = await api.createNote(
        vaultPath!,
        sessionId!,
        'Untitled Whiteboard',
        '{}',
        undefined,
        undefined,
        'whiteboard'
      );

      if (result.success && result.note) {
        // Convert Note to NoteMetadata and add to store
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

  // Don't render anything if we don't have session info yet
  if (!sessionId || !vaultInfo || !vaultPath) {
    return null;
  }

  return (
    <MainLayout
      vaultInfo={{
        name: vaultInfo.name,
        isEncrypted: vaultInfo.is_encrypted,
      }}
      sessionId={sessionId}
      vaultPath={vaultPath}
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