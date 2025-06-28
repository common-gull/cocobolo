import { useState, useEffect, useCallback } from 'react';
import { api } from '../utils/api';
import type { NoteMetadata } from '../types';
import './NotesList.css';

interface NotesListProps {
  vaultPath: string;
  sessionId: string;
  onCreateNote?: () => void;
  onSelectNote?: (noteId: string) => void;
}

interface NotesListState {
  notes: NoteMetadata[];
  filteredNotes: NoteMetadata[];
  searchQuery: string;
  isLoading: boolean;
  error: string | null;
}

export function NotesList({ vaultPath, sessionId, onCreateNote, onSelectNote }: NotesListProps) {
  const [state, setState] = useState<NotesListState>({
    notes: [],
    filteredNotes: [],
    searchQuery: '',
    isLoading: true,
    error: null,
  });

  const loadNotes = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const notes = await api.getNotesList(vaultPath, sessionId);
      
      // Sort notes by updated date (newest first)
      const sortedNotes = notes.sort((a, b) => 
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
      
      setState(prev => ({
        ...prev,
        notes: sortedNotes,
        filteredNotes: sortedNotes,
        isLoading: false,
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load notes',
      }));
    }
  }, [vaultPath, sessionId]);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  const handleSearchChange = useCallback((query: string) => {
    setState(prev => {
      const filteredNotes = query.trim() === '' 
        ? prev.notes
        : prev.notes.filter(note => 
            note.title.toLowerCase().includes(query.toLowerCase()) ||
            note.content_preview.toLowerCase().includes(query.toLowerCase()) ||
            note.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase()))
          );

      return {
        ...prev,
        searchQuery: query,
        filteredNotes,
      };
    });
  }, []);

  const handleNoteClick = (noteId: string) => {
    if (onSelectNote) {
      onSelectNote(noteId);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays === 1) {
      return `Yesterday at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const getTagColor = (tag: string) => {
    // Simple hash function to generate consistent colors for tags
    let hash = 0;
    for (let i = 0; i < tag.length; i++) {
      hash = tag.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 60%, 80%)`;
  };

  if (state.isLoading) {
    return (
      <div className="notes-list">
        <div className="notes-header">
          <h2>Your Notes</h2>
        </div>
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading your notes...</p>
        </div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="notes-list">
        <div className="notes-header">
          <h2>Your Notes</h2>
        </div>
        <div className="error-state">
          <span className="icon icon-warning"></span>
          <h3>Failed to load notes</h3>
          <p>{state.error}</p>
          <button className="retry-button primary" onClick={loadNotes}>
            <span className="icon icon-refresh"></span>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="notes-list">
      <div className="notes-header">
        <h2>Your Notes</h2>
        <div className="notes-actions">
          <button className="create-note-button primary" onClick={onCreateNote}>
            <span className="icon icon-file"></span>
            Create Note
          </button>
        </div>
      </div>

      <div className="search-section">
        <div className="search-input-container">
          <span className="icon icon-search"></span>
          <input
            type="text"
            value={state.searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search notes by title, content, or tags..."
            className="search-input"
          />
          {state.searchQuery && (
            <button
              className="clear-search"
              onClick={() => handleSearchChange('')}
            >
              <span className="icon icon-x"></span>
            </button>
          )}
        </div>
      </div>

      <div className="notes-stats">
        {state.searchQuery ? (
          <p>
            Showing {state.filteredNotes.length} of {state.notes.length} notes
            {state.filteredNotes.length === 0 && ' - try a different search term'}
          </p>
        ) : (
          <p>{state.notes.length} note{state.notes.length !== 1 ? 's' : ''} in your vault</p>
        )}
      </div>

      {state.notes.length === 0 ? (
        <div className="empty-state">
          <span className="icon icon-file"></span>
          <h3>No notes yet</h3>
          <p>Create your first note to get started with your secure vault.</p>
          <button className="create-first-note-button primary" onClick={onCreateNote}>
            <span className="icon icon-file"></span>
            Create Your First Note
          </button>
        </div>
      ) : state.filteredNotes.length === 0 ? (
        <div className="empty-search-state">
          <span className="icon icon-search"></span>
          <h3>No notes found</h3>
          <p>No notes match your search criteria. Try a different search term.</p>
        </div>
      ) : (
        <div className="notes-grid">
          {state.filteredNotes.map((note) => (
            <div
              key={note.id}
              className="note-card"
              onClick={() => handleNoteClick(note.id)}
            >
              <div className="note-header">
                <h3 className="note-title">{note.title}</h3>
                <div className="note-date">{formatDate(note.updated_at)}</div>
              </div>
              
              {note.content_preview && (
                <div className="note-preview">
                  {note.content_preview}
                </div>
              )}
              
              {note.tags.length > 0 && (
                <div className="note-tags">
                  {note.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="note-tag"
                      style={{ backgroundColor: getTagColor(tag) }}
                    >
                      {tag}
                    </span>
                  ))}
                  {note.tags.length > 3 && (
                    <span className="note-tag-more">
                      +{note.tags.length - 3}
                    </span>
                  )}
                </div>
              )}
              
              {note.folder_path && (
                <div className="note-folder">
                  <span className="icon icon-folder"></span>
                  {note.folder_path}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 