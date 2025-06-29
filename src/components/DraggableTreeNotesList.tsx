import { useState, useEffect } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { Menu, rem, Modal, Button, Text, Group } from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  UniqueIdentifier,
} from '@dnd-kit/core';
import {
  useDraggable,
} from '@dnd-kit/core';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

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

interface DraggableTreeNotesListProps {
  vaultPath: string;
  sessionId: string;
  selectedNoteId?: string;
  onSelectNote?: (noteId: string) => void;
  onCreateNote?: () => void;
  onCreateWhiteboard?: () => void;
}

interface FolderNode {
  id: string;
  name: string;
  path: string;
  children: FolderNode[];
  notes: NoteMetadata[];
  isExpanded: boolean;
  type: 'folder';
}

interface DragItem {
  id: string;
  type: 'note' | 'folder';
  noteId?: string;
  folderPath?: string;
}

// Draggable and droppable folder component
function DraggableFolder({ 
  folder, 
  level, 
  selectedNoteId, 
  onToggleFolder, 
  onSelectNote, 
  onContextMenu,
  overId 
}: {
  folder: FolderNode;
  level: number;
  selectedNoteId: string | undefined;
  onToggleFolder: (path: string) => void;
  onSelectNote: ((noteId: string) => void) | undefined;
  onContextMenu: (e: React.MouseEvent, type: 'folder' | 'note', target: string) => void;
  overId?: UniqueIdentifier | null | undefined;
}) {
  const {
    attributes,
    listeners,
    setNodeRef: setDragNodeRef,
    transform,
    isDragging,
  } = useDraggable({ id: `folder-${folder.path}` });

  const {
    setNodeRef: setDropNodeRef,
    isOver,
  } = useDroppable({ id: `folder-${folder.path}` });

  const style = {
    transform: transform ? CSS.Translate.toString(transform) : undefined,
    opacity: isDragging ? 0.5 : 1,
  };

  const paddingLeft = level * 16;
  const isDropTarget = isOver || overId === `folder-${folder.path}`;

  // Combine refs
  const setNodeRef = (node: HTMLElement | null) => {
    setDragNodeRef(node);
    setDropNodeRef(node);
  };

  return (
    <div ref={setNodeRef} style={style} className="tree-folder">
      <div 
        className={`tree-folder-header ${isDropTarget ? 'drop-target' : ''}`}
        style={{ paddingLeft: `${paddingLeft}px` }}
        onClick={() => onToggleFolder(folder.path)}
        onContextMenu={(e) => onContextMenu(e, 'folder', folder.path)}
        {...attributes}
        {...listeners}
      >
        <span className={`tree-folder-icon ${folder.isExpanded ? 'expanded' : ''}`}>
          <Icons.chevronRight size="sm" />
        </span>
        <Icons.folder size="sm" />
        <span className="tree-folder-name">{folder.name}</span>
        <span className="tree-folder-count">
          ({folder.notes.length + folder.children.reduce((sum, child) => sum + child.notes.length, 0)})
        </span>
      </div>
      
      {folder.isExpanded && (
        <div className="tree-folder-content">
          {/* Render child folders */}
          {folder.children.map(child => (
            <DraggableFolder
              key={child.path}
              folder={child}
              level={level + 1}
              selectedNoteId={selectedNoteId}
              onToggleFolder={onToggleFolder}
              onSelectNote={onSelectNote}
              onContextMenu={onContextMenu}
              overId={overId}
            />
          ))}
          
          {/* Render notes in this folder */}
          {folder.notes.map(note => (
            <DraggableNote
              key={note.id}
              note={note}
              level={level + 1}
              selectedNoteId={selectedNoteId}
              onSelectNote={onSelectNote}
              onContextMenu={onContextMenu}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Droppable root area component
function DroppableRoot({ children, overId }: { children: React.ReactNode; overId?: UniqueIdentifier | null | undefined }) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'root',
  });

  const isDropTarget = isOver || overId === 'root';

  return (
    <div 
      ref={setNodeRef} 
      className={`tree-content ${isDropTarget ? 'drop-target' : ''}`}
      style={{ minHeight: '200px', position: 'relative' }}
    >
      {children}
      {/* Add an explicit drop zone for empty areas */}
      {isDropTarget && (
        <div 
          className="root-drop-zone active"
          style={{ 
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            pointerEvents: 'none',
            zIndex: 10
          }}
        />
      )}
    </div>
  );
}

// Draggable note component
function DraggableNote({ 
  note, 
  level, 
  selectedNoteId, 
  onSelectNote, 
  onContextMenu 
}: {
  note: NoteMetadata;
  level: number;
  selectedNoteId: string | undefined;
  onSelectNote: ((noteId: string) => void) | undefined;
  onContextMenu: (e: React.MouseEvent, type: 'folder' | 'note', target: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({ id: `note-${note.id}` });

  const style = {
    transform: transform ? CSS.Translate.toString(transform) : undefined,
    opacity: isDragging ? 0.5 : 1,
  };

  const paddingLeft = (level + 1) * 16;

  return (
    <div
      ref={setNodeRef}
      className={`tree-note-item ${selectedNoteId === note.id ? 'selected' : ''}`}
      style={{ paddingLeft: `${paddingLeft}px`, ...style }}
      onClick={() => onSelectNote?.(note.id)}
      onContextMenu={(e) => onContextMenu(e, 'note', note.id)}
      title={note.title}
      {...attributes}
      {...listeners}
    >
      {note.note_type === 'whiteboard' ? (
        <Icons.whiteboard size="sm" />
      ) : (
        <Icons.file size="sm" />
      )}
      <span className="tree-note-title">{note.title}</span>
      {note.tags.length > 0 && (
        <span className="tree-note-tags">({note.tags.length})</span>
      )}
    </div>
  );
}

export function DraggableTreeNotesList({ 
  vaultPath, 
  sessionId, 
  selectedNoteId, 
  onSelectNote,
  onCreateNote,
  onCreateWhiteboard
}: DraggableTreeNotesListProps) {
  // Jotai state
  const notes = useAtomValue(notesAtom);
  const folders = useAtomValue(foldersAtom);
  const isLoading = useAtomValue(notesLoadingAtom);
  const error = useAtomValue(notesErrorAtom);
  const loadNotes = useSetAtom(loadNotesAtom);
  const addFolder = useSetAtom(addFolderAtom);

  // Local state
  const [folderTree, setFolderTree] = useState<FolderNode>({ 
    id: 'root',
    name: 'Root', 
    path: '', 
    children: [], 
    notes: [], 
    isExpanded: true,
    type: 'folder'
  });

  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [dragItem, setDragItem] = useState<DragItem | null>(null);
  const [overId, setOverId] = useState<UniqueIdentifier | null>(null);

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

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

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
  }, [notes, folders, expandedFolders]);

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

  // Build the folder tree with alphabetical sorting
  const buildFolderTree = (notes: NoteMetadata[], virtualFolders: string[]): FolderNode => {
    const root: FolderNode = { 
      id: 'root',
      name: 'Root', 
      path: '', 
      children: [], 
      notes: [], 
      isExpanded: true,
      type: 'folder'
    };
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
            id: `folder-${currentPath}`,
            name: part,
            path: currentPath,
            children: [],
            notes: [],
            isExpanded: expandedFolders.has(currentPath),
            type: 'folder'
          };
          
          folderMap.set(currentPath, newFolder);
          const parent = folderMap.get(parentPath)!;
          parent.children.push(newFolder);
        }
      });
    };

    // Create all virtual folders
    virtualFolders.forEach(folderPath => {
      if (folderPath) {
        createFolderPath(folderPath);
      }
    });

    // Create folders from notes
    notes.forEach(note => {
      if (note.folder_path) {
        createFolderPath(note.folder_path);
      }
    });

    // Assign notes to folders
    notes.forEach(note => {
      const folderPath = note.folder_path || '';
      const folder = folderMap.get(folderPath);
      if (folder) {
        folder.notes.push(note);
      }
    });

    // Sort folders and notes alphabetically
    const sortFolder = (folder: FolderNode) => {
      folder.children.sort((a, b) => a.name.localeCompare(b.name));
      folder.notes.sort((a, b) => a.title.localeCompare(b.title));
      folder.children.forEach(sortFolder);
    };
    
    sortFolder(root);
    return root;
  };



  const toggleFolder = (folderPath: string) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folderPath)) {
        newSet.delete(folderPath);
      } else {
        newSet.add(folderPath);
      }
      return newSet;
    });
  };

  const expandFolder = (folderPath: string) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      newSet.add(folderPath);
      return newSet;
    });
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
      addFolder(folderName.trim());
    } catch (error) {
      console.error('Failed to create folder:', error);
      alert('Failed to create folder. Please try again.');
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
        if (type === 'note' && selectedNoteId === target && onSelectNote) {
          onSelectNote('');
        }
        loadNotes({ vaultPath, sessionId });
      }
    } catch (error) {
      console.error(`Failed to delete ${type}:`, error);
      alert(`Failed to delete ${type}. Please try again.`);
    }
  };

  // Drag and drop handlers
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id);
    
    const idStr = active.id.toString();
    if (idStr.startsWith('note-')) {
      const noteId = idStr.replace('note-', '');
      setDragItem({ id: noteId, type: 'note', noteId });
    } else if (idStr.startsWith('folder-')) {
      const folderPath = idStr.replace('folder-', '');
      setDragItem({ id: folderPath, type: 'folder', folderPath });
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    setOverId(over ? over.id : null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setDragItem(null);
    setOverId(null);

    if (!over || !dragItem) {
      return;
    }

    const activeId = active.id.toString();
    const overId = over.id.toString();

    // Don't do anything if dropped on itself
    if (activeId === overId) return;

    try {
      if (dragItem.type === 'note') {
        // Moving a note
        let newFolderPath: string | undefined;
        
        if (overId === 'root') {
          // Explicitly moving to root
          newFolderPath = undefined;
        } else if (overId.startsWith('folder-')) {
          newFolderPath = overId.replace('folder-', '');
          if (newFolderPath === 'root' || newFolderPath === '') {
            newFolderPath = undefined; // Moving to root
          }
        } else {
          return;
        }
        
        const success = await api.moveNote(
          vaultPath, 
          sessionId, 
          dragItem.noteId!, 
          newFolderPath
        );
        
        if (success) {
          // If note was moved into a folder, expand that folder
          if (newFolderPath) {
            expandFolder(newFolderPath);
          }
          loadNotes({ vaultPath, sessionId });
        } else {
          alert('Failed to move note. Please try again.');
        }
      } else if (dragItem.type === 'folder') {
        // Moving a folder
        if (overId.startsWith('folder-') || overId === 'root') {
          const targetFolderPath = overId === 'root' ? '' : overId.replace('folder-', '');
          let newPath: string;
          
          if (targetFolderPath === '' || targetFolderPath === 'root') {
            // Moving to root
            const folderName = dragItem.folderPath!.split('/').pop()!;
            newPath = folderName;
          } else {
            // Moving to another folder
            const folderName = dragItem.folderPath!.split('/').pop()!;
            newPath = `${targetFolderPath}/${folderName}`;
          }
          
          // Prevent moving a folder into itself or its descendants
          if (newPath.startsWith(dragItem.folderPath + '/') || newPath === dragItem.folderPath) {
            alert('Cannot move a folder into itself or its descendants.');
            return;
          }
          
          const success = await api.moveFolder(
            vaultPath,
            sessionId,
            dragItem.folderPath!,
            newPath
          );
          
          if (success) {
            // If folder was moved into another folder, expand the target folder
            if (targetFolderPath && targetFolderPath !== 'root') {
              expandFolder(targetFolderPath);
            }
            loadNotes({ vaultPath, sessionId });
          } else {
            alert('Failed to move folder. Please try again.');
          }
        }
      }
    } catch (error) {
      console.error('Failed to move item:', error);
      alert('Failed to move item. Please try again.');
    }
  };

  // Render active drag overlay
  const renderDragOverlay = () => {
    if (!activeId || !dragItem) return null;

    if (dragItem.type === 'note') {
      const note = notes.find(n => n.id === dragItem.noteId);
      if (!note) return null;
      
      return (
        <div className="tree-note-item selected drag-overlay">
          {note.note_type === 'whiteboard' ? (
            <Icons.whiteboard size="sm" />
          ) : (
            <Icons.file size="sm" />
          )}
          <span className="tree-note-title">{note.title}</span>
        </div>
      );
    } else if (dragItem.type === 'folder') {
      const folderName = dragItem.folderPath!.split('/').pop() || dragItem.folderPath!;
      return (
        <div className="tree-folder-header drag-overlay">
          <Icons.folder size="sm" />
          <span className="tree-folder-name">{folderName}</span>
        </div>
      );
    }

    return null;
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
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className={`tree-notes-list ${activeId ? 'data-dragging' : ''}`}>
        <div className="tree-header">
          <div className="tree-actions">
            <button className="tree-action-button" onClick={onCreateNote} title="Create New Note">
              <Icons.fileText size="sm" />
            </button>
            <button className="tree-action-button" onClick={onCreateWhiteboard} title="Create New Whiteboard">
              <Icons.whiteboard size="sm" />
            </button>
            <button className="tree-action-button" onClick={handleCreateFolder} title="Create New Folder">
              <Icons.folderPlus size="sm" />
            </button>
          </div>
        </div>
        
        <DroppableRoot overId={overId}>
          {/* Render child folders first */}
          {folderTree.children.map(child => (
            <DraggableFolder
              key={child.path}
              folder={child}
              level={0}
              selectedNoteId={selectedNoteId}
              onToggleFolder={toggleFolder}
              onSelectNote={handleNoteClick}
              onContextMenu={handleContextMenu}
              overId={overId}
            />
          ))}
          
          {/* Render notes in root folder */}
          {folderTree.notes.map(note => (
            <DraggableNote
              key={note.id}
              note={note}
              level={0}
              selectedNoteId={selectedNoteId}
              onSelectNote={handleNoteClick}
              onContextMenu={handleContextMenu}
            />
          ))}
          
          {/* Add empty space indicator when root has no notes */}
          {folderTree.notes.length === 0 && folderTree.children.length === 0 && (
            <div className="empty-root-indicator">
              <Icons.folder size="lg" />
              <span>Root folder - drop notes here</span>
            </div>
          )}
        </DroppableRoot>

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
      
      <DragOverlay>
        {renderDragOverlay()}
      </DragOverlay>
    </DndContext>
  );
} 