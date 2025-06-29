import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
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
import type { AppInfo, VaultSetupInfo } from '../types';

export default function Home() {
  const navigate = useNavigate();
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
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
            navigate('/password-setup');
          } else if (setupInfo.needs_password && setupInfo.vault_info) {
            // Existing encrypted vault needs unlock
            navigate('/vault-unlock');
          } else {
            // Vault is ready, go to main app
            navigate('/app');
          }
        } else {
          // No vault location set
          navigate('/vault-setup');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load app data');
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, [navigate]);

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

  if (loading) {
    return (
      <Center h="100vh">
        <Stack align="center" gap="md">
          <Loader size="lg" />
          <Text>Loading Cocobolo...</Text>
        </Stack>
      </Center>
    );
  }

  if (error) {
    return (
      <Container size="sm" mt="xl">
        <Alert icon={<IconAlertTriangle size={16} />} title="Error" color="red">
          {error}
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