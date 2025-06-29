import { useNavigate, useSearchParams } from 'react-router';
import { Container } from '@mantine/core';
import { VaultPasswordSetup } from '../components/VaultPasswordSetup';

export default function PasswordSetup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const vaultPath = searchParams.get('vaultPath') || '';

  const handleVaultCreated = () => {
    // Vault created successfully, go to main app
    navigate('/app');
  };

  const handleCancel = () => {
    // Go back to vault setup
    navigate('/vault-setup');
  };

  return (
    <Container size="sm" mt="xl">
      <VaultPasswordSetup 
        vaultPath={vaultPath}
        onVaultCreated={handleVaultCreated}
        onCancel={handleCancel}
      />
    </Container>
  );
} 