import { ReactNode, useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import './MainLayout.css';

interface MainLayoutProps {
  children: ReactNode;
  vaultInfo?: {
    name: string;
    isEncrypted: boolean;
  };
  sessionId?: string;
  onLogout?: () => void;
  showSidebar?: boolean;
}

export function MainLayout({ 
  children, 
  vaultInfo, 
  sessionId, 
  onLogout,
  showSidebar = true 
}: MainLayoutProps) {
  const { theme, setTheme } = useTheme();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme);
  };

  const getThemeIcon = () => {
    switch (theme) {
      case 'light':
        return <span className="icon icon-sun"></span>;
      case 'dark':
        return <span className="icon icon-moon"></span>;
      case 'system':
        return <span className="icon icon-monitor"></span>;
      default:
        return <span className="icon icon-monitor"></span>;
    }
  };

  const getThemeLabel = () => {
    switch (theme) {
      case 'light':
        return 'Light';
      case 'dark':
        return 'Dark';
      case 'system':
        return 'System';
      default:
        return 'System';
    }
  };

  return (
    <div className="main-layout">
      {/* Header */}
      <header className="layout-header">
        <div className="header-left">
          {showSidebar && (
            <button
              className="sidebar-toggle"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <span className="icon icon-menu"></span>
            </button>
          )}
          
          <div className="app-title">
            <span className="icon icon-lock"></span>
            <h1>Cocobolo</h1>
          </div>
        </div>

        <div className="header-center">
          {vaultInfo && (
            <div className="vault-status">
              <span className="vault-name">{vaultInfo.name}</span>
              {vaultInfo.isEncrypted && (
                <span className="encryption-badge">
                  <span className="icon icon-lock"></span>
                  Encrypted
                </span>
              )}
            </div>
          )}
        </div>

        <div className="header-right">
          <div className="theme-selector">
            <button
              className="theme-toggle"
              onClick={() => {
                const themes: ('light' | 'dark' | 'system')[] = ['light', 'dark', 'system'];
                const currentIndex = themes.indexOf(theme);
                const nextIndex = (currentIndex + 1) % themes.length;
                const nextTheme = themes[nextIndex];
                if (nextTheme) {
                  handleThemeChange(nextTheme);
                }
              }}
              aria-label={`Current theme: ${getThemeLabel()}. Click to change.`}
              title={`Theme: ${getThemeLabel()}`}
            >
              {getThemeIcon()}
            </button>
          </div>

          {sessionId && onLogout && (
            <button className="logout-button" onClick={onLogout}>
              <span className="icon icon-logout"></span>
              Logout
            </button>
          )}
        </div>
      </header>

      <div className="layout-body">
        {/* Sidebar */}
        {showSidebar && (
          <aside className={`layout-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
            <nav className="sidebar-nav">
              <div className="nav-section">
                <h3>Navigation</h3>
                <ul>
                  <li>
                    <a href="#" className="nav-link active">
                      <span className="icon icon-home"></span>
                      <span className="nav-text">Dashboard</span>
                    </a>
                  </li>
                  <li>
                    <a href="#" className="nav-link">
                      <span className="icon icon-file"></span>
                      <span className="nav-text">Notes</span>
                    </a>
                  </li>
                  <li>
                    <a href="#" className="nav-link">
                      <span className="icon icon-folder"></span>
                      <span className="nav-text">Folders</span>
                    </a>
                  </li>
                  <li>
                    <a href="#" className="nav-link">
                      <span className="icon icon-search"></span>
                      <span className="nav-text">Search</span>
                    </a>
                  </li>
                </ul>
              </div>

              <div className="nav-section">
                <h3>Tools</h3>
                <ul>
                  <li>
                    <a href="#" className="nav-link">
                      <span className="icon icon-tag"></span>
                      <span className="nav-text">Tags</span>
                    </a>
                  </li>
                  <li>
                    <a href="#" className="nav-link">
                      <span className="icon icon-history"></span>
                      <span className="nav-text">Recent</span>
                    </a>
                  </li>
                  <li>
                    <a href="#" className="nav-link">
                      <span className="icon icon-trash"></span>
                      <span className="nav-text">Trash</span>
                    </a>
                  </li>
                </ul>
              </div>

              <div className="nav-section">
                <h3>Settings</h3>
                <ul>
                  <li>
                    <a href="#" className="nav-link">
                      <span className="icon icon-settings"></span>
                      <span className="nav-text">Preferences</span>
                    </a>
                  </li>
                  <li>
                    <a href="#" className="nav-link">
                      <span className="icon icon-backup"></span>
                      <span className="nav-text">Backup</span>
                    </a>
                  </li>
                </ul>
              </div>
            </nav>

            {!sidebarCollapsed && sessionId && (
              <div className="sidebar-footer">
                <div className="session-info">
                  <h4>Session</h4>
                  <p>ID: {sessionId.substring(0, 8)}...</p>
                  <p>Status: Active</p>
                </div>
              </div>
            )}
          </aside>
        )}

        {/* Main Content */}
        <main className={`layout-content ${showSidebar ? (sidebarCollapsed ? 'sidebar-collapsed' : 'sidebar-expanded') : 'no-sidebar'}`}>
          {children}
        </main>
      </div>
    </div>
  );
} 