import { ReactNode, useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { TreeNotesList } from '../NotesList';
import { Icons } from '../Icons';
import './MainLayout.css';

interface MainLayoutProps {
  children: ReactNode;
  vaultInfo?: {
    name: string;
    isEncrypted: boolean;
  };
  sessionId?: string;
  vaultPath?: string;
  selectedNoteId?: string;
  onLogout?: () => void;
  onSelectNote?: (noteId: string) => void;
  onCreateNote?: () => void;
  onNavigate?: (view: string) => void;
  showSidebar?: boolean;
}

export function MainLayout({ 
  children, 
  vaultInfo, 
  sessionId, 
  vaultPath,
  selectedNoteId,
  onLogout,
  onSelectNote,
  onCreateNote,
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
        return <Icons.sun size="sm" />;
      case 'dark':
        return <Icons.moon size="sm" />;
      case 'system':
        return <Icons.monitor size="sm" />;
      default:
        return <Icons.monitor size="sm" />;
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



  const handleCreateNote = () => {
    if (onCreateNote) {
      onCreateNote();
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
              <Icons.menu size="sm" />
            </button>
          )}
          
          <div className="app-title">
            <Icons.lock size="sm" />
            <h1>Cocobolo</h1>
          </div>
        </div>

        <div className="header-center">
          {vaultInfo && (
            <div className="vault-status">
              <span className="vault-name">{vaultInfo.name}</span>
              {vaultInfo.isEncrypted && (
                <span className="encryption-badge">
                  <Icons.lock size="xs" />
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
              <Icons.logout size="sm" />
              Logout
            </button>
          )}
        </div>
      </header>

      <div className="layout-body">
        {/* Sidebar */}
        {showSidebar && (
          <aside className={`layout-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
            {!sidebarCollapsed && (
              <>


                {/* File Explorer Style Notes Tree */}
                {vaultPath && sessionId && (
                  <div className="notes-tree-section">
                    <TreeNotesList
                      vaultPath={vaultPath}
                      sessionId={sessionId}
                      {...(selectedNoteId && { selectedNoteId })}
                      {...(onSelectNote && { onSelectNote })}
                      onCreateNote={handleCreateNote}
                    />
                  </div>
                )}

                {/* Session Info Footer */}
                {sessionId && (
                  <div className="sidebar-footer">
                    <div className="session-info">
                      <h4>Session</h4>
                      <p>ID: {sessionId.substring(0, 8)}...</p>
                      <p>Status: Active</p>
                    </div>
                  </div>
                )}
              </>
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