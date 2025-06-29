import { useEffect, useState } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
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
import { api } from '../utils/api';
import { 
  appLoadingAtom, 
  appErrorAtom, 
  currentVaultLocationAtom 
} from '../stores/notesStore';
import type { AppInfo, VaultSetupInfo } from '../types';

export default function Home() {
  
  // Use Jotai atoms for common state
  const appLoading = useAtomValue(appLoadingAtom);
  const appError = useAtomValue(appErrorAtom);
  const vaultLocation = useAtomValue(currentVaultLocationAtom);
  const setAppLoading = useSetAtom(appLoadingAtom);
  const setAppError = useSetAtom(appErrorAtom);
  const setVaultLocation = useSetAtom(currentVaultLocationAtom);

  // Local state for page-specific data
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [vaultSetupInfo, setVaultSetupInfo] = useState<VaultSetupInfo | null>(null);

  // Demo state (keeping local as it's page-specific)
  const [greetInput, setGreetInput] = useState('');
  const [greetResult, setGreetResult] = useState<string | null>(null);
  const [greetError, setGreetError] = useState<string | null>(null);

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setAppLoading(true);
        setAppError(null);

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
        }
      } catch (err) {
        setAppError(err instanceof Error ? err.message : 'Failed to load app data');
      } finally {
        setAppLoading(false);
      }
    };

    loadInitialData();
  }, [setAppLoading, setAppError, setVaultLocation]);

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

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleGreet();
    }
  };

  if (appLoading) {
    return (
      <Center h="100vh">
        <Stack align="center" gap="md">
          <Loader size="lg" />
          <Text>Loading Cocobolo...</Text>
        </Stack>
      </Center>
    );
  }

  if (appError) {
    return (
      <Container size="sm" mt="xl">
        <Alert icon={<IconAlertTriangle size={16} />} title="Error" color="red">
          {appError}
        </Alert>
      </Container>
    );
  }

  return (
    <Container size="sm" mt="xl">
      <Paper shadow="md" radius="lg" p="xl">
        <Stack gap="lg">
          {/* Header */}
          <Group justify="center">
            <IconLock size={32} />
            <Title order={1}>Cocobolo</Title>
          </Group>

          {/* App Info */}
          {appInfo && (
            <Stack gap="sm" align="center">
              <Text size="lg" fw={500}>{appInfo.name}</Text>
              <Badge variant="light" size="lg">v{appInfo.version}</Badge>
              <Text c="dimmed" ta="center">{appInfo.description}</Text>
            </Stack>
          )}

          <Divider />

          {/* Demo Section */}
          <Stack gap="md">
            <Title order={3} ta="center">Demo Greeting</Title>
            <Text size="sm" c="dimmed" ta="center">
              Test the Tauri backend communication
            </Text>

            <TextInput
              placeholder="Enter your name"
              value={greetInput}
              onChange={(e) => setGreetInput(e.target.value)}
              onKeyPress={handleKeyPress}
            />

            <Button onClick={handleGreet} disabled={!greetInput.trim()}>
              Greet
            </Button>

            {greetResult && (
              <Alert icon={<IconCheck size={16} />} color="green">
                {greetResult}
              </Alert>
            )}

            {greetError && (
              <Alert icon={<IconAlertTriangle size={16} />} color="red">
                {greetError}
              </Alert>
            )}
          </Stack>

          {/* Vault Status */}
          {vaultLocation && vaultSetupInfo && (
            <Box>
              <Divider mb="md" />
              <Stack gap="sm">
                <Text fw={500}>Vault Status</Text>
                <Text size="sm" c="dimmed">Location: {vaultLocation}</Text>
                {vaultSetupInfo.vault_info && (
                  <>
                    <Text size="sm">Name: {vaultSetupInfo.vault_info.name}</Text>
                    <Badge 
                      variant="light" 
                      color={vaultSetupInfo.is_encrypted ? "blue" : "gray"}
                      leftSection={vaultSetupInfo.is_encrypted ? <IconLock size={12} /> : undefined}
                    >
                      {vaultSetupInfo.is_encrypted ? "Encrypted" : "Unencrypted"}
                    </Badge>
                  </>
                )}
              </Stack>
            </Box>
          )}
        </Stack>
      </Paper>
    </Container>
  );
} 