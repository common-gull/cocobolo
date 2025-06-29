import { useAtomValue, useSetAtom } from 'jotai';
import { useCallback, useEffect } from 'react';
import { 
  currentVaultLocationAtom, 
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
  const selectedPath = useAtomValue(selectedVaultPathAtom);
  const isValidating = useAtomValue(vaultValidationLoadingAtom);
  const validationResult = useAtomValue(vaultValidationResultAtom);
  const error = useAtomValue(vaultLocationErrorAtom);
  const hasChanges = useAtomValue(vaultLocationChangesAtom);

  // Write atoms
  const validatePath = useSetAtom(validateVaultLocationAtom);
  const confirmSelection = useSetAtom(confirmVaultLocationAtom);

  // Load current vault location on mount
  useEffect(() => {
    const loadCurrentLocation = async () => {
      try {
        const location = await api.getCurrentVaultLocation();
        // Update the atom directly
        const { currentVaultLocationAtom, selectedVaultPathAtom } = await import('../stores/notesStore');
        const { getDefaultStore } = await import('jotai');
        const store = getDefaultStore();
        store.set(currentVaultLocationAtom, location);
        
        if (location) {
          store.set(selectedVaultPathAtom, location);
        }
      } catch (error) {
        console.error('Failed to load current vault location:', error);
        const { vaultLocationErrorAtom } = await import('../stores/notesStore');
        const { getDefaultStore } = await import('jotai');
        const store = getDefaultStore();
        store.set(vaultLocationErrorAtom, error instanceof Error ? error.message : 'Unknown error');
      }
    };

    loadCurrentLocation();
  }, []);

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