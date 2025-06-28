import { useState, useEffect, useCallback } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { Menu, rem, Modal, Button, Text, Group } from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';
import { api } from '../utils/api';
import type { NoteMetadata } from '../types';
import { Icons } from './Icons';
import { 
  notesAtom, 
  foldersAtom, 
  notesLoadingAtom, 
  notesErrorAtom,
  loadNotesAtom,
  addFolderAtom 
} from '../stores/notesStore';
import './NotesList.css';

interface NotesListProps {
  vaultPath: string;
  sessionId: string;
  selectedNoteId?: string;
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

export function NotesList({ vaultPath, sessionId, selectedNoteId, onCreateNote, onSelectNote }: NotesListProps) {
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
      
      // Sort notes by creation date (newest first) - Story 8 requirement
      const sortedNotes = notes.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
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
          <Icons.warning size="lg" />
          <h3>Failed to load notes</h3>
          <p>{state.error}</p>
          <button className="retry-button primary" onClick={loadNotes}>
            <Icons.refresh size="sm" />
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
            <Icons.file size="sm" />
            Create Note
          </button>
        </div>
      </div>

      <div className="search-section">
        <div className="search-input-container">
          <Icons.search size="sm" />
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
              <Icons.x size="sm" />
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
          <Icons.file size="xl" />
          <h3>No notes yet</h3>
          <p>Create your first note to get started with your secure vault.</p>
          <button className="create-first-note-button primary" onClick={onCreateNote}>
            <Icons.file size="sm" />
            Create Your First Note
          </button>
        </div>
      ) : state.filteredNotes.length === 0 ? (
        <div className="empty-search-state">
          <Icons.search size="xl" />
          <h3>No notes found</h3>
          <p>No notes match your search criteria. Try a different search term.</p>
        </div>
      ) : (
        <div className="notes-grid">
          {state.filteredNotes.map((note) => (
            <div
              key={note.id}
              className={`note-card ${selectedNoteId === note.id ? 'selected' : ''}`}
              onClick={() => handleNoteClick(note.id)}
            >
              <div className="note-header">
                <h3 className="note-title">{note.title}</h3>
                <div className="note-date">{formatDate(note.created_at)}</div>
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
                  <Icons.folder size="sm" />
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

// Compact sidebar version for navigation
interface SidebarNotesListProps {
  vaultPath: string;
  sessionId: string;
  selectedNoteId?: string;
  onSelectNote?: (noteId: string) => void;
  maxNotes?: number; // Limit number of notes shown
}

export function SidebarNotesList({ 
  vaultPath, 
  sessionId, 
  selectedNoteId, 
  onSelectNote,
  maxNotes = 10 
}: SidebarNotesListProps) {
  const [state, setState] = useState<{
    notes: NoteMetadata[];
    isLoading: boolean;
    error: string | null;
  }>({
    notes: [],
    isLoading: true,
    error: null,
  });

  const loadNotes = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const notes = await api.getNotesList(vaultPath, sessionId);
      
      // Sort notes by creation date (newest first) and limit for sidebar
      const sortedNotes = notes
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, maxNotes);
      
      setState(prev => ({
        ...prev,
        notes: sortedNotes,
        isLoading: false,
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load notes',
      }));
    }
  }, [vaultPath, sessionId, maxNotes]);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  const handleNoteClick = (noteId: string) => {
    if (onSelectNote) {
      onSelectNote(noteId);
    }
  };

  const formatCompactDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  if (state.isLoading) {
    return (
      <div className="sidebar-notes-list">
        <div className="sidebar-notes-loading">
          <div className="spinner small"></div>
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="sidebar-notes-list">
        <div className="sidebar-notes-error">
          <Icons.warning size="sm" />
          <span>Failed to load</span>
        </div>
      </div>
    );
  }

  if (state.notes.length === 0) {
    return (
      <div className="sidebar-notes-list">
        <div className="sidebar-notes-empty">
          <Icons.file size="sm" />
          <span>No notes yet</span>
        </div>
      </div>
    );
  }

  return (
    <div className="sidebar-notes-list">
      {state.notes.map((note) => (
        <div
          key={note.id}
          className={`sidebar-note-item ${selectedNoteId === note.id ? 'selected' : ''}`}
          onClick={() => handleNoteClick(note.id)}
          title={note.title}
        >
          <div className="sidebar-note-title">{note.title}</div>
          <div className="sidebar-note-meta">
            <span className="sidebar-note-date">{formatCompactDate(note.created_at)}</span>
            {note.tags.length > 0 && (
              <span className="sidebar-note-tags-count">
                {note.tags.length} tag{note.tags.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// Tree-based navigation for sidebar - Story 8 Enhancement
interface TreeNotesListProps {
  vaultPath: string;
  sessionId: string;
  selectedNoteId?: string;
  onSelectNote?: (noteId: string) => void;
  onCreateNote?: () => void;
}

interface FolderNode {
  name: string;
  path: string;
  children: FolderNode[];
  notes: NoteMetadata[];
  isExpanded: boolean;
}

export function TreeNotesList({ 
  vaultPath, 
  sessionId, 
  selectedNoteId, 
  onSelectNote,
  onCreateNote
}: TreeNotesListProps) {
  // Jotai state
  const notes = useAtomValue(notesAtom);
  const folders = useAtomValue(foldersAtom);
  const isLoading = useAtomValue(notesLoadingAtom);
  const error = useAtomValue(notesErrorAtom);
  const loadNotes = useSetAtom(loadNotesAtom);
  const addFolder = useSetAtom(addFolderAtom);

  // Local state for folder tree structure
  const [folderTree, setFolderTree] = useState<FolderNode>({ 
    name: 'Root', 
    path: '', 
    children: [], 
    notes: [], 
    isExpanded: true 
  });

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    opened: boolean;
    x: number;
    y: number;
    type: 'folder' | 'note';
    target: string;
  }>({
    opened: false,
    x: 0,
    y: 0,
    type: 'folder',
    target: ''
  });

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    opened: boolean;
    type: 'folder' | 'note';
    target: string;
    title: string;
  }>({
    opened: false,
    type: 'folder',
    target: '',
    title: ''
  });

  // Load notes on mount
  useEffect(() => {
    if (vaultPath && sessionId) {
      loadNotes({ vaultPath, sessionId });
    }
  }, [vaultPath, sessionId, loadNotes]);

  // Rebuild folder tree when notes or folders change
  useEffect(() => {
    const newFolderTree = buildFolderTree(notes, folders);
    setFolderTree(newFolderTree);
  }, [notes, folders]);

  // Close context menu on escape key or outside click
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setContextMenu(prev => ({ ...prev, opened: false }));
      }
    };

    const handleClick = () => {
      setContextMenu(prev => ({ ...prev, opened: false }));
    };

    if (contextMenu.opened) {
      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('click', handleClick);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        document.removeEventListener('click', handleClick);
      };
    }

    return () => {}; // Return empty cleanup function when not opened
  }, [contextMenu.opened]);

  const buildFolderTree = (notes: NoteMetadata[], virtualFolders: string[]): FolderNode => {
    const root: FolderNode = { name: 'Root', path: '', children: [], notes: [], isExpanded: true };
    const folderMap = new Map<string, FolderNode>();
    folderMap.set('', root);

    // Helper function to create folder path
    const createFolderPath = (folderPath: string) => {
      const pathParts = folderPath.split('/').filter(part => part.length > 0);
      let currentPath = '';
      
      pathParts.forEach(part => {
        const parentPath = currentPath;
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        
        if (!folderMap.has(currentPath)) {
          const newFolder: FolderNode = {
            name: part,
            path: currentPath,
            children: [],
            notes: [],
            isExpanded: false
          };
          
          folderMap.set(currentPath, newFolder);
          const parent = folderMap.get(parentPath)!;
          parent.children.push(newFolder);
        }
      });
    };

    // First pass: create all virtual folders
    virtualFolders.forEach(folderPath => {
      if (folderPath) {
        createFolderPath(folderPath);
      }
    });

    // Second pass: create folders from notes (in case there are notes in folders not in virtualFolders)
    notes.forEach(note => {
      if (note.folder_path) {
        createFolderPath(note.folder_path);
      }
    });

    // Third pass: assign notes to folders
    notes.forEach(note => {
      const folder = folderMap.get(note.folder_path || '')!;
      folder.notes.push(note);
    });

    // Sort folders and notes
    const sortFolder = (folder: FolderNode) => {
      folder.children.sort((a, b) => a.name.localeCompare(b.name));
      folder.notes.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      folder.children.forEach(sortFolder);
    };
    
    sortFolder(root);
    return root;
  };

  const toggleFolder = (folderPath: string) => {
    const updateFolder = (folder: FolderNode): FolderNode => {
      if (folder.path === folderPath) {
        return { ...folder, isExpanded: !folder.isExpanded };
      }
      return {
        ...folder,
        children: folder.children.map(updateFolder)
      };
    };
    
    setFolderTree(updateFolder(folderTree));
  };

  const handleNoteClick = (noteId: string) => {
    if (onSelectNote) {
      onSelectNote(noteId);
    }
  };

  const handleCreateFolder = async () => {
    const folderName = prompt('Enter folder name:');
    if (!folderName || !folderName.trim()) {
      return;
    }

    try {
      await api.createFolder(vaultPath, sessionId, folderName.trim());
      // Add the folder to Jotai state
      addFolder(folderName.trim());
    } catch (error) {
      console.error('Failed to create folder:', error);
      alert('Failed to create folder. Please try again.');
    }
  };

  const showDeleteConfirmation = (type: 'folder' | 'note', target: string, title: string) => {
    setConfirmDialog({
      opened: true,
      type,
      target,
      title
    });
  };

  const handleConfirmDelete = async () => {
    const { type, target } = confirmDialog;
    setConfirmDialog(prev => ({ ...prev, opened: false }));

    try {
      let success = false;
      if (type === 'folder') {
        success = await api.deleteFolder(vaultPath, sessionId, target);
        if (!success) {
          alert('Failed to delete folder. The folder may contain notes or subfolders.');
        }
      } else {
        success = await api.deleteNote(vaultPath, sessionId, target);
        if (!success) {
          alert('Failed to delete note. Please try again.');
        }
      }

      if (success) {
        // If we deleted the currently selected note, deselect it
        if (type === 'note' && selectedNoteId === target && onSelectNote) {
          onSelectNote('');
        }
        
        // Reload notes to update the UI
        loadNotes({ vaultPath, sessionId });
      }
    } catch (error) {
      console.error(`Failed to delete ${type}:`, error);
      alert(`Failed to delete ${type}. Please try again.`);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, type: 'folder' | 'note', target: string) => {
    e.preventDefault();
    setContextMenu({
      opened: true,
      x: e.clientX,
      y: e.clientY,
      type,
      target
    });
  };

  const handleContextMenuAction = () => {
    const note = notes.find(n => n.id === contextMenu.target);
    const title = contextMenu.type === 'note' ? (note?.title || 'Unknown Note') : contextMenu.target;
    
    showDeleteConfirmation(contextMenu.type, contextMenu.target, title);
    setContextMenu(prev => ({ ...prev, opened: false }));
  };

  const renderFolder = (folder: FolderNode, level: number = 0): React.ReactNode => {
    const paddingLeft = level * 16;
    
    return (
      <div key={folder.path} className="tree-folder">
        <div 
          className="tree-folder-header"
          style={{ paddingLeft: `${paddingLeft}px` }}
          onClick={() => toggleFolder(folder.path)}
                      onContextMenu={(e) => handleContextMenu(e, 'folder', folder.path)}
        >
          <span className={`tree-folder-icon ${folder.isExpanded ? 'expanded' : ''}`}>
            <Icons.chevronRight size="sm" />
          </span>
          <Icons.folder size="sm" />
          <span className="tree-folder-name">{folder.name}</span>
          <span className="tree-folder-count">({folder.notes.length + folder.children.reduce((sum, child) => sum + child.notes.length, 0)})</span>
        </div>
        
        {folder.isExpanded && (
          <div className="tree-folder-content">
            {/* Render child folders first */}
            {folder.children.map(child => renderFolder(child, level + 1))}
            
            {/* Render notes in this folder */}
            {folder.notes.map(note => (
              <div
                key={note.id}
                className={`tree-note-item ${selectedNoteId === note.id ? 'selected' : ''}`}
                style={{ paddingLeft: `${paddingLeft + 32}px` }}
                onClick={() => handleNoteClick(note.id)}
                onContextMenu={(e) => handleContextMenu(e, 'note', note.id)}
                title={note.title}
              >
                <Icons.file size="sm" />
                <span className="tree-note-title">{note.title}</span>
                {note.tags.length > 0 && (
                  <span className="tree-note-tags">({note.tags.length})</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="tree-notes-list">
        <div className="tree-notes-loading">
          <div className="spinner small"></div>
          <span>Loading notes...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="tree-notes-list">
        <div className="tree-notes-error">
          <Icons.warning size="sm" />
          <span>Failed to load</span>
          <div className="error-details">
            <small>{error}</small>
          </div>
          <button className="tree-retry-button" onClick={() => loadNotes({ vaultPath, sessionId })}>
            <Icons.refresh size="sm" />
          </button>
        </div>
      </div>
    );
  }

  if (notes.length === 0) {
    return (
      <div className="tree-notes-list">
        <div className="tree-notes-empty">
          <Icons.file size="lg" />
          <span>No notes yet</span>
          {onCreateNote && (
            <button className="tree-action-button" onClick={onCreateNote} title="Create Note">
              <Icons.fileText size="sm" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="tree-notes-list">
      <div className="tree-header">
        <div className="tree-actions">
          <button className="tree-action-button" onClick={onCreateNote} title="Create New Note">
            <Icons.fileText size="sm" />
          </button>
          <button className="tree-action-button" onClick={handleCreateFolder} title="Create New Folder">
            <Icons.folderPlus size="sm" />
          </button>
        </div>
      </div>
      
      <div className="tree-content">
        {/* Render child folders first */}
        {folderTree.children.map(child => renderFolder(child, 0))}
        
        {/* Render notes in root folder */}
        {folderTree.notes.map(note => (
          <div
            key={note.id}
            className={`tree-note-item ${selectedNoteId === note.id ? 'selected' : ''}`}
            style={{ paddingLeft: '16px' }}
            onClick={() => handleNoteClick(note.id)}
            onContextMenu={(e) => handleContextMenu(e, 'note', note.id)}
            title={note.title}
          >
            <Icons.file size="sm" />
            <span className="tree-note-title">{note.title}</span>
            {note.tags.length > 0 && (
              <span className="tree-note-tags">({note.tags.length})</span>
            )}
          </div>
        ))}
      </div>

      {/* Context Menu */}
      <Menu
        opened={contextMenu.opened}
        onClose={() => setContextMenu(prev => ({ ...prev, opened: false }))}
        position="bottom-start"
        shadow="md"
        width={200}
      >
        <Menu.Target>
          <div
            style={{
              position: 'fixed',
              left: contextMenu.x,
              top: contextMenu.y,
              width: 1,
              height: 1,
              pointerEvents: 'none'
            }}
          />
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item
            color="red"
            leftSection={<IconTrash style={{ width: rem(14), height: rem(14) }} />}
            onClick={handleContextMenuAction}
          >
            {contextMenu.type === 'folder' ? 'Delete Folder' : 'Delete Note'}
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>

      {/* Confirmation Dialog */}
      <Modal
        opened={confirmDialog.opened}
        onClose={() => setConfirmDialog(prev => ({ ...prev, opened: false }))}
        title={`Delete ${confirmDialog.type === 'folder' ? 'Folder' : 'Note'}`}
        centered
      >
        <Text size="sm" mb="lg">
          Are you sure you want to delete {confirmDialog.type === 'folder' ? 'the folder' : 'the note'} "{confirmDialog.title}"?
          {confirmDialog.type === 'folder' && ' This will only delete the folder if it contains no notes.'}
          {confirmDialog.type === 'note' && ' This action cannot be undone.'}
        </Text>

        <Group justify="flex-end">
          <Button
            variant="default"
            onClick={() => setConfirmDialog(prev => ({ ...prev, opened: false }))}
          >
            Cancel
          </Button>
          <Button
            color="red"
            onClick={handleConfirmDelete}
            leftSection={<IconTrash style={{ width: rem(16), height: rem(16) }} />}
          >
            Delete
          </Button>
        </Group>
      </Modal>
    </div>
  );
} 