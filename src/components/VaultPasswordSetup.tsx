import { useState, useCallback, useEffect } from 'react';
import { 
  Container, 
  Paper, 
  Title, 
  Text, 
  TextInput, 
  PasswordInput, 
  Button, 
  Group, 
  Stack, 
  Alert, 
  Progress,
  List,
  Box,
  Divider,
  Loader
} from '@mantine/core';
import { 
  IconLock, 
  IconAlertTriangle, 
  IconCheck, 
  IconX, 
  IconBulb,
  IconShield
} from '@tabler/icons-react';
import { api } from '../utils/api';
import type { PasswordSetupState, VaultInfo } from '../types';

interface VaultPasswordSetupProps {
  vaultPath: string;
  onVaultCreated?: (vaultInfo: VaultInfo) => void;
  onCancel?: () => void;
}

export function VaultPasswordSetup({ vaultPath, onVaultCreated, onCancel }: VaultPasswordSetupProps) {
  const [state, setState] = useState<PasswordSetupState>({
    password: '',
    confirmPassword: '',
    vaultName: '',
    passwordStrength: null,
    isValidating: false,
    isCreating: false,
    error: null,
    showPassword: false,
    showConfirmPassword: false,
  });

  // Debounced password validation
  useEffect(() => {
    if (!state.password) {
      setState(prev => ({ ...prev, passwordStrength: null }));
      return;
    }

    const timeoutId = setTimeout(async () => {
      try {
        setState(prev => ({ ...prev, isValidating: true, error: null }));
        const strength = await api.validatePasswordStrength(state.password);
        setState(prev => ({ 
          ...prev, 
          passwordStrength: strength, 
          isValidating: false 
        }));
      } catch (error) {
        setState(prev => ({ 
          ...prev, 
          isValidating: false,
          error: error instanceof Error ? error.message : 'Failed to validate password'
        }));
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [state.password]);

  const handlePasswordChange = useCallback((password: string) => {
    setState(prev => ({ ...prev, password }));
  }, []);

  const handleConfirmPasswordChange = useCallback((confirmPassword: string) => {
    setState(prev => ({ ...prev, confirmPassword }));
  }, []);

  const handleVaultNameChange = useCallback((vaultName: string) => {
    setState(prev => ({ ...prev, vaultName }));
  }, []);



  const canCreateVault = () => {
    return (
      state.vaultName.trim().length > 0 &&
      state.password.length > 0 &&
      state.password === state.confirmPassword &&
      state.passwordStrength?.is_valid === true &&
      !state.isValidating &&
      !state.isCreating
    );
  };

  const getPasswordMatchStatus = () => {
    if (!state.confirmPassword) return null;
    return state.password === state.confirmPassword;
  };

  const handleCreateVault = async () => {
    if (!canCreateVault()) return;

    try {
      setState(prev => ({ ...prev, isCreating: true, error: null }));
      
      const vaultInfo = await api.createEncryptedVault(
        vaultPath,
        state.vaultName.trim(),
        state.password
      );
      
      setState(prev => ({ ...prev, isCreating: false }));
      
      if (onVaultCreated) {
        onVaultCreated(vaultInfo);
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        isCreating: false,
        error: error instanceof Error ? error.message : 'Failed to create vault'
      }));
    }
  };

  const getStrengthColor = (score: number): string => {
    switch (score) {
      case 0:
      case 1:
        return 'red';
      case 2:
        return 'orange';
      case 3:
        return 'blue';
      case 4:
      default:
        return 'green';
    }
  };

  const getStrengthLabel = (score: number) => {
    switch (score) {
      case 0:
        return 'Very Weak';
      case 1:
        return 'Weak';
      case 2:
        return 'Fair';
      case 3:
        return 'Good';
      case 4:
      default:
        return 'Strong';
    }
  };

  const passwordMatchStatus = getPasswordMatchStatus();

  return (
    <Container size="md" py="xl">
      <Paper p="xl" radius="lg" shadow="md">
        <Stack gap="xl">
          {/* Header */}
          <Box>
            <Title order={2} mb="xs">
              <Group gap="sm">
                <IconLock size={24} />
                Create Vault Password
              </Group>
            </Title>
            <Text c="dimmed" size="lg">
              Set a strong password to encrypt your notes
            </Text>
          </Box>

          <Divider />

          {/* Form Section */}
          <Stack gap="lg">
            <TextInput
              label="Vault Name"
              placeholder="Enter a name for your vault"
              value={state.vaultName}
              onChange={(e) => handleVaultNameChange(e.target.value)}
              disabled={state.isCreating}
              size="md"
              required
            />

            <Box>
                             <PasswordInput
                 label="Password"
                 placeholder="Enter a strong password"
                 value={state.password}
                 onChange={(e) => handlePasswordChange(e.target.value)}
                 disabled={state.isCreating}
                 size="md"
                 required
               />
              
              {state.isValidating && (
                <Alert 
                  icon={<Loader size={16} />} 
                  title="Checking password strength..."
                  color="blue"
                  variant="light"
                  mt="sm"
                />
              )}

              {state.passwordStrength && !state.isValidating && (
                <Box mt="sm">
                  <Group justify="space-between" mb="xs">
                    <Text size="sm" fw={500}>
                      Password Strength: 
                      <Text span c={getStrengthColor(state.passwordStrength.score)} fw={600} ml="xs">
                        {getStrengthLabel(state.passwordStrength.score)}
                      </Text>
                    </Text>
                  </Group>
                  
                  <Progress 
                    value={(state.passwordStrength.score / 4) * 100} 
                    color={getStrengthColor(state.passwordStrength.score)}
                    size="sm"
                    mb="md"
                  />

                  {state.passwordStrength.issues.length > 0 && (
                    <Alert
                      icon={<IconAlertTriangle size={16} />}
                      title="Requirements:"
                      color="orange"
                      variant="light"
                      mb="sm"
                    >
                      <List spacing="xs" size="sm">
                        {state.passwordStrength.issues.map((issue, index) => (
                          <List.Item key={index}>{issue}</List.Item>
                        ))}
                      </List>
                    </Alert>
                  )}

                  {state.passwordStrength.suggestions.length > 0 && (
                    <Alert
                      icon={<IconBulb size={16} />}
                      title="Suggestions:"
                      color="blue"
                      variant="light"
                    >
                      <List spacing="xs" size="sm">
                        {state.passwordStrength.suggestions.map((suggestion, index) => (
                          <List.Item key={index}>{suggestion}</List.Item>
                        ))}
                      </List>
                    </Alert>
                  )}
                </Box>
              )}
            </Box>

            <Box>
                             <PasswordInput
                 label="Confirm Password"
                 placeholder="Confirm your password"
                 value={state.confirmPassword}
                 onChange={(e) => handleConfirmPasswordChange(e.target.value)}
                 disabled={state.isCreating}
                 size="md"
                 required
                 error={passwordMatchStatus === false ? 'Passwords do not match' : undefined}
               />
              
              {state.confirmPassword && passwordMatchStatus !== null && (
                <Alert
                  icon={passwordMatchStatus ? <IconCheck size={16} /> : <IconX size={16} />}
                  title={passwordMatchStatus ? 'Passwords match' : 'Passwords do not match'}
                  color={passwordMatchStatus ? 'green' : 'red'}
                  variant="light"
                  mt="sm"
                />
              )}
            </Box>
          </Stack>

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

          <Divider />

          {/* Security Notice */}
          <Alert
            icon={<IconShield size={16} />}
            title="Security Notice"
            color="blue"
            variant="light"
          >
            <List spacing="xs" size="sm">
              <List.Item>Your password is used to encrypt all your notes</List.Item>
              <List.Item>We never store your password - only an encrypted hash</List.Item>
              <List.Item>If you forget your password, your notes cannot be recovered</List.Item>
              <List.Item>Choose a password you can remember but others cannot guess</List.Item>
            </List>
          </Alert>

          {/* Form Actions */}
          <Group justify="flex-end" gap="md">
            {onCancel && (
              <Button
                variant="light"
                onClick={onCancel}
                disabled={state.isCreating}
                size="md"
              >
                Cancel
              </Button>
            )}
            
            <Button
              leftSection={<IconLock size={16} />}
              onClick={handleCreateVault}
              disabled={!canCreateVault()}
              loading={state.isCreating}
              size="md"
            >
              {state.isCreating ? 'Creating Vault...' : 'Create Encrypted Vault'}
            </Button>
          </Group>
        </Stack>
      </Paper>
    </Container>
  );
} 