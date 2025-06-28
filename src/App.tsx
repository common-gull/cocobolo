import { useState, useEffect } from "react";
import { api } from './utils/api';
import { VaultLocationSelector } from './components/VaultLocationSelector';
import { VaultPasswordSetup } from './components/VaultPasswordSetup';
import type { AppInfo, VaultInfo, VaultSetupInfo } from './types';
import "./App.css";

type AppView = 'home' | 'vault-setup' | 'password-setup';

function App() {
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [currentView, setCurrentView] = useState<AppView>('home');
  const [vaultLocation, setVaultLocation] = useState<string | null>(null);
  const [vaultSetupInfo, setVaultSetupInfo] = useState<VaultSetupInfo | null>(null);
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
            // Existing encrypted vault - would need password entry (future story)
            setCurrentView('home');
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

  const handlePasswordSetupCancel = () => {
    setCurrentView('vault-setup');
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
        <h1>{appInfo?.name || 'Cocobolo'}</h1>
        <p className="app-description">{appInfo?.description}</p>
        <p className="app-version">Version {appInfo?.version}</p>
      </header>

      {currentView === 'vault-setup' ? (
        <VaultLocationSelector onLocationSet={handleVaultLocationSet} />
      ) : currentView === 'password-setup' && vaultLocation ? (
        <VaultPasswordSetup 
          vaultPath={vaultLocation}
          onVaultCreated={handleVaultCreated}
          onCancel={handlePasswordSetupCancel}
        />
      ) : (
        <>
          <section className="welcome-section">
            <h2>Welcome to Your Secure Notes</h2>
            <p>
              Your vault is located at: <code>{vaultLocation}</code>
            </p>
            {vaultSetupInfo?.vault_info && (
              <div className="vault-info">
                <p>
                  <strong>Vault:</strong> {vaultSetupInfo.vault_info.name}
                  {vaultSetupInfo.is_encrypted && (
                    <span className="encryption-badge">🔒 Encrypted</span>
                  )}
                </p>
                <p>
                  <strong>Created:</strong> {new Date(vaultSetupInfo.vault_info.created_at).toLocaleDateString()}
                </p>
              </div>
            )}
            <p>
              Cocobolo keeps your notes encrypted and secure. All your data is stored locally
              and encrypted with your password.
            </p>
          </section>

          <section className="demo-section">
            <h3>Test Connection</h3>
            <p>Test the connection between the frontend and backend:</p>
            
            <div className="greet-form">
              <input
                type="text"
                value={greetInput}
                onChange={(e) => setGreetInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Enter your name"
              />
              <button onClick={handleGreet}>
                Greet
              </button>
            </div>

            {greetResult && (
              <div className="success-message">
                {greetResult}
              </div>
            )}

            {greetError && (
              <div className="error-message">
                {greetError}
              </div>
            )}
          </section>

          <section className="demo-section">
            <h3>Navigation</h3>
            <p>Quick access to application features:</p>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <button 
                className="greet-form button"
                onClick={() => setCurrentView('vault-setup')}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: 'var(--accent-color)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                Change Vault Location
              </button>
              
              {vaultLocation && vaultSetupInfo?.is_encrypted && (
                <button 
                  className="greet-form button"
                  onClick={() => setCurrentView('password-setup')}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: 'var(--info-color)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}
                >
                  Setup New Password
                </button>
              )}
            </div>
          </section>
        </>
      )}

      <footer className="app-footer">
        <p>Secure • Private • Encrypted</p>
      </footer>
    </div>
  );
}

export default App;
