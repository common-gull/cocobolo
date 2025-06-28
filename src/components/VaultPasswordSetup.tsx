import { useState, useCallback, useEffect } from 'react';
import { api } from '../utils/api';
import type { PasswordSetupState, VaultInfo } from '../types';
import './VaultPasswordSetup.css';

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

  const togglePasswordVisibility = useCallback(() => {
    setState(prev => ({ ...prev, showPassword: !prev.showPassword }));
  }, []);

  const toggleConfirmPasswordVisibility = useCallback(() => {
    setState(prev => ({ ...prev, showConfirmPassword: !prev.showConfirmPassword }));
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

  const getStrengthColor = (score: number) => {
    switch (score) {
      case 0:
      case 1:
        return 'var(--error-color)';
      case 2:
        return 'var(--warning-color)';
      case 3:
        return 'var(--info-color)';
      case 4:
      default:
        return 'var(--success-color)';
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

  return (
    <div className="vault-password-setup">
      <div className="header">
        <h2>Create Vault Password</h2>
        <p>Set a strong password to encrypt your notes</p>
      </div>

      <div className="form-section">
        <div className="form-group">
          <label htmlFor="vault-name">Vault Name</label>
          <input
            id="vault-name"
            type="text"
            value={state.vaultName}
            onChange={(e) => handleVaultNameChange(e.target.value)}
            placeholder="Enter a name for your vault"
            disabled={state.isCreating}
            className="form-input"
          />
        </div>

        <div className="form-group">
          <label htmlFor="password">Password</label>
          <div className="password-input-container">
            <input
              id="password"
              type={state.showPassword ? 'text' : 'password'}
              value={state.password}
              onChange={(e) => handlePasswordChange(e.target.value)}
              placeholder="Enter a strong password"
              disabled={state.isCreating}
              className="form-input password-input"
            />
            <button
              type="button"
              className="password-toggle"
              onClick={togglePasswordVisibility}
              disabled={state.isCreating}
            >
              <span className={`icon ${state.showPassword ? 'icon-eye-slash' : 'icon-eye'}`}></span>
            </button>
          </div>
          
          {state.isValidating && (
            <div className="validation-status">
              <div className="spinner small"></div>
              <span>Checking password strength...</span>
            </div>
          )}

          {state.passwordStrength && !state.isValidating && (
            <div className="password-strength">
              <div className="strength-header">
                <span className="strength-label">
                  Password Strength: 
                  <span 
                    className="strength-score"
                    style={{ color: getStrengthColor(state.passwordStrength.score) }}
                  >
                    {getStrengthLabel(state.passwordStrength.score)}
                  </span>
                </span>
                <div className="strength-bar">
                  <div 
                    className="strength-fill"
                    style={{ 
                      width: `${(state.passwordStrength.score / 4) * 100}%`,
                      backgroundColor: getStrengthColor(state.passwordStrength.score)
                    }}
                  />
                </div>
              </div>

              {state.passwordStrength.issues.length > 0 && (
                <div className="strength-issues">
                  <h4>Requirements:</h4>
                  <ul>
                    {state.passwordStrength.issues.map((issue, index) => (
                      <li key={index} className="issue-item">
                        <span className="icon icon-warning"></span>
                        {issue}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {state.passwordStrength.suggestions.length > 0 && (
                <div className="strength-suggestions">
                  <h4>Suggestions:</h4>
                  <ul>
                    {state.passwordStrength.suggestions.map((suggestion, index) => (
                      <li key={index} className="suggestion-item">
                        <span className="icon icon-lightbulb"></span>
                        {suggestion}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="confirm-password">Confirm Password</label>
          <div className="password-input-container">
            <input
              id="confirm-password"
              type={state.showConfirmPassword ? 'text' : 'password'}
              value={state.confirmPassword}
              onChange={(e) => handleConfirmPasswordChange(e.target.value)}
              placeholder="Confirm your password"
              disabled={state.isCreating}
              className={`form-input password-input ${
                getPasswordMatchStatus() === false ? 'invalid' : ''
              }`}
            />
            <button
              type="button"
              className="password-toggle"
              onClick={toggleConfirmPasswordVisibility}
              disabled={state.isCreating}
            >
              <span className={`icon ${state.showConfirmPassword ? 'icon-eye-slash' : 'icon-eye'}`}></span>
            </button>
          </div>
          
          {state.confirmPassword && getPasswordMatchStatus() !== null && (
            <div className={`password-match ${getPasswordMatchStatus() ? 'valid' : 'invalid'}`}>
              <span className={`icon ${getPasswordMatchStatus() ? 'icon-check' : 'icon-x'}`}></span>
              <span>
                {getPasswordMatchStatus() ? 'Passwords match' : 'Passwords do not match'}
              </span>
            </div>
          )}
        </div>
      </div>

      {state.error && (
        <div className="error-message">
          <span className="icon icon-warning"></span>
          <span>{state.error}</span>
        </div>
      )}

      <div className="security-notice">
        <h3>
          <span className="icon icon-lock"></span> Security Notice
        </h3>
        <ul>
          <li>Your password is used to encrypt all your notes</li>
          <li>We never store your password - only an encrypted hash</li>
          <li>If you forget your password, your notes cannot be recovered</li>
          <li>Choose a password you can remember but others cannot guess</li>
        </ul>
      </div>

      <div className="form-actions">
        {onCancel && (
          <button 
            className="cancel-button secondary"
            onClick={onCancel}
            disabled={state.isCreating}
          >
            Cancel
          </button>
        )}
        
        <button 
          className="create-button primary"
          onClick={handleCreateVault}
          disabled={!canCreateVault()}
        >
          {state.isCreating ? (
            <>
              <div className="spinner small"></div>
              Creating Vault...
            </>
          ) : (
            'Create Encrypted Vault'
          )}
        </button>
      </div>
    </div>
  );
} 