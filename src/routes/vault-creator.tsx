import { useNavigate } from 'react-router';

import { VaultCreator } from '../components/VaultCreator';
import type { VaultInfo } from '../types';

export default function VaultCreatorPage() {
  const navigate = useNavigate();

  const handleVaultCreated = (sessionId: string | null, vaultInfo: VaultInfo | null) => {
    if (sessionId && vaultInfo) {
      // Session was successfully created and stored, go directly to app
      navigate('/app', { replace: true });
    } else {
      // Session creation failed, redirect to unlock screen
      navigate('/vault-unlock', { replace: true });
    }
  };

  return <VaultCreator onVaultCreated={handleVaultCreated} />;
} 