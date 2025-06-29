import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Container, Loader, Center, Stack, Text, Alert } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import { VaultUnlock } from '../components/VaultUnlock';
import { api } from '../utils/api';
import type { VaultInfo, VaultSetupInfo } from '../types';

export default function VaultUnlockRoute() {
  const navigate = useNavigate();
  const [vaultPath, setVaultPath] = useState<string | null>(null);
  const [vaultInfo, setVaultInfo] = useState<VaultInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadVaultInfo = async () => {
      try {
        // Get current vault location
        const location = await api.getCurrentVaultLocation();
        if (!location) {
          navigate('/vault-setup');
          return;
        }

        setVaultPath(location);

        // Check vault setup status to get vault info
        const setupInfo: VaultSetupInfo = await api.checkVaultSetupStatus(location);
        
        if (!setupInfo.vault_info) {
          // No vault info available, redirect to setup
          navigate('/vault-setup');
          return;
        }

        if (!setupInfo.needs_password) {
          // Vault doesn't need password, redirect to main app
          navigate('/app');
          return;
        }

        setVaultInfo(setupInfo.vault_info);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load vault information');
      } finally {
        setLoading(false);
      }
    };

    loadVaultInfo();
  }, [navigate]);

  const handleVaultUnlocked = (sessionId: string, vaultInfo: VaultInfo) => {
    // Store session ID in sessionStorage for the app layout
    sessionStorage.setItem('sessionId', sessionId);
    sessionStorage.setItem('vaultInfo', JSON.stringify(vaultInfo));
    
    // Navigate to main app
    navigate('/app');
  };

  const handleCancel = () => {
    // Go back to vault setup
    navigate('/vault-setup');
  };

  if (loading) {
    return (
      <Container size="sm" mt="xl">
        <Center>
          <Stack align="center" gap="md">
            <Loader size="lg" />
            <Text>Loading vault information...</Text>
          </Stack>
        </Center>
      </Container>
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

  if (!vaultPath || !vaultInfo) {
    return (
      <Container size="sm" mt="xl">
        <Alert icon={<IconAlertTriangle size={16} />} title="Error" color="red">
          Vault information not available. Please set up your vault first.
        </Alert>
      </Container>
    );
  }

  return (
    <Container size="sm" mt="xl">
      <VaultUnlock 
        vaultPath={vaultPath}
        vaultInfo={vaultInfo}
        onVaultUnlocked={handleVaultUnlocked}
        onCancel={handleCancel}
      />
    </Container>
  );
} 