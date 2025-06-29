import { useNavigate } from 'react-router';
import { useEffect } from 'react';
import { useSetAtom } from 'jotai';
import { Container } from '@mantine/core';
import { VaultLocationSelector } from '../components/VaultLocationSelector';
import { initializeVaultSessionAtom } from '../stores/notesStore';
import { api } from '../utils/api';

export default function VaultSetup() {
  const navigate = useNavigate();
  const initializeSession = useSetAtom(initializeVaultSessionAtom);

  // Initialize vault configuration on mount
  useEffect(() => {
    initializeSession();
  }, [initializeSession]);

  const handleVaultLocationSet = async (path: string) => {
    try {
      // Check if this location needs password setup
      const setupInfo = await api.checkVaultSetupStatus(path);
      
      if (setupInfo.needs_password && !setupInfo.vault_info) {
        // New vault needs password setup - pass the path as search param
        navigate(`/password-setup?vaultPath=${encodeURIComponent(path)}`);
      } else if (setupInfo.needs_password && setupInfo.vault_info) {
        // Existing encrypted vault needs unlock
        navigate('/vault-unlock');
      } else {
        // Vault is ready, go to main app
        navigate('/app');
      }
    } catch (err) {
      console.error('Failed to check vault setup:', err);
    }
  };

  return (
    <Container size="sm" mt="xl">
      <VaultLocationSelector onLocationSet={handleVaultLocationSet} />
    </Container>
  );
} 