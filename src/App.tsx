import { useEffect, useState } from 'react';
import { api } from './utils/api';
import { VaultLocationSelector } from './components/VaultLocationSelector';
import { VaultPasswordSetup } from './components/VaultPasswordSetup';
import { VaultUnlock } from './components/VaultUnlock';
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

  return (
    <div className="container">
      <header className="app-header">
        <h1>🌰 Cocobolo</h1>
        <p>Secure Note-Taking Application</p>
        {appInfo && (
          <div className="app-info">
            <span>v{appInfo.version}</span>
          </div>
        )}
      </header>

      <main className="app-main">
        {currentView === 'vault-setup' && (
          <VaultLocationSelector onLocationSet={handleVaultLocationSet} />
        )}

        {currentView === 'password-setup' && vaultLocation && (
          <VaultPasswordSetup
            vaultPath={vaultLocation}
            onVaultCreated={handleVaultCreated}
            onCancel={handlePasswordSetupCancel}
          />
        )}

        {currentView === 'vault-unlock' && vaultLocation && vaultSetupInfo?.vault_info && (
          <VaultUnlock
            vaultPath={vaultLocation}
            vaultInfo={vaultSetupInfo.vault_info}
            onVaultUnlocked={handleVaultUnlocked}
            onCancel={handleVaultUnlockCancel}
          />
        )}

        {currentView === 'main-app' && vaultSetupInfo?.vault_info && sessionId && (
          <div className="main-app">
            <div className="app-toolbar">
              <div className="vault-status">
                <span className="vault-name">📝 {vaultSetupInfo.vault_info.name}</span>
                {vaultSetupInfo.is_encrypted && (
                  <span className="encryption-badge">🔐 Encrypted</span>
                )}
              </div>
              <button className="logout-button" onClick={handleLogout}>
                🚪 Logout
              </button>
            </div>
            
            <div className="notes-interface">
              <h2>Welcome to your secure vault!</h2>
              <p>Your vault is now unlocked and ready to use. This is where the main note-taking interface will be implemented.</p>
              
              <div className="session-info">
                <h3>Session Information</h3>
                <p><strong>Session ID:</strong> {sessionId.substring(0, 8)}...</p>
                <p><strong>Vault:</strong> {vaultSetupInfo.vault_info.name}</p>
                <p><strong>Encryption:</strong> ChaCha20Poly1305</p>
                <p><strong>Status:</strong> Active</p>
              </div>
            </div>
          </div>
        )}

        {currentView === 'home' && (
          <div className="home-view">
            <div className="welcome-section">
              <h2>Welcome to Cocobolo! 🌰</h2>
              <p>Your secure, encrypted note-taking companion</p>
              
              {vaultSetupInfo?.vault_info && (
                <div className="vault-info-display">
                  <h3>Current Vault</h3>
                  <div className="vault-card">
                    <div className="vault-header">
                      <h4>{vaultSetupInfo.vault_info.name}</h4>
                      <div className="vault-badges">
                        {vaultSetupInfo.is_encrypted && (
                          <span className="encryption-badge">🔐 Encrypted</span>
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
                        🔓 Unlock Vault
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
        )}
      </main>
    </div>
  );
}

export default App;
