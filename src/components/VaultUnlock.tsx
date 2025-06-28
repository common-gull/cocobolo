import { useState, useCallback, useEffect } from 'react';
import { api } from '../utils/api';
import type { VaultUnlockState, VaultInfo, VaultUnlockResult } from '../types';
import './VaultUnlock.css';

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

  const togglePasswordVisibility = useCallback(() => {
    setState(prev => ({ ...prev, showPassword: !prev.showPassword }));
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
    <div className="vault-unlock">
      <div className="header">
        <div className="vault-icon">
          <span className="icon icon-lock"></span>
        </div>
        <h2>Unlock Vault</h2>
        <div className="vault-info">
          <h3>{vaultInfo.name}</h3>
          <div className="vault-details">
            <span className="encryption-badge">
              <span className="icon icon-lock"></span> Encrypted
            </span>
            <span className="created-date">
              Created: {new Date(vaultInfo.created_at).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>

      <div className="unlock-form">
        <div className="form-group">
          <label htmlFor="unlock-password">Enter your vault password</label>
          <div className="password-input-container">
            <input
              id="unlock-password"
              type={state.showPassword ? 'text' : 'password'}
              value={state.password}
              onChange={(e) => handlePasswordChange(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Password"
              disabled={state.isUnlocking || isRateLimited}
              className={`form-input password-input ${state.error ? 'invalid' : ''}`}
              autoFocus
            />
            <button
              type="button"
              className="password-toggle"
              onClick={togglePasswordVisibility}
              disabled={state.isUnlocking || isRateLimited}
            >
              <span className={`icon ${state.showPassword ? 'icon-eye-slash' : 'icon-eye'}`}></span>
            </button>
          </div>
        </div>

        {isRateLimited && timeRemaining && (
                  <div className="rate-limit-warning">
          <span className="icon icon-clock"></span>
            <div className="rate-limit-content">
              <h4>Too Many Failed Attempts</h4>
              <p>
                Please wait {formatTimeRemaining(timeRemaining)} before trying again.
                This security measure helps protect your vault from unauthorized access.
              </p>
            </div>
          </div>
        )}

        {state.error && !isRateLimited && (
          <div className="error-message">
            <span className="icon icon-warning"></span>
            <span>{state.error}</span>
          </div>
        )}

        <div className="form-actions">
          {onCancel && (
            <button 
              className="cancel-button secondary"
              onClick={onCancel}
              disabled={state.isUnlocking}
            >
              Cancel
            </button>
          )}
          
          <button 
            className="unlock-button primary"
            onClick={handleUnlock}
            disabled={!canUnlock()}
          >
            {state.isUnlocking ? (
              <>
                <div className="spinner small"></div>
                Unlocking...
              </>
            ) : isRateLimited ? (
              'Rate Limited'
            ) : (
              'Unlock Vault'
            )}
          </button>
        </div>
      </div>

      <div className="security-info">
        <h3>
          <span className="icon icon-info"></span> Security Information
        </h3>
        <ul>
          <li>Your password is never stored or transmitted in plain text</li>
          <li>Failed unlock attempts are rate-limited to prevent brute force attacks</li>
          <li>Sessions automatically expire after 30 minutes of inactivity</li>
          <li>All vault data is encrypted with military-grade ChaCha20Poly1305</li>
        </ul>
      </div>
    </div>
  );
} 