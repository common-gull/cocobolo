
import { useNavigate, useSearchParams } from 'react-router';
import { Container, Alert } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import { VaultPasswordSetup } from '../components/VaultPasswordSetup';
import type { VaultInfo } from '../types';

export default function PasswordSetup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const handleVaultCreated = (sessionId: string | null, vaultInfo: VaultInfo | null) => {
    if (sessionId && vaultInfo) {
      // Session was successfully created and stored, go directly to app
      navigate('/app', { replace: true });
    } else {
      // Session creation failed, redirect to unlock screen
      navigate('/vault-unlock', { replace: true });
    }
  };

  const vaultPath = searchParams.get('vaultPath');

  if (!vaultPath) {
    return (
      <Container size="sm" mt="xl">
        <Alert icon={<IconAlertTriangle size={16} />} title="Error" color="red">
          No vault path provided. Please go back and select a vault location.
        </Alert>
      </Container>
    );
  }

  return (
    <Container size="sm" mt="xl">
      <VaultPasswordSetup 
        vaultPath={vaultPath}
        onVaultCreated={handleVaultCreated}
      />
    </Container>
  );
} 