import { 
  Container, 
  Paper, 
  Title, 
  Text, 
  PasswordInput, 
  Button, 
  Group, 
  Stack, 
  Alert, 
  Badge,
  Box,
  Divider,
  List,
  Center
} from '@mantine/core';
import { 
  IconLock, 
  IconAlertTriangle, 
  IconClock, 
  IconShield
} from '@tabler/icons-react';
import React, { useState, useCallback, useEffect } from 'react';

import type { VaultUnlockState, VaultInfo, VaultUnlockResult } from '../types';
import { api } from '../utils/api';

interface VaultUnlockProps {
  vaultPath: string;
  vaultInfo: VaultInfo;
  onVaultUnlocked?: (sessionId: string, vaultInfo: VaultInfo) => void;
  onCancel?: () => void;
}

export function VaultUnlock({ vaultPath, vaultInfo, onVaultUnlocked, onCancel }: VaultUnlockProps) {
  const [state, setState] = useState<VaultUnlockState>({
    password: '',
    isUnlocking: false,
    error: null,
    showPassword: false,
    rateLimitInfo: null,
  });

  // Check rate limit status on mount and periodically
  useEffect(() => {
    const checkRateLimit = async () => {
      try {
        const rateLimitInfo = await api.getVaultRateLimitStatus(vaultPath);
        setState(prev => ({ ...prev, rateLimitInfo }));
      } catch (error) {
        console.error('Failed to check rate limit status:', error);
      }
    };

    checkRateLimit();
    
    // Check rate limit status every 5 seconds if rate limited
    const interval = setInterval(() => {
      if (state.rateLimitInfo?.is_rate_limited) {
        checkRateLimit();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [vaultPath, state.rateLimitInfo?.is_rate_limited]);

  const handlePasswordChange = useCallback((password: string) => {
    setState(prev => ({ ...prev, password, error: null }));
  }, []);



  const canUnlock = () => {
    return (
      state.password.length > 0 &&
      !state.isUnlocking &&
      !state.rateLimitInfo?.is_rate_limited
    );
  };

  const handleUnlock = async () => {
    if (!canUnlock()) return;

    try {
      setState(prev => ({ ...prev, isUnlocking: true, error: null }));
      
      const result: VaultUnlockResult = await api.unlockVault(vaultPath, state.password);
      
      if (result.success && result.session_id && result.vault_info) {
        setState(prev => ({ ...prev, isUnlocking: false }));
        
        if (onVaultUnlocked) {
          onVaultUnlocked(result.session_id, result.vault_info);
        }
      } else {
        setState(prev => ({
          ...prev,
          isUnlocking: false,
          error: result.error_message || 'Failed to unlock vault',
          password: '', // Clear password on failure
        }));
        
        // Refresh rate limit status after failed attempt
        const rateLimitInfo = await api.getVaultRateLimitStatus(vaultPath);
        setState(prev => ({ ...prev, rateLimitInfo }));
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        isUnlocking: false,
        error: error instanceof Error ? error.message : 'Failed to unlock vault',
        password: '', // Clear password on failure
      }));
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleUnlock();
    }
  };

  const formatTimeRemaining = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds} second${seconds !== 1 ? 's' : ''}`;
    } else if (seconds < 3600) {
      const minutes = Math.ceil(seconds / 60);
      return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    } else {
      const hours = Math.ceil(seconds / 3600);
      return `${hours} hour${hours !== 1 ? 's' : ''}`;
    }
  };

  const isRateLimited = state.rateLimitInfo?.is_rate_limited;
  const timeRemaining = state.rateLimitInfo?.seconds_remaining;

  return (
    <Container size="sm" py="xl">
      <Paper p="xl" radius="lg" shadow="md">
        <Stack gap="xl">
          {/* Header */}
          <Stack align="center" gap="md">
            <Center>
              <IconLock size={48} color="var(--mantine-color-blue-6)" />
            </Center>
            
            <Box ta="center">
              <Title order={2} mb="xs">Unlock Vault</Title>
              <Title order={3} c="dimmed" fw={500} mb="sm">{vaultInfo.name}</Title>
              
              <Group justify="center" gap="md">
                <Badge leftSection={<IconLock size={12} />} variant="light" color="blue">
                  Encrypted
                </Badge>
                <Text size="sm" c="dimmed">
                  Created: {new Date(vaultInfo.created_at).toLocaleDateString()}
                </Text>
              </Group>
            </Box>
          </Stack>

          <Divider />

          {/* Unlock Form */}
          <Stack gap="lg">
            <PasswordInput
              label="Enter your vault password"
              placeholder="Password"
              value={state.password}
              onChange={(e) => handlePasswordChange(e.target.value)}
              onKeyDown={handleKeyPress}
              disabled={state.isUnlocking || !!isRateLimited}
              error={state.error && !isRateLimited ? state.error : undefined}
              size="md"
              autoFocus
            />

            {/* Rate Limit Warning */}
            {isRateLimited && timeRemaining && (
              <Alert
                icon={<IconClock size={16} />}
                title="Too Many Failed Attempts"
                color="orange"
                variant="light"
              >
                <Text size="sm">
                  Please wait {formatTimeRemaining(timeRemaining)} before trying again.
                  This security measure helps protect your vault from unauthorized access.
                </Text>
              </Alert>
            )}

            {/* Error Display */}
            {state.error && !isRateLimited && (
              <Alert
                icon={<IconAlertTriangle size={16} />}
                title="Error"
                color="red"
                variant="light"
              >
                {state.error}
              </Alert>
            )}

            {/* Form Actions */}
            <Group justify="flex-end" gap="md">
              {onCancel && (
                <Button
                  variant="light"
                  onClick={onCancel}
                  disabled={state.isUnlocking}
                  size="md"
                >
                  Cancel
                </Button>
              )}
              
              <Button
                leftSection={<IconLock size={16} />}
                onClick={handleUnlock}
                disabled={!canUnlock()}
                loading={state.isUnlocking}
                size="md"
              >
                {state.isUnlocking ? 'Unlocking...' : isRateLimited ? 'Rate Limited' : 'Unlock Vault'}
              </Button>
            </Group>
          </Stack>

          <Divider />

          {/* Security Information */}
          <Alert
            icon={<IconShield size={16} />}
            title="Security Information"
            color="blue"
            variant="light"
          >
            <List spacing="xs" size="sm">
              <List.Item>Your password is never stored or transmitted in plain text</List.Item>
              <List.Item>Failed unlock attempts are rate-limited to prevent brute force attacks</List.Item>
              <List.Item>Sessions automatically expire after 30 minutes of inactivity</List.Item>
              <List.Item>All vault data is encrypted with military-grade ChaCha20Poly1305</List.Item>
            </List>
          </Alert>
        </Stack>
      </Paper>
    </Container>
  );
} 