import { useState, useCallback } from 'react';
import { api } from '../utils/api';
import type { CreateNoteRequest, CreateNoteResult } from '../types';
import './CreateNote.css';

interface CreateNoteProps {
  vaultPath: string;
  sessionId: string;
  onNoteCreated?: (noteId: string) => void;
  onCancel?: () => void;
}

interface CreateNoteState {
  title: string;
  content: string;
  tags: string;
  folderPath: string;
  isCreating: boolean;
  error: string | null;
}

export function CreateNote({ vaultPath, sessionId, onNoteCreated, onCancel }: CreateNoteProps) {
  const [state, setState] = useState<CreateNoteState>({
    title: '',
    content: '',
    tags: '',
    folderPath: '',
    isCreating: false,
    error: null,
  });

  const handleTitleChange = useCallback((title: string) => {
    setState(prev => ({ ...prev, title, error: null }));
  }, []);

  const handleContentChange = useCallback((content: string) => {
    setState(prev => ({ ...prev, content }));
  }, []);

  const handleTagsChange = useCallback((tags: string) => {
    setState(prev => ({ ...prev, tags }));
  }, []);

  const handleFolderPathChange = useCallback((folderPath: string) => {
    setState(prev => ({ ...prev, folderPath }));
  }, []);

  const canCreateNote = () => {
    return (
      state.title.trim().length > 0 &&
      state.title.trim().length <= 200 &&
      !state.isCreating
    );
  };

  const handleCreateNote = async () => {
    if (!canCreateNote()) return;

    try {
      setState(prev => ({ ...prev, isCreating: true, error: null }));

      const request: CreateNoteRequest = {
        title: state.title.trim(),
        ...(state.content.trim() && { content: state.content.trim() }),
        ...(state.tags.trim() && { 
          tags: state.tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0)
        }),
        ...(state.folderPath.trim() && { folder_path: state.folderPath.trim() }),
      };

      const result: CreateNoteResult = await api.createNote(vaultPath, sessionId, request);

      if (result.success && result.note) {
        setState(prev => ({ ...prev, isCreating: false }));
        
        if (onNoteCreated) {
          onNoteCreated(result.note.id);
        }
      } else {
        setState(prev => ({
          ...prev,
          isCreating: false,
          error: result.error_message || 'Failed to create note',
        }));
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        isCreating: false,
        error: error instanceof Error ? error.message : 'Failed to create note',
      }));
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleCreateNote();
    }
  };

  const getTitleValidationStatus = () => {
    const titleLength = state.title.trim().length;
    if (titleLength === 0) return null;
    if (titleLength > 200) return { valid: false, message: 'Title cannot exceed 200 characters' };
    return { valid: true, message: '' };
  };

  const titleValidation = getTitleValidationStatus();

  return (
    <div className="create-note">
      <div className="header">
        <h2>Create New Note</h2>
        <p>Add a new note to your encrypted vault</p>
      </div>

      <div className="form-section">
        <div className="form-group">
          <label htmlFor="note-title">Title *</label>
          <input
            id="note-title"
            type="text"
            value={state.title}
            onChange={(e) => handleTitleChange(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Enter note title"
            disabled={state.isCreating}
            className={`form-input ${titleValidation && !titleValidation.valid ? 'invalid' : ''}`}
            autoFocus
            maxLength={250} // Allow a bit more for better UX, but validate at 200
          />
          {titleValidation && !titleValidation.valid && (
            <div className="validation-error">
              <span className="icon icon-warning"></span>
              <span>{titleValidation.message}</span>
            </div>
          )}
          <div className="character-count">
            {state.title.length}/200
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="note-content">Content</label>
          <textarea
            id="note-content"
            value={state.content}
            onChange={(e) => handleContentChange(e.target.value)}
            placeholder="Start writing your note..."
            disabled={state.isCreating}
            className="form-textarea"
            rows={10}
          />
        </div>

        <div className="form-group">
          <label htmlFor="note-tags">Tags</label>
          <input
            id="note-tags"
            type="text"
            value={state.tags}
            onChange={(e) => handleTagsChange(e.target.value)}
            placeholder="tag1, tag2, tag3"
            disabled={state.isCreating}
            className="form-input"
          />
          <div className="form-help">
            Separate tags with commas
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="note-folder">Folder Path</label>
          <input
            id="note-folder"
            type="text"
            value={state.folderPath}
            onChange={(e) => handleFolderPathChange(e.target.value)}
            placeholder="folder/subfolder"
            disabled={state.isCreating}
            className="form-input"
          />
          <div className="form-help">
            Optional folder path to organize your note
          </div>
        </div>
      </div>

      {state.error && (
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
            disabled={state.isCreating}
          >
            Cancel
          </button>
        )}
        
        <button 
          className="create-button primary"
          onClick={handleCreateNote}
          disabled={!canCreateNote()}
        >
          {state.isCreating ? (
            <>
              <div className="spinner small"></div>
              Creating Note...
            </>
          ) : (
            <>
              <span className="icon icon-file"></span>
              Create Note
            </>
          )}
        </button>
      </div>

      <div className="keyboard-shortcuts">
        <h3>
          <span className="icon icon-keyboard"></span> Keyboard Shortcuts
        </h3>
        <ul>
          <li><kbd>Ctrl/Cmd + Enter</kbd> - Create note</li>
          <li><kbd>Escape</kbd> - Cancel (if available)</li>
        </ul>
      </div>
    </div>
  );
} 