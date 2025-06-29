import { ReactNode, useState } from 'react';
import { 
  AppShell, 
  Group, 
  Title, 
  Button, 
  ActionIcon, 
  Badge, 
  Text, 
  Stack, 
  Box,
  Burger,
  Tooltip
} from '@mantine/core';
import { 
  IconLock, 
  IconSun, 
  IconMoon, 
  IconDeviceDesktop, 
  IconLogout 
} from '@tabler/icons-react';
import { useTheme } from '../../contexts/ThemeContext';
import { DraggableTreeNotesList } from '../DraggableTreeNotesList';

interface MainLayoutProps {
  children: ReactNode;
  vaultInfo?: {
    name: string;
    isEncrypted: boolean;
  };
  sessionId?: string;
  vaultPath?: string;
  selectedNoteId?: string | undefined;
  onLogout?: () => void;
  onSelectNote?: (noteId: string) => void;
  onCreateNote?: () => void;
  onCreateWhiteboard?: () => void;
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
  onCreateWhiteboard,
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
        return <IconSun size={16} />;
      case 'dark':
        return <IconMoon size={16} />;
      case 'system':
        return <IconDeviceDesktop size={16} />;
      default:
        return <IconDeviceDesktop size={16} />;
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
    <AppShell
      header={{ height: 60 }}
      navbar={showSidebar ? { 
        width: sidebarCollapsed ? 60 : 300, 
        breakpoint: 'sm',
        collapsed: { mobile: sidebarCollapsed }
      } : { width: 0, breakpoint: 'sm' }}
      padding="md"
    >
      {/* Header */}
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            {showSidebar && (
              <Burger
                opened={!sidebarCollapsed}
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                size="sm"
              />
            )}
            
            <Group gap="sm">
              <IconLock size={20} />
              <Title order={3}>Cocobolo</Title>
            </Group>
          </Group>

          <Group>
            {vaultInfo && (
              <Group gap="sm">
                <Text fw={500}>{vaultInfo.name}</Text>
                {vaultInfo.isEncrypted && (
                  <Badge leftSection={<IconLock size={12} />} variant="light" color="blue" size="sm">
                    Encrypted
                  </Badge>
                )}
              </Group>
            )}
          </Group>

          <Group gap="sm">
            <Tooltip label={`Theme: ${getThemeLabel()}`}>
              <ActionIcon
                variant="light"
                onClick={() => {
                  const themes: ('light' | 'dark' | 'system')[] = ['light', 'dark', 'system'];
                  const currentIndex = themes.indexOf(theme);
                  const nextIndex = (currentIndex + 1) % themes.length;
                  const nextTheme = themes[nextIndex];
                  if (nextTheme) {
                    handleThemeChange(nextTheme);
                  }
                }}
              >
                {getThemeIcon()}
              </ActionIcon>
            </Tooltip>

            {sessionId && onLogout && (
              <Button
                variant="light"
                leftSection={<IconLogout size={16} />}
                onClick={onLogout}
                size="sm"
              >
                Logout
              </Button>
            )}
          </Group>
        </Group>
      </AppShell.Header>

      {/* Sidebar */}
      {showSidebar && (
        <AppShell.Navbar p="md">
          {!sidebarCollapsed && (
            <Stack gap="md" h="100%">
              {/* File Explorer Style Notes Tree */}
              {vaultPath && sessionId && (
                <Box style={{ flex: 1 }}>
                  <DraggableTreeNotesList
                    vaultPath={vaultPath}
                    sessionId={sessionId}
                    selectedNoteId={selectedNoteId}
                    onSelectNote={onSelectNote}
                    onCreateNote={handleCreateNote}
                    onCreateWhiteboard={onCreateWhiteboard || (() => {})}
                  />
                </Box>
              )}

              {/* Session Info Footer */}
              {sessionId && (
                <Box>
                  <Text size="sm" fw={500} mb="xs">Session</Text>
                  <Text size="xs" c="dimmed">ID: {sessionId.substring(0, 8)}...</Text>
                  <Text size="xs" c="dimmed">Status: Active</Text>
                </Box>
              )}
            </Stack>
          )}
        </AppShell.Navbar>
      )}

      {/* Main Content */}
      <AppShell.Main>
        {children}
      </AppShell.Main>
    </AppShell>
  );
} 