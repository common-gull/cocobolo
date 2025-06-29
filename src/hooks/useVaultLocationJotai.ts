import { useAtomValue, useSetAtom } from 'jotai';
import { useCallback } from 'react';
import { 
  currentVaultLocationAtom, 
  vaultConfigLoadingAtom,
  selectedVaultPathAtom, 
  vaultValidationLoadingAtom, 
  vaultValidationResultAtom, 
  vaultLocationErrorAtom,
  vaultLocationChangesAtom,
  validateVaultLocationAtom,
  confirmVaultLocationAtom
} from '../stores/notesStore';
import { api } from '../utils/api';

export function useVaultLocationJotai() {
  // Read atoms
  const currentVaultLocation = useAtomValue(currentVaultLocationAtom);
  const isConfigLoading = useAtomValue(vaultConfigLoadingAtom);
  const selectedPath = useAtomValue(selectedVaultPathAtom);
  const isValidating = useAtomValue(vaultValidationLoadingAtom);
  const validationResult = useAtomValue(vaultValidationResultAtom);
  const error = useAtomValue(vaultLocationErrorAtom);
  const hasChanges = useAtomValue(vaultLocationChangesAtom);

  // Write atoms
  const validatePath = useSetAtom(validateVaultLocationAtom);
  const confirmSelection = useSetAtom(confirmVaultLocationAtom);

  // Note: Vault location loading is now handled by initializeVaultSessionAtom
  // This hook only reads the state and provides selection functionality

  const selectDirectory = useCallback(async () => {
    try {
      const selectedPath = await api.selectVaultDirectory();
      if (selectedPath) {
        validatePath(selectedPath);
      }
    } catch (error) {
      console.error('Failed to select directory:', error);
    }
  }, [validatePath]);

  const clearSelection = useCallback(async () => {
    // Reset to current location
    const { selectedVaultPathAtom, vaultValidationResultAtom, vaultLocationErrorAtom } = await import('../stores/notesStore');
    const { getDefaultStore } = await import('jotai');
    const store = getDefaultStore();
    store.set(selectedVaultPathAtom, currentVaultLocation);
    store.set(vaultValidationResultAtom, null);
    store.set(vaultLocationErrorAtom, null);
  }, [currentVaultLocation]);

  const canConfirm = selectedPath && 
    validationResult?.is_valid && 
    validationResult?.is_writable;

  return {
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
    validatePath,
  };
} 