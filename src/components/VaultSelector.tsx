import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { 
  Container, 
  Paper, 
  Title, 
  Text, 
  Button, 
  Group, 
  Stack, 
  Alert, 
  Badge,
  Loader,
  Center,
  Card,
  ActionIcon,
  Menu,
  Modal,
  TextInput,
  SimpleGrid,
  Avatar
} from '@mantine/core';
import { 
  IconLock, 
  IconAlertTriangle,
  IconPlus,
  IconFolder,
  IconStar,
  IconStarFilled,
  IconDotsVertical,
  IconTrash,
  IconEdit,
  IconClock,
  IconFolderOpen,
  IconLink,
  IconCheck
} from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';
import { api } from '../utils/api';
import type { KnownVault, VaultLocationInfo } from '../types';

interface VaultSelectorProps {
  onVaultSelected?: (vaultId: string) => void;
}

export function VaultSelector({ onVaultSelected }: VaultSelectorProps) {
  const navigate = useNavigate();
  
  // State
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [knownVaults, setKnownVaults] = useState<KnownVault[]>([]);
  const [recentVaults, setRecentVaults] = useState<KnownVault[]>([]);
  const [favoriteVaults, setFavoriteVaults] = useState<KnownVault[]>([]);
  
  // Modal states
  const [linkModalOpened, { open: openLinkModal, close: closeLinkModal }] = useDisclosure(false);
  const [editModalOpened, { open: openEditModal, close: closeEditModal }] = useDisclosure(false);

  // Clear form states when modals close
  const handleCloseLinkModal = () => {
    setNewVaultName('');
    setNewVaultPath('');
    setPathValidation(null);
    closeLinkModal();
  };

  const handleCloseEditModal = () => {
    setEditingVault(null);
    setEditVaultName('');
    closeEditModal();
  };
  
  // Form states
  const [newVaultName, setNewVaultName] = useState('');
  const [newVaultPath, setNewVaultPath] = useState('');
  const [editingVault, setEditingVault] = useState<KnownVault | null>(null);
  const [editVaultName, setEditVaultName] = useState('');
  
  // Validation states
  const [isValidatingPath, setIsValidatingPath] = useState(false);
  const [pathValidation, setPathValidation] = useState<VaultLocationInfo | null>(null);
  
  useEffect(() => {
    loadVaults();
  }, []);

  const loadVaults = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [known, recent, favorite] = await Promise.all([
        api.getKnownVaults(),
        api.getRecentVaults(),
        api.getFavoriteVaults(),
      ]);
      
      setKnownVaults(known);
      setRecentVaults(recent);
      setFavoriteVaults(favorite);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load vaults');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectVault = async (vault: KnownVault) => {
    try {
      // Set as current vault
      await api.setCurrentVault(vault.id);
      
      if (onVaultSelected) {
        onVaultSelected(vault.id);
      } else {
        // Check if vault needs unlocking
        const setupInfo = await api.checkVaultSetupStatus(vault.path);
        
        if (setupInfo.needs_password && setupInfo.vault_info) {
          // Existing encrypted vault needs unlock
          navigate('/vault-unlock');
        } else {
          // Vault is ready, go to main app
          navigate('/app');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to select vault');
    }
  };

  const handleToggleFavorite = async (vault: KnownVault) => {
    try {
      await api.updateVaultMetadata({
        vault_id: vault.id,
        is_favorite: !vault.is_favorite,
      });
      await loadVaults();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update favorite status');
    }
  };

  const handleDeleteVault = async (vaultId: string) => {
    try {
      await api.removeKnownVault(vaultId);
      await loadVaults();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove vault');
    }
  };

  const handleCreateVault = () => {
    navigate('/vault-creator');
  };

  const handleLinkVault = async () => {
    if (!newVaultName.trim() || !newVaultPath.trim()) return;
    
    try {
      const result = await api.addKnownVault({
        name: newVaultName.trim(),
        path: newVaultPath.trim(),
      });
      
      if (result.success && result.vault_id) {
        // Set the linked vault as current
        await api.setCurrentVault(result.vault_id);
        
        handleCloseLinkModal();
        await loadVaults();
        
        // Check if the linked vault needs unlocking
        const setupInfo = await api.checkVaultSetupStatus(newVaultPath);
        if (setupInfo.needs_password && setupInfo.vault_info) {
          // Existing encrypted vault needs unlock
          navigate('/vault-unlock');
        } else {
          // Vault is ready, go to main app
          navigate('/app');
        }
      } else {
        setError(result.error_message || 'Failed to link vault');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to link vault');
    }
  };

  const handleSelectDirectory = async () => {
    try {
      const path = await api.selectVaultDirectory();
      if (path) {
        setNewVaultPath(path);
        
        // Auto-validate the path
        setIsValidatingPath(true);
        try {
          const validation = await api.validateVaultLocation(path);
          setPathValidation(validation);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to validate path');
        } finally {
          setIsValidatingPath(false);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to select directory');
    }
  };

  const formatLastAccessed = (date: string | null | undefined) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleDateString();
  };

  const VaultCard = ({ vault, showMenu = true }: { vault: KnownVault; showMenu?: boolean }) => (
    <Card 
      key={vault.id} 
      shadow="sm" 
      padding="lg" 
      radius="md" 
      withBorder
      style={{ cursor: 'pointer' }}
      onClick={() => handleSelectVault(vault)}
    >
      <Group justify="space-between" mb="xs">
        <Group gap="sm">
          <Avatar size="sm" radius="sm" color="blue">
            <IconFolder size={16} />
          </Avatar>
          <Text fw={500} size="sm">{vault.name}</Text>
        </Group>
        <Group gap="xs">
          {vault.is_favorite && (
            <IconStarFilled size={16} color="gold" />
          )}
          {showMenu && (
            <Menu shadow="md" width={200}>
              <Menu.Target>
                <ActionIcon 
                  variant="subtle" 
                  size="sm"
                  onClick={(e) => e.stopPropagation()}
                >
                  <IconDotsVertical size={16} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item
                  leftSection={<IconStar size={14} />}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleFavorite(vault);
                  }}
                >
                  {vault.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconEdit size={14} />}
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingVault(vault);
                    setEditVaultName(vault.name);
                    openEditModal();
                  }}
                >
                  Rename
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item
                  leftSection={<IconTrash size={14} />}
                  color="red"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteVault(vault.id);
                  }}
                >
                  Remove
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          )}
        </Group>
      </Group>
      
      <Text size="xs" c="dimmed" mb="sm" truncate>
        {vault.path}
      </Text>
      
      <Group justify="space-between">
        <Badge variant="light" size="xs">
          <IconClock size={10} style={{ marginRight: 4 }} />
          {formatLastAccessed(vault.last_accessed)}
        </Badge>
      </Group>
    </Card>
  );

  if (isLoading) {
    return (
      <Center h="100vh">
        <Stack align="center" gap="md">
          <Loader size="lg" />
          <Text>Loading vaults...</Text>
        </Stack>
      </Center>
    );
  }

  return (
    <Container size="lg" py="xl">
      <Stack gap="xl">
        {/* Header */}
        <Paper shadow="sm" radius="md" p="xl">
          <Stack gap="md" align="center">
            <Group gap="sm">
              <IconLock size={32} />
              <Title order={1}>Cocobolo</Title>
            </Group>
            <Text size="lg" c="dimmed" ta="center">
              Select a vault to continue, or create a new one
            </Text>
          </Stack>
        </Paper>

        {/* Error Alert */}
        {error && (
          <Alert icon={<IconAlertTriangle size={16} />} title="Error" color="red" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Action Buttons */}
        <Group justify="center" gap="md">
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={handleCreateVault}
            size="md"
          >
            Create New Vault
          </Button>
          <Button
            leftSection={<IconLink size={16} />}
            onClick={openLinkModal}
            variant="light"
            size="md"
          >
            Link Existing Vault
          </Button>
        </Group>

        {/* Recent Vaults */}
        {recentVaults.length > 0 && (
          <Stack gap="md">
            <Title order={3}>Recent Vaults</Title>
            <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
              {recentVaults.map((vault) => (
                <VaultCard key={vault.id} vault={vault} />
              ))}
            </SimpleGrid>
          </Stack>
        )}

        {/* Favorite Vaults */}
        {favoriteVaults.length > 0 && (
          <Stack gap="md">
            <Title order={3}>Favorite Vaults</Title>
            <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
              {favoriteVaults.map((vault) => (
                <VaultCard key={vault.id} vault={vault} />
              ))}
            </SimpleGrid>
          </Stack>
        )}

        {/* All Vaults */}
        {knownVaults.length > 0 && (
          <Stack gap="md">
            <Title order={3}>All Vaults</Title>
            <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
              {knownVaults.map((vault) => (
                <VaultCard key={vault.id} vault={vault} />
              ))}
            </SimpleGrid>
          </Stack>
        )}

        {/* Empty State */}
        {knownVaults.length === 0 && (
          <Paper shadow="sm" radius="md" p="xl">
            <Stack align="center" gap="md">
              <IconFolderOpen size={48} color="gray" />
              <Title order={3}>No Vaults Found</Title>
              <Text c="dimmed" ta="center">
                Get started by creating a new vault or linking an existing one
              </Text>
            </Stack>
          </Paper>
        )}
      </Stack>



      {/* Link Vault Modal */}
      <Modal
        opened={linkModalOpened}
        onClose={handleCloseLinkModal}
        title="Link Existing Vault"
        size="md"
      >
        <Stack gap="md">
          <TextInput
            label="Vault Name"
            placeholder="My Existing Vault"
            value={newVaultName}
            onChange={(e) => setNewVaultName(e.target.value)}
            required
          />
          
          <Stack gap="xs">
            <Text size="sm" fw={500}>Vault Location</Text>
            <Group gap="sm">
              <TextInput
                placeholder="Select existing vault directory..."
                value={newVaultPath}
                onChange={(e) => setNewVaultPath(e.target.value)}
                style={{ flex: 1 }}
                required
              />
              <Button onClick={handleSelectDirectory} variant="light">
                Browse
              </Button>
            </Group>
          </Stack>

          {/* Path Validation */}
          {isValidatingPath && (
            <Alert icon={<Loader size={16} />} color="blue">
              Validating vault location...
            </Alert>
          )}

          {pathValidation && (
            <Alert 
              icon={pathValidation.is_valid ? <IconCheck size={16} /> : <IconAlertTriangle size={16} />}
              color={pathValidation.is_valid ? "green" : "red"}
            >
              {pathValidation.is_valid ? (
                <>
                  Valid vault directory found
                  {pathValidation.has_existing_vault && pathValidation.vault_info && (
                    <Text size="sm" mt="xs">
                      Existing vault: {pathValidation.vault_info.name}
                    </Text>
                  )}
                </>
              ) : (
                "Invalid vault directory"
              )}
            </Alert>
          )}

          <Group justify="flex-end" gap="sm">
            <Button variant="light" onClick={handleCloseLinkModal}>
              Cancel
            </Button>
            <Button 
              onClick={handleLinkVault}
              disabled={!newVaultName.trim() || !newVaultPath.trim() || !pathValidation?.is_valid}
            >
              Link Vault
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Edit Vault Modal */}
      <Modal
        opened={editModalOpened}
        onClose={handleCloseEditModal}
        title="Rename Vault"
        size="sm"
      >
        <Stack gap="md">
          <TextInput
            label="Vault Name"
            value={editVaultName}
            onChange={(e) => setEditVaultName(e.target.value)}
            required
          />

          <Group justify="flex-end" gap="sm">
            <Button variant="light" onClick={handleCloseEditModal}>
              Cancel
            </Button>
            <Button 
              onClick={async () => {
                if (editingVault && editVaultName.trim()) {
                  try {
                    await api.updateVaultMetadata({
                      vault_id: editingVault.id,
                      name: editVaultName.trim(),
                    });
                    await loadVaults();
                    handleCloseEditModal();
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Failed to rename vault');
                  }
                }
              }}
              disabled={!editVaultName.trim()}
            >
              Save
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
} 