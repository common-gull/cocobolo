import { 
  Container, 
  Paper, 
  Title, 
  Text, 
  Button, 
  Group, 
  Stack, 
  Alert, 
  Code, 
  Loader, 
  List,
  Badge,
  Box,
  Divider
} from '@mantine/core';
import { 
  IconCheck, 
  IconX, 
  IconInfoCircle, 
  IconAlertTriangle, 
  IconFolder,
  IconLock 
} from '@tabler/icons-react';
import { useVaultLocationJotai } from '../hooks/useVaultLocationJotai';

interface VaultLocationSelectorProps {
  onLocationSet?: (path: string) => void;
}

export function VaultLocationSelector({ onLocationSet }: VaultLocationSelectorProps) {
  const {
    selectedPath,
    currentVaultLocation,
    isConfigLoading,
    isValidating,
    validationResult,
    error,
    hasChanges,
    canConfirm,
    selectDirectory,
    confirmSelection,
    clearSelection,
  } = useVaultLocationJotai();

  const handleConfirm = async () => {
    const success = await confirmSelection();
    if (success && selectedPath && onLocationSet) {
      onLocationSet(selectedPath);
    }
  };

  // Show loading state while initializing
  if (isConfigLoading) {
    return (
      <Container size="md" py="xl">
        <Paper p="xl" radius="lg" shadow="md">
          <Stack align="center" gap="md">
            <Loader size="lg" />
            <Text size="lg">Loading vault configuration...</Text>
          </Stack>
        </Paper>
      </Container>
    );
  }

  return (
    <Container size="md" py="xl">
      <Paper p="xl" radius="lg" shadow="md">
        <Stack gap="xl">
          {/* Header */}
          <Box>
            <Title order={2} mb="xs">
              <Group gap="sm">
                <IconFolder size={24} />
                Vault Location
              </Group>
            </Title>
            <Text c="dimmed" size="lg">
              Choose where to store your encrypted notes
            </Text>
          </Box>

          {/* Current Location */}
          <Box>
            <Text fw={500} mb="xs">Current Vault Location:</Text>
            {currentVaultLocation ? (
              <Code block p="sm" bg="gray.1">
                {currentVaultLocation}
              </Code>
            ) : (
              <Text c="dimmed" fs="italic">
                No vault location set
              </Text>
            )}
          </Box>

          <Divider />

          {/* Selection Controls */}
          <Stack gap="md">
            <Group>
              <Button
                leftSection={<IconFolder size={16} />}
                onClick={selectDirectory}
                loading={isValidating}
                size="md"
              >
                {isValidating ? 'Validating...' : 'Select Directory'}
              </Button>
              
              {hasChanges && (
                <Button
                  variant="light"
                  onClick={clearSelection}
                  disabled={isValidating}
                  size="md"
                >
                  Cancel
                </Button>
              )}
            </Group>

            {/* Selected Path Display */}
            {selectedPath && selectedPath !== currentVaultLocation && (
              <Box>
                <Text fw={500} mb="xs">Selected Path:</Text>
                <Code block p="sm" bg="blue.0">
                  {selectedPath}
                </Code>
              </Box>
            )}

            {/* Validation Status */}
            {isValidating && (
              <Alert 
                icon={<Loader size={16} />} 
                title="Validating directory..."
                color="blue"
                variant="light"
              />
            )}

            {/* Validation Results */}
            {validationResult && !isValidating && (
              <Stack gap="md">
                <Stack gap="xs">
                  <Alert
                    icon={validationResult.is_valid ? <IconCheck size={16} /> : <IconX size={16} />}
                    title={validationResult.is_valid ? "Directory is accessible" : "Directory is not accessible"}
                    color={validationResult.is_valid ? "green" : "red"}
                    variant="light"
                  />
                  
                  {validationResult.is_valid && (
                    <Alert
                      icon={validationResult.is_writable ? <IconCheck size={16} /> : <IconX size={16} />}
                      title={validationResult.is_writable ? "Directory is writable" : "Directory is not writable"}
                      color={validationResult.is_writable ? "green" : "red"}
                      variant="light"
                    />
                  )}

                  {validationResult.has_existing_vault && (
                    <Alert
                      icon={<IconInfoCircle size={16} />}
                      title="Existing vault found"
                      color="blue"
                      variant="light"
                    >
                      <Group gap="xs" mt="xs">
                        <Badge leftSection={<IconLock size={12} />} variant="light">
                          {validationResult.vault_info?.name || 'Unknown'}
                        </Badge>
                        {validationResult.vault_info?.created_at && (
                          <Text size="sm" c="dimmed">
                            Created {new Date(validationResult.vault_info.created_at).toLocaleDateString()}
                          </Text>
                        )}
                      </Group>
                    </Alert>
                  )}
                </Stack>

                {canConfirm && (
                  <Button
                    onClick={handleConfirm}
                    size="md"
                    leftSection={validationResult.has_existing_vault ? <IconLock size={16} /> : <IconFolder size={16} />}
                  >
                    {validationResult.has_existing_vault ? 'Use Existing Vault' : 'Set Vault Location'}
                  </Button>
                )}
              </Stack>
            )}

            {/* Error Display */}
            {error && (
              <Alert
                icon={<IconAlertTriangle size={16} />}
                title="Error"
                color="red"
                variant="light"
              >
                {error}
              </Alert>
            )}
          </Stack>

          <Divider />

          {/* Info Section */}
          <Box>
            <Title order={4} mb="md">About Vault Location</Title>
            <List spacing="xs" size="sm">
              <List.Item>Your vault contains all your encrypted notes and settings</List.Item>
              <List.Item>Choose a location that you can regularly back up</List.Item>
              <List.Item>The directory must be writable by the application</List.Item>
              <List.Item>You can change this location later in settings</List.Item>
            </List>
          </Box>
        </Stack>
      </Paper>
    </Container>
  );
} 