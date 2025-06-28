
import { useVaultLocation } from '../hooks/useVaultLocation';
import './VaultLocationSelector.css';

interface VaultLocationSelectorProps {
  onLocationSet?: (path: string) => void;
}

export function VaultLocationSelector({ onLocationSet }: VaultLocationSelectorProps) {
  const {
    selectedPath,
    currentVaultLocation,
    isValidating,
    validationResult,
    error,
    isLoading,
    selectDirectory,
    confirmSelection,
    clearSelection,
    hasChanges,
    canConfirm,
  } = useVaultLocation();

  const handleConfirm = async () => {
    await confirmSelection();
    if (selectedPath && onLocationSet) {
      onLocationSet(selectedPath);
    }
  };

  if (isLoading) {
    return (
      <div className="vault-location-selector">
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading vault configuration...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="vault-location-selector">
      <div className="header">
        <h2>Vault Location</h2>
        <p>Choose where to store your encrypted notes</p>
      </div>

      <div className="current-location">
        <label>Current Vault Location:</label>
        <div className="location-display">
          {currentVaultLocation ? (
            <code className="path">{currentVaultLocation}</code>
          ) : (
            <span className="no-location">No vault location set</span>
          )}
        </div>
      </div>

      <div className="selection-area">
        <div className="selection-controls">
          <button 
            className="select-button primary"
            onClick={selectDirectory}
            disabled={isValidating}
          >
            {isValidating ? 'Validating...' : 'Select Directory'}
          </button>
          
          {hasChanges && (
            <button 
              className="clear-button secondary"
              onClick={clearSelection}
              disabled={isValidating}
            >
              Cancel
            </button>
          )}
        </div>

        {selectedPath && selectedPath !== currentVaultLocation && (
          <div className="selected-path">
            <label>Selected Path:</label>
            <code className="path">{selectedPath}</code>
          </div>
        )}

        {isValidating && (
          <div className="validation-status">
            <div className="spinner small"></div>
            <span>Validating directory...</span>
          </div>
        )}

        {validationResult && !isValidating && (
          <div className="validation-result">
            <div className={`status ${validationResult.is_valid ? 'valid' : 'invalid'}`}>
              {validationResult.is_valid ? (
                <div className="status-item valid">
                  <span className="icon icon-check"></span>
                  <span>Directory exists and is accessible</span>
                </div>
              ) : (
                <div className="status-item invalid">
                  <span className="icon icon-x"></span>
                  <span>Directory is not accessible</span>
                </div>
              )}
              
              {validationResult.is_valid && (
                <div className={`status-item ${validationResult.is_writable ? 'valid' : 'invalid'}`}>
                  <span className={`icon ${validationResult.is_writable ? 'icon-check' : 'icon-x'}`}></span>
                  <span>{validationResult.is_writable ? 'Directory is writable' : 'Directory is not writable'}</span>
                </div>
              )}

              {validationResult.has_existing_vault && (
                <div className="status-item info">
                  <span className="icon icon-info"></span>
                  <span>
                    Existing vault found: {validationResult.vault_info?.name || 'Unknown'}
                    {validationResult.vault_info?.created_at && (
                      <span className="vault-date">
                        {' '}(created {new Date(validationResult.vault_info.created_at).toLocaleDateString()})
                      </span>
                    )}
                  </span>
                </div>
              )}
            </div>

            {canConfirm && (
              <button 
                className="confirm-button primary"
                onClick={handleConfirm}
              >
                {validationResult.has_existing_vault ? 'Use Existing Vault' : 'Set Vault Location'}
              </button>
            )}
          </div>
        )}

        {error && (
          <div className="error-message">
            <span className="icon icon-warning"></span>
            <span>{error}</span>
          </div>
        )}
      </div>

      <div className="info-section">
        <h3>About Vault Location</h3>
        <ul>
          <li>Your vault contains all your encrypted notes and settings</li>
          <li>Choose a location that you can regularly back up</li>
          <li>The directory must be writable by the application</li>
          <li>You can change this location later in settings</li>
        </ul>
      </div>
    </div>
  );
} 