import { useState, useEffect } from "react";
import { api } from './utils/api';
import { VaultLocationSelector } from './components/VaultLocationSelector';
import type { AppInfo } from './types';
import "./App.css";

type AppView = 'home' | 'vault-setup';

function App() {
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [currentView, setCurrentView] = useState<AppView>('home');
  const [vaultLocation, setVaultLocation] = useState<string | null>(null);
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
        
        // If no vault location is set, show vault setup
        if (!location) {
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

  const handleVaultLocationSet = (path: string) => {
    setVaultLocation(path);
    setCurrentView('home');
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
      ) : (
        <>
          <section className="welcome-section">
            <h2>Welcome to Your Secure Notes</h2>
            <p>
              Your vault is located at: <code>{vaultLocation}</code>
            </p>
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
