import { useState, useCallback, useEffect } from 'react';
import { api } from '../utils/api';
import type { VaultSelectionState } from '../types';

export function useVaultLocation() {
  const [state, setState] = useState<VaultSelectionState>({
    selectedPath: null,
    isValidating: false,
    validationResult: null,
    error: null,
  });

  const [currentVaultLocation, setCurrentVaultLocation] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load current vault location on mount
  useEffect(() => {
    const loadCurrentLocation = async () => {
      try {
        const location = await api.getCurrentVaultLocation();
        setCurrentVaultLocation(location);
        if (location) {
          setState(prev => ({
            ...prev,
            selectedPath: location,
          }));
        }
      } catch (error) {
        console.error('Failed to load current vault location:', error);
        setState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Unknown error',
        }));
      } finally {
        setIsLoading(false);
      }
    };

    loadCurrentLocation();
  }, []);

  const selectDirectory = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, error: null }));
      
      const selectedPath = await api.selectVaultDirectory();
      if (!selectedPath) {
        // User cancelled
        return;
      }

      setState(prev => ({
        ...prev,
        selectedPath,
        isValidating: true,
        validationResult: null,
      }));

      const validationResult = await api.validateVaultLocation(selectedPath);
      
      setState(prev => ({
        ...prev,
        isValidating: false,
        validationResult,
      }));

    } catch (error) {
      setState(prev => ({
        ...prev,
        isValidating: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  }, []);

  const confirmSelection = useCallback(async () => {
    if (!state.selectedPath || !state.validationResult?.is_valid) {
      return;
    }

    try {
      setState(prev => ({ ...prev, error: null }));
      
      await api.setVaultLocation(state.selectedPath);
      setCurrentVaultLocation(state.selectedPath);
      
      // Clear selection state after successful save
      setState(prev => ({
        ...prev,
        selectedPath: state.selectedPath,
        validationResult: null,
      }));

    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  }, [state.selectedPath, state.validationResult]);

  const clearSelection = useCallback(() => {
    setState({
      selectedPath: currentVaultLocation,
      isValidating: false,
      validationResult: null,
      error: null,
    });
  }, [currentVaultLocation]);

  const validatePath = useCallback(async (path: string) => {
    try {
      setState(prev => ({
        ...prev,
        selectedPath: path,
        isValidating: true,
        validationResult: null,
        error: null,
      }));

      const validationResult = await api.validateVaultLocation(path);
      
      setState(prev => ({
        ...prev,
        isValidating: false,
        validationResult,
      }));

    } catch (error) {
      setState(prev => ({
        ...prev,
        isValidating: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  }, []);

  return {
    ...state,
    currentVaultLocation,
    isLoading,
    selectDirectory,
    confirmSelection,
    clearSelection,
    validatePath,
    hasChanges: state.selectedPath !== currentVaultLocation,
    canConfirm: state.selectedPath && state.validationResult?.is_valid && state.validationResult?.is_writable,
  };
} 