import { 
  Container, 
  Paper, 
  Title, 
  Text, 
  PasswordInput, 
  TextInput, 
  Button, 
  Group, 
  Stack, 
  Alert, 
  Progress,
  List,
  Box,
  Divider,
  Code,
  Loader,
  Badge
} from '@mantine/core';
import { 
  IconLock, 
  IconAlertTriangle, 
  IconCheck, 
  IconShield,
  IconFolder,
  IconArrowLeft,
  IconX,
  IconInfoCircle
} from '@tabler/icons-react';
import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router';

import type { VaultPasswordSetupState, VaultInfo, VaultLocationInfo } from '../types';
import { api } from '../utils/api';

interface VaultCreatorProps {
  onVaultCreated?: (sessionId: string | null, vaultInfo: VaultInfo | null) => void;
  onCancel?: () => void;
}

export function VaultCreator({ onVaultCreated, onCancel }: VaultCreatorProps) {
  const navigate = useNavigate();
  
  // Vault creation state
  const [state, setState] = useState<VaultPasswordSetupState>({
    vaultName: '',
    password: '',
    confirmPassword: '',
    isCreating: false,
    error: null,
    showPassword: false,
    passwordStrength: null,
  });

  // Location selection state
  const [selectedPath, setSelectedPath] = useState<string>('');
  const [isValidatingPath, setIsValidatingPath] = useState(false);
  const [pathValidation, setPathValidation] = useState<VaultLocationInfo | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  const handleVaultNameChange = useCallback((vaultName: string) => {
    setState(prev => ({ ...prev, vaultName }));
  }, []);

  const canCreateVault = () => {
    return (
      state.vaultName.trim().length > 0 &&
      state.password.length > 0 &&
      state.password === state.confirmPassword &&
      selectedPath.trim().length > 0 &&
      pathValidation?.is_valid &&
      pathValidation?.is_writable &&
      !pathValidation?.has_existing_vault &&
      !state.isCreating &&
      (!state.passwordStrength || state.passwordStrength.score >= 2)
    );
  };

  const handlePasswordChange = useCallback(async (password: string) => {
    setState(prev => ({ ...prev, password, error: null }));
    
    if (password.length > 0) {
      try {
        const strength = await api.validatePasswordStrength(password);
        setState(prev => ({ ...prev, passwordStrength: strength }));
      } catch (_error) {
        // If password strength validation fails, we can still proceed
        setState(prev => ({ ...prev, passwordStrength: null }));
      }
    } else {
      setState(prev => ({ ...prev, passwordStrength: null }));
    }
  }, []);

  const handleConfirmPasswordChange = useCallback((confirmPassword: string) => {
    setState(prev => ({ ...prev, confirmPassword, error: null }));
  }, []);

  const handleSelectDirectory = async () => {
    try {
      setLocationError(null);
      const path = await api.selectVaultDirectory();
      if (path) {
        setSelectedPath(path);
        
        // Auto-validate the path
        setIsValidatingPath(true);
        try {
          const validation = await api.validateVaultLocation(path);
          setPathValidation(validation);
        } catch (err) {
          setLocationError(err instanceof Error ? err.message : 'Failed to validate path');
        } finally {
          setIsValidatingPath(false);
        }
      }
    } catch (err) {
      setLocationError(err instanceof Error ? err.message : 'Failed to select directory');
    }
  };

  const handleCreateVault = async () => {
    if (!canCreateVault()) return;

    try {
      setState(prev => ({ ...prev, isCreating: true, error: null }));
      
      // Create the encrypted vault
      await api.createEncryptedVault(
        selectedPath,
        state.vaultName.trim(),
        state.password
      );

      // Add to known vaults
      const result = await api.addKnownVault({
        name: state.vaultName.trim(),
        path: selectedPath,
      });

      if (result.success && result.vault_id) {
        // Set as current vault
        await api.setCurrentVault(result.vault_id);
      }

      // Auto-unlock the vault after creation
      try {
        const unlockResult = await api.unlockVault(selectedPath, state.password);
        
        if (unlockResult.success && unlockResult.session_id && unlockResult.vault_info) {
          // Store session information
          sessionStorage.setItem('sessionId', unlockResult.session_id);
          sessionStorage.setItem('vaultInfo', JSON.stringify(unlockResult.vault_info));
          
          // Verify storage
          const storedSessionId = sessionStorage.getItem('sessionId');
          const storedVaultInfo = sessionStorage.getItem('vaultInfo');
          
          setState(prev => ({ ...prev, isCreating: false }));
          
          if (storedSessionId && storedVaultInfo) {
            if (onVaultCreated) {
              onVaultCreated(unlockResult.session_id, unlockResult.vault_info);
            }
          } else {
            // Fallback to manual unlock if session storage fails
            if (onVaultCreated) {
              onVaultCreated(null, null);
            }
          }
        } else {
          // Auto-unlock failed, user will need to unlock manually
          setState(prev => ({ ...prev, isCreating: false }));
          if (onVaultCreated) {
            onVaultCreated(null, null);
          }
        }
      } catch (unlockError) {
        console.error('Auto-unlock failed:', unlockError);
        // Fallback to manual unlock
        setState(prev => ({ ...prev, isCreating: false }));
        if (onVaultCreated) {
          onVaultCreated(null, null);
        }
      }
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        isCreating: false, 
        error: error instanceof Error ? error.message : 'An unexpected error occurred' 
      }));
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCreateVault();
    }
  };

  const getPasswordStrengthColor = (score: number): string => {
    if (score < 2) return 'red';
    if (score < 3) return 'orange';
    if (score < 4) return 'yellow';
    return 'green';
  };

  const getPasswordStrengthLabel = (score: number): string => {
    if (score < 2) return 'Weak';
    if (score < 3) return 'Fair';
    if (score < 4) return 'Good';
    return 'Strong';
  };

  const passwordsMatch = state.password === state.confirmPassword;
  const showPasswordMismatch = state.confirmPassword.length > 0 && !passwordsMatch;

  return (
    <Container size="sm" py="xl">
      <Group mb="md">
        <Button
          variant="subtle"
          leftSection={<IconArrowLeft size={16} />}
          onClick={() => navigate('/')}
        >
          Back to Vault Selector
        </Button>
      </Group>

      <Paper p="xl" radius="lg" shadow="md">
        <Stack gap="xl">
          {/* Header */}
          <Stack align="center" gap="md">
            <IconLock size={48} color="var(--mantine-color-blue-6)" />
            <Box ta="center">
              <Title order={2} mb="xs">Create New Vault</Title>
              <Text c="dimmed">
                Set up your encrypted vault with a secure location and password
              </Text>
            </Box>
          </Stack>

          <Divider />

          {/* Vault Location Section */}
          <Stack gap="md">
            <Title order={3}>
              <Group gap="sm">
                <IconFolder size={20} />
                Vault Location
              </Group>
            </Title>
            
            <Group>
              <Button
                leftSection={<IconFolder size={16} />}
                onClick={handleSelectDirectory}
                loading={isValidatingPath}
                size="md"
              >
                {isValidatingPath ? 'Validating...' : 'Select Directory'}
              </Button>
            </Group>

            {/* Selected Path Display */}
            {selectedPath && (
              <Box>
                <Text fw={500} mb="xs">Selected Path:</Text>
                <Code block p="sm" bg="blue.0">
                  {selectedPath}
                </Code>
              </Box>
            )}

            {/* Path Validation */}
            {isValidatingPath && (
              <Alert icon={<Loader size={16} />} color="blue">
                Validating vault location...
              </Alert>
            )}

            {pathValidation && !isValidatingPath && (
              <Stack gap="xs">
                <Alert
                  icon={pathValidation.is_valid ? <IconCheck size={16} /> : <IconX size={16} />}
                  title={pathValidation.is_valid ? "Directory is accessible" : "Directory is not accessible"}
                  color={pathValidation.is_valid ? "green" : "red"}
                  variant="light"
                />
                
                {pathValidation.is_valid && (
                  <Alert
                    icon={pathValidation.is_writable ? <IconCheck size={16} /> : <IconX size={16} />}
                    title={pathValidation.is_writable ? "Directory is writable" : "Directory is not writable"}
                    color={pathValidation.is_writable ? "green" : "red"}
                    variant="light"
                  />
                )}

                {pathValidation.has_existing_vault && (
                  <Alert
                    icon={<IconInfoCircle size={16} />}
                    title="Existing vault found"
                    color="orange"
                    variant="light"
                  >
                    <Text size="sm">
                      This directory already contains a vault. Please choose a different location for your new vault.
                    </Text>
                    {pathValidation.vault_info && (
                      <Group gap="xs" mt="xs">
                        <Badge leftSection={<IconLock size={12} />} variant="light">
                          {pathValidation.vault_info.name}
                        </Badge>
                        <Text size="sm" c="dimmed">
                          Created {new Date(pathValidation.vault_info.created_at).toLocaleDateString()}
                        </Text>
                      </Group>
                    )}
                  </Alert>
                )}
              </Stack>
            )}

            {locationError && (
              <Alert
                icon={<IconAlertTriangle size={16} />}
                title="Location Error"
                color="red"
                variant="light"
              >
                {locationError}
              </Alert>
            )}
          </Stack>

          <Divider />

          {/* Vault Setup Section */}
          <Stack gap="lg">
            <Title order={3}>
              <Group gap="sm">
                <IconShield size={20} />
                Vault Details
              </Group>
            </Title>

            <TextInput
              label="Vault Name"
              placeholder="My Secure Notes"
              value={state.vaultName}
              onChange={(e) => handleVaultNameChange(e.target.value)}
              disabled={state.isCreating}
              size="md"
              autoFocus
            />

            <PasswordInput
              label="Master Password"
              placeholder="Create a strong password"
              value={state.password}
              onChange={(e) => handlePasswordChange(e.target.value)}
              onKeyDown={handleKeyPress}
              disabled={state.isCreating}
              size="md"
            />

            {/* Password Strength Indicator */}
            {state.passwordStrength && state.password.length > 0 && (
              <Box>
                <Group justify="space-between" mb="xs">
                  <Text size="sm" fw={500}>Password Strength</Text>
                  <Text 
                    size="sm" 
                    c={getPasswordStrengthColor(state.passwordStrength.score)}
                    fw={500}
                  >
                    {getPasswordStrengthLabel(state.passwordStrength.score)}
                  </Text>
                </Group>
                <Progress 
                  value={(state.passwordStrength.score + 1) * 20} 
                  color={getPasswordStrengthColor(state.passwordStrength.score)}
                  size="sm"
                />
                {state.passwordStrength.suggestions.length > 0 && (
                  <List size="sm" mt="xs" c="dimmed">
                    {state.passwordStrength.suggestions.map((suggestion, index) => (
                      <List.Item key={index}>{suggestion}</List.Item>
                    ))}
                  </List>
                )}
              </Box>
            )}

            <PasswordInput
              label="Confirm Password"
              placeholder="Confirm your password"
              value={state.confirmPassword}
              onChange={(e) => handleConfirmPasswordChange(e.target.value)}
              onKeyDown={handleKeyPress}
              disabled={state.isCreating}
              error={showPasswordMismatch ? 'Passwords do not match' : undefined}
              size="md"
            />

            {/* Security Notice */}
            <Alert
              icon={<IconShield size={16} />}
              title="Security Notice"
              color="blue"
              variant="light"
            >
              <Text size="sm">
                Your master password cannot be recovered if lost. Make sure to store it safely.
                All your notes will be encrypted with XChaCha20 encryption.
              </Text>
            </Alert>

            {/* Error Display */}
            {state.error && (
              <Alert
                icon={<IconAlertTriangle size={16} />}
                title="Error"
                color="red"
                variant="light"
              >
                {state.error}
              </Alert>
            )}

            {/* Action Buttons */}
            <Group justify="space-between" mt="md">
              {onCancel && (
                <Button 
                  variant="subtle" 
                  onClick={onCancel}
                  disabled={state.isCreating}
                >
                  Cancel
                </Button>
              )}
              
              <Button
                onClick={handleCreateVault}
                disabled={!canCreateVault()}
                loading={state.isCreating}
                size="md"
                leftSection={<IconLock size={16} />}
                style={{ marginLeft: 'auto' }}
              >
                {state.isCreating ? 'Creating Vault...' : 'Create Vault'}
              </Button>
            </Group>
          </Stack>
        </Stack>
      </Paper>
    </Container>
  );
} 