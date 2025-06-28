import { useEffect, useState } from 'react';
import { Provider as JotaiProvider, useSetAtom } from 'jotai';
import { api } from './utils/api';
import { VaultLocationSelector } from './components/VaultLocationSelector';
import { VaultPasswordSetup } from './components/VaultPasswordSetup';
import { VaultUnlock } from './components/VaultUnlock';

import { MarkdownEditor } from './components/MarkdownEditor';
import { MainLayout } from './components/Layout/MainLayout';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { Icons } from './components/Icons';
import { addNoteAtom } from './stores/notesStore';
import { useNoteUpdates } from './hooks/useNoteUpdates';
import type { AppInfo, AppView, VaultSetupInfo, VaultInfo, Note, NoteMetadata } from './types';
import './App.css';

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
    if (!vaultLocation || !sessionId) {
      setError('Vault not available');
      return;
    }

    try {
      // Create a new note with undefined title
      const result = await api.createNote(vaultLocation, sessionId);
      if (result.success && result.note) {
        // Add note to Jotai store
        const noteMetadata: NoteMetadata = {
          id: result.note.id,
          title: result.note.title,
          content_preview: result.note.content.substring(0, 100),
          created_at: result.note.created_at,
          updated_at: result.note.updated_at,
          tags: result.note.tags
        };
        if (result.note.folder_path) {
          noteMetadata.folder_path = result.note.folder_path;
        }
        addNote(noteMetadata);
        
        setCurrentNote(result.note);
        setCurrentView('edit-note');
      } else {
        setError(result.error_message || 'Failed to create note');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create note');
    }
  };



  const handleSelectNote = async (noteId: string) => {
    if (!vaultLocation || !sessionId) {
      setError('Vault not available');
      return;
    }

    try {
      const note = await api.loadNote(vaultLocation, sessionId, noteId);
      setCurrentNote(note);
      setCurrentView('edit-note');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load note');
    }
  };

  const handleCloseEditor = () => {
    setCurrentNote(null);
    setCurrentView('notes-list');
  };

  const handleEditorError = (errorMessage: string) => {
    setError(errorMessage);
  };

  const handleNavigate = (view: string) => {
    setCurrentView(view as AppView);
  };

  if (loading) {
    return (
      <div className="loading">
        Loading Cocobolo...
      </div>
    );
  }

  if (error) {
    return (
      <div className="container">
        <div className="error-message">
          {error}
        </div>
      </div>
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
          <div className="main-app-content">
            <div className="welcome-header">
              <h2>Welcome to your secure vault!</h2>
              <p>Select a note from the sidebar to get started, or create a new note.</p>
            </div>
          </div>
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
          <div className="home-view">
            <div className="welcome-section">
              <h2>Welcome to Cocobolo!</h2>
              <p>Your secure, encrypted note-taking companion</p>
              
              {vaultSetupInfo?.vault_info && (
                <div className="vault-info-display">
                  <h3>Current Vault</h3>
                  <div className="vault-card">
                    <div className="vault-header">
                      <h4>{vaultSetupInfo.vault_info.name}</h4>
                      <div className="vault-badges">
                        {vaultSetupInfo.is_encrypted && (
                          <span className="encryption-badge">
                            <Icons.lock size="xs" />
                            Encrypted
                          </span>
                        )}
                        <span className="version-badge">v{vaultSetupInfo.vault_info.version}</span>
                      </div>
                    </div>
                    <div className="vault-details">
                      <p><strong>Location:</strong> {vaultLocation}</p>
                      <p><strong>Created:</strong> {new Date(vaultSetupInfo.vault_info.created_at).toLocaleDateString()}</p>
                    </div>
                    
                    {vaultSetupInfo.is_encrypted && (
                      <button 
                        className="unlock-vault-button primary"
                        onClick={() => setCurrentView('vault-unlock')}
                      >
                        <Icons.lock size="sm" />
                        Unlock Vault
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="demo-section">
              <h3>Demo Greeting</h3>
              <div className="demo-form">
                <input
                  type="text"
                  value={greetInput}
                  onChange={(e) => setGreetInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Enter your name"
                  className="demo-input"
                />
                <button onClick={handleGreet} className="demo-button">
                  Greet
                </button>
              </div>
              
              {greetResult && (
                <div className="demo-result success">
                  {greetResult}
                </div>
              )}
              
              {greetError && (
                <div className="demo-result error">
                  Error: {greetError}
                </div>
              )}
            </div>
          </div>
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
        <div className="container">
          <header className="app-header">
            <h1>
              <Icons.lock size="lg" />
              Cocobolo
            </h1>
            <p>Secure Note-Taking Application</p>
            {appInfo && (
              <div className="app-info">
                <span>v{appInfo.version}</span>
              </div>
            )}
          </header>

          <main className="app-main">
            {renderContent()}
          </main>
        </div>
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
