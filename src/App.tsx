import { useEffect, useState } from 'react';
import { Provider as JotaiProvider, useSetAtom } from 'jotai';
import { 
  Container, 
  Paper, 
  Title, 
  Text, 
  TextInput, 
  Button, 
  Group, 
  Stack, 
  Alert, 
  Badge,
  Box,
  Divider,
  Loader,
  Center
} from '@mantine/core';
import { 
  IconLock, 
  IconAlertTriangle,
  IconCheck
} from '@tabler/icons-react';
import { api } from './utils/api';
import { VaultLocationSelector } from './components/VaultLocationSelector';
import { VaultPasswordSetup } from './components/VaultPasswordSetup';
import { VaultUnlock } from './components/VaultUnlock';

import { MarkdownEditor } from './components/MarkdownEditor';
import { MainLayout } from './components/Layout/MainLayout';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';

import { addNoteAtom } from './stores/notesStore';
import { useNoteUpdates } from './hooks/useNoteUpdates';
import type { AppInfo, AppView, VaultSetupInfo, VaultInfo, Note, NoteMetadata } from './types';

function AppContent() {
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [currentView, setCurrentView] = useState<AppView>('home');
  const [vaultLocation, setVaultLocation] = useState<string | null>(null);
  const [vaultSetupInfo, setVaultSetupInfo] = useState<VaultSetupInfo | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentNote, setCurrentNote] = useState<Note | null>(null);

  // Jotai actions
  const addNote = useSetAtom(addNoteAtom);
  const { handleNoteUpdated, handleNoteDeleted } = useNoteUpdates();

  // Demo state
  const [greetInput, setGreetInput] = useState('');
  const [greetResult, setGreetResult] = useState<string | null>(null);
  const [greetError, setGreetError] = useState<string | null>(null);

  // Component to access theme context
  const MarkdownEditorWrapper = () => {
    const { effectiveTheme } = useTheme();
    
    return currentNote && vaultLocation && sessionId ? (
      <MarkdownEditor
        note={currentNote}
        vaultPath={vaultLocation}
        sessionId={sessionId}
        isDarkMode={effectiveTheme === 'dark'}
                onClose={handleCloseEditor}
        onError={handleEditorError}
        onNoteUpdated={handleNoteUpdated}
        onNoteDeleted={async (noteId: string) => {
          if (vaultLocation && sessionId) {
            const success = await handleNoteDeleted(vaultLocation, sessionId, noteId);
            if (success) {
              // Navigate back to main view after deletion
              setCurrentNote(null);
              setCurrentView('main-app');
            }
          }
        }}
        />
    ) : null;
  };

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [info, location] = await Promise.all([
          api.getAppInfo(),
          api.getCurrentVaultLocation(),
        ]);
        
        setAppInfo(info);
        setVaultLocation(location);
        
        if (location) {
          // Check vault setup status
          const setupInfo = await api.checkVaultSetupStatus(location);
          setVaultSetupInfo(setupInfo);
          
          if (setupInfo.needs_password && !setupInfo.vault_info) {
            // New vault needs password setup
            setCurrentView('password-setup');
          } else if (setupInfo.needs_password && setupInfo.vault_info) {
            // Existing encrypted vault needs unlock
            setCurrentView('vault-unlock');
          } else {
            setCurrentView('home');
          }
        } else {
          // No vault location set
          setCurrentView('vault-setup');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load app data');
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, []);

  // Session management
  useEffect(() => {
    if (!sessionId) return;

    // Check session status periodically
    const checkSession = async () => {
      try {
        const isValid = await api.checkSessionStatus(sessionId);
        if (!isValid) {
          setSessionId(null);
          setCurrentView('vault-unlock');
        }
      } catch (error) {
        console.error('Failed to check session status:', error);
      }
    };

    // Check session every 5 minutes
    const interval = setInterval(checkSession, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [sessionId]);

  const handleGreet = async () => {
    if (!greetInput.trim()) return;
    
    try {
      setGreetError(null);
      const result = await api.greet(greetInput);
      setGreetResult(result);
    } catch (err) {
      setGreetError(err instanceof Error ? err.message : 'Failed to greet');
      setGreetResult(null);
    }
  };

  const handleVaultLocationSet = async (path: string) => {
    setVaultLocation(path);
    
    try {
      // Check if this location needs password setup
      const setupInfo = await api.checkVaultSetupStatus(path);
      setVaultSetupInfo(setupInfo);
      
      if (setupInfo.needs_password && !setupInfo.vault_info) {
        // New vault needs password setup
        setCurrentView('password-setup');
      } else if (setupInfo.needs_password && setupInfo.vault_info) {
        // Existing encrypted vault needs unlock
        setCurrentView('vault-unlock');
      } else {
        setCurrentView('home');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check vault setup');
    }
  };

  const handleVaultCreated = (vaultInfo: VaultInfo) => {
    setVaultSetupInfo({
      needs_password: false,
      is_encrypted: true,
      vault_info: vaultInfo,
    });
    setCurrentView('home');
  };

  const handleVaultUnlocked = (newSessionId: string, vaultInfo: VaultInfo) => {
    setSessionId(newSessionId);
    setVaultSetupInfo({
      needs_password: false,
      is_encrypted: true,
      vault_info: vaultInfo,
    });
    setCurrentView('main-app');
  };

  const handlePasswordSetupCancel = () => {
    setCurrentView('vault-setup');
  };

  const handleVaultUnlockCancel = () => {
    setCurrentView('vault-setup');
  };

  const handleLogout = async () => {
    if (sessionId) {
      try {
        await api.closeVaultSession(sessionId);
      } catch (error) {
        console.error('Failed to close session:', error);
      }
      setSessionId(null);
    }
    setCurrentView('vault-unlock');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleGreet();
    }
  };

  const handleCreateNote = async () => {
    if (!vaultLocation || !sessionId) return;

    try {
      const result = await api.createNote(
        vaultLocation,
        sessionId,
        'Untitled Note',
        '',
        undefined,
        undefined
      );

      if (result.success && result.note) {
        // Add to store - convert Note to NoteMetadata
        const noteMetadata: NoteMetadata = {
          id: result.note.id,
          title: result.note.title,
          content_preview: result.note.content.substring(0, 100),
          created_at: result.note.created_at,
          updated_at: result.note.updated_at,
          tags: result.note.tags,
          ...(result.note.folder_path && { folder_path: result.note.folder_path })
        };
        addNote(noteMetadata);
        
        // Navigate to editor
        setCurrentNote(result.note);
        setCurrentView('edit-note');
      }
    } catch (error) {
      console.error('Failed to create note:', error);
    }
  };

  const handleSelectNote = async (noteId: string) => {
    if (!vaultLocation || !sessionId) return;

    // Handle deselection case
    if (!noteId || noteId === '') {
      setCurrentNote(null);
      setCurrentView('main-app');
      return;
    }

    try {
      const note = await api.loadNote(vaultLocation, sessionId, noteId);
      setCurrentNote(note);
      setCurrentView('edit-note');
    } catch (error) {
      console.error('Failed to load note:', error);
    }
  };

  const handleCloseEditor = () => {
    setCurrentNote(null);
    setCurrentView('main-app');
  };

  const handleEditorError = (errorMessage: string) => {
    setError(errorMessage);
  };

  const handleNavigate = (view: string) => {
    switch (view) {
      case 'home':
        setCurrentView('home');
        break;
      case 'main-app':
        setCurrentView('main-app');
        break;
      case 'create-note':
        handleCreateNote();
        break;
      case 'notes-list':
        setCurrentView('main-app');
        break;
      default:
        console.warn('Unknown navigation view:', view);
    }
  };

  if (loading) {
    return (
      <Container size="sm" py="xl">
        <Center>
          <Stack align="center" gap="md">
            <Loader size="lg" />
            <Text size="lg">Loading Cocobolo...</Text>
          </Stack>
        </Center>
      </Container>
    );
  }

  if (error) {
    return (
      <Container size="sm" py="xl">
        <Alert
          icon={<IconAlertTriangle size={16} />}
          title="Error"
          color="red"
          variant="light"
        >
          {error}
        </Alert>
      </Container>
    );
  }

  const renderContent = () => {
    switch (currentView) {
      case 'vault-setup':
        return <VaultLocationSelector onLocationSet={handleVaultLocationSet} />;
      
      case 'password-setup':
        return vaultLocation ? (
          <VaultPasswordSetup
            vaultPath={vaultLocation}
            onVaultCreated={handleVaultCreated}
            onCancel={handlePasswordSetupCancel}
          />
        ) : null;
      
      case 'vault-unlock':
        return vaultLocation && vaultSetupInfo?.vault_info ? (
          <VaultUnlock
            vaultPath={vaultLocation}
            vaultInfo={vaultSetupInfo.vault_info}
            onVaultUnlocked={handleVaultUnlocked}
            onCancel={handleVaultUnlockCancel}
          />
        ) : null;
      
      case 'main-app':
        return vaultSetupInfo?.vault_info && sessionId ? (
          <Container size="lg" py="xl">
            <Paper p="xl" radius="lg" shadow="md">
              <Stack align="center" gap="xl">
                <Box ta="center">
                  <Title order={2} mb="md">Welcome to your secure vault!</Title>
                  <Text size="lg" c="dimmed">
                    Select a note from the sidebar to get started, or create a new note.
                  </Text>
                </Box>
              </Stack>
            </Paper>
          </Container>
        ) : null;

      case 'create-note':
        // This case is no longer used - notes are created directly in the editor
        return null;

      case 'notes-list':
        // Redirect to main-app since we now use tree navigation in sidebar
        setCurrentView('main-app');
        return null;
      
      case 'home':
        return (
          <Container size="md" py="xl">
            <Stack gap="xl">
              <Paper p="xl" radius="lg" shadow="md">
                <Stack gap="xl">
                  <Box ta="center">
                    <Title order={2} mb="md">Welcome to Cocobolo!</Title>
                    <Text size="lg" c="dimmed">
                      Your secure, encrypted note-taking companion
                    </Text>
                  </Box>
                  
                  {vaultSetupInfo?.vault_info && (
                    <>
                      <Divider />
                      <Box>
                        <Title order={3} mb="md">Current Vault</Title>
                        <Paper p="md" radius="md" withBorder>
                          <Stack gap="md">
                            <Group justify="space-between" align="start">
                              <Box>
                                <Title order={4} mb="xs">{vaultSetupInfo.vault_info.name}</Title>
                                <Group gap="xs">
                                  {vaultSetupInfo.is_encrypted && (
                                    <Badge leftSection={<IconLock size={12} />} variant="light" color="blue">
                                      Encrypted
                                    </Badge>
                                  )}
                                  <Badge variant="light" color="gray">
                                    v{vaultSetupInfo.vault_info.version}
                                  </Badge>
                                </Group>
                              </Box>
                            </Group>
                            
                            <Stack gap="xs">
                              <Text size="sm">
                                <Text span fw={500}>Location:</Text> {vaultLocation}
                              </Text>
                              <Text size="sm">
                                <Text span fw={500}>Created:</Text> {new Date(vaultSetupInfo.vault_info.created_at).toLocaleDateString()}
                              </Text>
                            </Stack>
                            
                            {vaultSetupInfo.is_encrypted && (
                              <Button 
                                leftSection={<IconLock size={16} />}
                                onClick={() => setCurrentView('vault-unlock')}
                                size="md"
                              >
                                Unlock Vault
                              </Button>
                            )}
                          </Stack>
                        </Paper>
                      </Box>
                    </>
                  )}
                </Stack>
              </Paper>

              <Paper p="xl" radius="lg" shadow="md">
                <Stack gap="lg">
                  <Title order={3}>Demo Greeting</Title>
                  
                  <Group>
                    <TextInput
                      placeholder="Enter your name"
                      value={greetInput}
                      onChange={(e) => setGreetInput(e.target.value)}
                      onKeyDown={handleKeyPress}
                      style={{ flex: 1 }}
                    />
                    <Button onClick={handleGreet}>
                      Greet
                    </Button>
                  </Group>
                  
                  {greetResult && (
                    <Alert
                      icon={<IconCheck size={16} />}
                      title="Success"
                      color="green"
                      variant="light"
                    >
                      {greetResult}
                    </Alert>
                  )}
                  
                  {greetError && (
                    <Alert
                      icon={<IconAlertTriangle size={16} />}
                      title="Error"
                      color="red"
                      variant="light"
                    >
                      {greetError}
                    </Alert>
                  )}
                </Stack>
              </Paper>
            </Stack>
          </Container>
        );
      
      case 'edit-note':
        return <MarkdownEditorWrapper />;
      
      default:
        return null;
    }
  };

  // For setup views, use simple container layout
  if (['vault-setup', 'password-setup', 'vault-unlock', 'home', 'create-note'].includes(currentView)) {
    return (
      <ThemeProvider>
        <Container size="lg" py="xl">
          <Stack gap="xl">
            <Paper p="lg" radius="lg" shadow="sm" ta="center">
              <Group justify="center" gap="sm" mb="md">
                <IconLock size={32} />
                <Title order={1}>Cocobolo</Title>
              </Group>
              <Text size="lg" c="dimmed" mb="sm">
                Secure Note-Taking Application
              </Text>
              {appInfo && (
                <Badge variant="light" color="gray" size="sm">
                  v{appInfo.version}
                </Badge>
              )}
            </Paper>

            {renderContent()}
          </Stack>
        </Container>
      </ThemeProvider>
    );
  }

  // For main app and editor, use full layout
  return (
    <ThemeProvider>
      <MainLayout
        {...(vaultSetupInfo?.vault_info && {
          vaultInfo: {
            name: vaultSetupInfo.vault_info.name,
            isEncrypted: vaultSetupInfo.is_encrypted
          }
        })}
        {...(sessionId && { sessionId })}
        {...(vaultLocation && { vaultPath: vaultLocation })}
        {...(currentNote?.id && { selectedNoteId: currentNote.id })}
        onLogout={handleLogout}
        onSelectNote={handleSelectNote}
        onCreateNote={handleCreateNote}
        onNavigate={handleNavigate}
      >
        {renderContent()}
      </MainLayout>
    </ThemeProvider>
  );
}

function App() {
  return (
    <JotaiProvider>
      <AppContent />
    </JotaiProvider>
  );
}

export default App;
