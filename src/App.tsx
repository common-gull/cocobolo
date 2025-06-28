import { useEffect, useState } from 'react';
import { api } from './utils/api';
import { VaultLocationSelector } from './components/VaultLocationSelector';
import { VaultPasswordSetup } from './components/VaultPasswordSetup';
import { VaultUnlock } from './components/VaultUnlock';
import { CreateNote } from './components/CreateNote';
import { NotesList } from './components/NotesList';
import { MainLayout } from './components/Layout/MainLayout';
import { ThemeProvider } from './contexts/ThemeContext';
import type { AppInfo, AppView, VaultSetupInfo, VaultInfo } from './types';
import './App.css';

function App() {
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [currentView, setCurrentView] = useState<AppView>('home');
  const [vaultLocation, setVaultLocation] = useState<string | null>(null);
  const [vaultSetupInfo, setVaultSetupInfo] = useState<VaultSetupInfo | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Demo state
  const [greetInput, setGreetInput] = useState('');
  const [greetResult, setGreetResult] = useState<string | null>(null);
  const [greetError, setGreetError] = useState<string | null>(null);

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

  const handleCreateNote = () => {
    setCurrentView('create-note');
  };

  const handleNoteCreated = (noteId: string) => {
    console.log('Note created:', noteId);
    setCurrentView('notes-list');
  };

  const handleCancelCreateNote = () => {
    setCurrentView('main-app');
  };

  const handleViewNotes = () => {
    setCurrentView('notes-list');
  };

  const handleSelectNote = (noteId: string) => {
    // TODO: Implement note viewing/editing
    console.log('Selected note:', noteId);
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
              <p>Your vault is now unlocked and ready to use. Start creating and organizing your encrypted notes.</p>
            </div>
            
            <div className="dashboard-grid">
              <div className="dashboard-card">
                <h3>
                  <span className="icon icon-file"></span>
                  Notes
                </h3>
                <p>Create, edit, and organize your encrypted notes.</p>
                <div className="card-actions">
                  <button className="card-action-button primary" onClick={handleCreateNote}>
                    <span className="icon icon-file"></span>
                    Create Note
                  </button>
                  <button className="card-action-button secondary" onClick={handleViewNotes}>
                    <span className="icon icon-list"></span>
                    View All Notes
                  </button>
                </div>
              </div>
              
              <div className="dashboard-card">
                <h3>
                  <span className="icon icon-folder"></span>
                  Organization
                </h3>
                <p>Organize your notes with folders and tags.</p>
                <button className="card-action-button">
                  <span className="icon icon-folder"></span>
                  Manage Folders
                </button>
              </div>
              
              <div className="dashboard-card">
                <h3>
                  <span className="icon icon-search"></span>
                  Search
                </h3>
                <p>Find your notes quickly with full-text search.</p>
                <button className="card-action-button" onClick={handleViewNotes}>
                  <span className="icon icon-search"></span>
                  Search Notes
                </button>
              </div>
            </div>
            
            <div className="session-info-card">
              <h3>Session Information</h3>
              <div className="info-grid">
                <div className="info-item">
                  <span className="label">Session ID:</span>
                  <span className="value">{sessionId.substring(0, 8)}...</span>
                </div>
                <div className="info-item">
                  <span className="label">Vault:</span>
                  <span className="value">{vaultSetupInfo.vault_info.name}</span>
                </div>
                <div className="info-item">
                  <span className="label">Encryption:</span>
                  <span className="value">ChaCha20Poly1305</span>
                </div>
                <div className="info-item">
                  <span className="label">Status:</span>
                  <span className="value status-active">Active</span>
                </div>
              </div>
            </div>
          </div>
        ) : null;

      case 'create-note':
        return vaultLocation && sessionId ? (
          <CreateNote
            vaultPath={vaultLocation}
            sessionId={sessionId}
            onNoteCreated={handleNoteCreated}
            onCancel={handleCancelCreateNote}
          />
        ) : null;

      case 'notes-list':
        return vaultLocation && sessionId ? (
          <NotesList
            vaultPath={vaultLocation}
            sessionId={sessionId}
            onCreateNote={handleCreateNote}
            onSelectNote={handleSelectNote}
          />
        ) : null;
      
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
                            <span className="icon icon-lock"></span>
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
                        <span className="icon icon-lock"></span>
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
              <span className="icon icon-lock"></span>
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

  // For main app, use full layout
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
        onLogout={handleLogout}
      >
        {renderContent()}
      </MainLayout>
    </ThemeProvider>
  );
}

export default App;
