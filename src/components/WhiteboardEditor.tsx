import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  Container, 
  Paper, 
  Text, 
  TextInput, 
  Button, 
  Group, 
  Stack, 
  Alert, 
  Loader,
  Menu,
  ActionIcon,
  Modal
} from '@mantine/core';
import { 
  IconAlertTriangle, 
  IconDots
} from '@tabler/icons-react';
import debounce from 'lodash.debounce';
import { useTheme } from '../contexts/ThemeContext';
import { api } from '../utils/api';
import type { CreateNoteResult, SaveNoteResult, Note } from '../types';
import { Icons } from './Icons';
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import './WhiteboardEditor.css';

interface WhiteboardEditorProps {
  vaultPath: string;
  sessionId: string;
  noteId?: string; // For editing existing whiteboard
  onSaved?: (noteId: string) => void;
  onCancel?: () => void;
  onError?: (error: string) => void;
  onNoteUpdated?: (note: Note) => void;
  onNoteDeleted?: (noteId: string) => Promise<void>;
}

interface WhiteboardControlsProps {
  title: string;
  titleError: string;
  onTitleChange: (title: string) => void;
  onDeleteNote?: () => Promise<void>;
  isNewNote: boolean;
}

const WhiteboardControls: React.FC<WhiteboardControlsProps> = ({
  title,
  titleError,
  onTitleChange,
  onDeleteNote,
  isNewNote
}) => {
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onTitleChange(e.target.value);
  };

  const handleDeleteClick = () => {
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    setDeleteModalOpen(false);
    if (onDeleteNote) {
      await onDeleteNote();
    }
  };

  return (
    <>
      <div className="editor-header">
        <div className="title-section">
          <div className="title-input-container">
            <TextInput
              value={title}
              onChange={handleTitleChange}
              placeholder="Enter whiteboard title"
              size="lg"
              variant="unstyled"
              className="title-input"
              maxLength={200}
              styles={{
                input: {
                  fontSize: '1.5rem',
                  fontWeight: 600,
                  padding: '8px 0',
                  border: 'none',
                  borderBottom: '2px solid transparent',
                  borderRadius: 0,
                  '&:focus': {
                    borderBottom: '2px solid var(--mantine-primary-color-filled)',
                    outline: 'none',
                  },
                  '&::placeholder': {
                    color: 'var(--mantine-color-dimmed)',
                  }
                }
              }}
            />
            
            {!isNewNote && onDeleteNote && (
              <Menu shadow="md" width={200} position="bottom-end">
                <Menu.Target>
                  <ActionIcon variant="subtle" color="gray" size="lg">
                    <IconDots size={20} />
                  </ActionIcon>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Item
                    color="red"
                    leftSection={<Icons.trash size="sm" />}
                    onClick={handleDeleteClick}
                  >
                    Delete Whiteboard
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            )}
          </div>
          {titleError && <div className="title-error">{titleError}</div>}
        </div>
      </div>

      <Modal
        opened={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete Whiteboard"
        centered
      >
        <Text size="sm" mb="md">
          Are you sure you want to delete this whiteboard? This action cannot be undone.
        </Text>
        <Group justify="flex-end">
          <Button
            variant="default"
            onClick={() => setDeleteModalOpen(false)}
          >
            Cancel
          </Button>
          <Button
            color="red"
            onClick={handleConfirmDelete}
          >
            Delete
          </Button>
        </Group>
      </Modal>
    </>
  );
};

export function WhiteboardEditor({ 
  vaultPath, 
  sessionId, 
  noteId, 
  onSaved, 
  onCancel,
  onError,
  onNoteUpdated,
  onNoteDeleted
}: WhiteboardEditorProps) {
  const { theme } = useTheme();
  const excalidrawRef = useRef<any>(null);
  
  // State for UI
  const [title, setTitle] = useState(noteId ? '' : 'New Whiteboard');
  const [titleError, setTitleError] = useState('');
  const [isLoading, setIsLoading] = useState(false); // Start with false, set to true only when actually loading
  const [loadError, setLoadError] = useState<string | null>(null);
  
  // Refs for auto-save operations - no UI state for content changes
  const originalNoteRef = useRef<Note | null>(null);
  const titleRef = useRef(noteId ? '' : 'New Whiteboard');
  const savingRef = useRef(false);
  const hasInitialContentRef = useRef(false);
  const isDataLoadedRef = useRef(false); // Track if we've loaded the initial data
  const pendingLoadFunctionRef = useRef<(() => void) | null>(null); // Store pending load function

  // Initial loading effect for existing notes - will be called after loadWhiteboard is defined

  const loadWhiteboard = useCallback(async () => {
    if (!noteId) return;

    try {
      setIsLoading(true);
      setLoadError(null);
      
      const note = await api.loadNote(vaultPath, sessionId, noteId);
      
      // Parse whiteboard data from content
      let whiteboardData;
      try {
        whiteboardData = JSON.parse(note.content || '{"elements": [], "appState": {}}');
      } catch (err) {
        console.warn('Failed to parse whiteboard content, using defaults:', err);
        whiteboardData = { elements: [], appState: {} };
      }
      
      // Update refs and state
      originalNoteRef.current = note;
      setTitle(note.title);
      titleRef.current = note.title;
      
      setIsLoading(false);

      // Store the data to be loaded when Excalidraw is ready
      const loadDataIntoExcalidraw = () => {
        if (excalidrawRef.current && !isDataLoadedRef.current) {
          try {
            excalidrawRef.current.updateScene({
              elements: whiteboardData.elements || [],
              appState: {
                ...whiteboardData.appState,
                theme: theme === 'dark' ? 'dark' : 'light'
              }
            });
            hasInitialContentRef.current = whiteboardData.elements && whiteboardData.elements.length > 0;
            isDataLoadedRef.current = true; // Mark as loaded
          } catch (err) {
            console.error('Failed to load whiteboard data into Excalidraw:', err);
          }
        }
      };

      // Try to load immediately if Excalidraw is ready
      if (excalidrawRef.current) {
        // Small delay to ensure Excalidraw is fully initialized
        setTimeout(loadDataIntoExcalidraw, 100);
      } else {
        // Store the function to call when Excalidraw becomes ready
        pendingLoadFunctionRef.current = loadDataIntoExcalidraw;
      }
      
    } catch (error) {
      setIsLoading(false);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load whiteboard';
      console.error('Failed to load whiteboard:', error);
      setLoadError(errorMessage);
      if (onError) {
        onError(errorMessage);
      }
    }
  }, [noteId, vaultPath, sessionId, theme, onError]);

  // Reset state when noteId changes
  useEffect(() => {
    // Reset all refs when switching to a different note
    originalNoteRef.current = null;
    isDataLoadedRef.current = false;
    hasInitialContentRef.current = false;
    pendingLoadFunctionRef.current = null;
    
    if (noteId) {
      loadWhiteboard();
    } else {
      // For new whiteboards, reset to default title and mark as loaded
      setTitle('New Whiteboard');
      titleRef.current = 'New Whiteboard';
      isDataLoadedRef.current = true;
    }
  }, [noteId, loadWhiteboard]);

  // Backup loading mechanism - if noteId exists and we haven't loaded yet after 1 second
  useEffect(() => {
    if (noteId && !originalNoteRef.current) {
      const timer = setTimeout(() => {
        if (!originalNoteRef.current) {
          loadWhiteboard();
        }
      }, 1000);
      
      return () => clearTimeout(timer);
    }
    // Return empty cleanup function when condition is false
    return () => {};
  }, [noteId, loadWhiteboard]);

  // Silent auto-save function - no UI updates, no notifications
  const autoSave = useCallback(async () => {
    if (savingRef.current || !excalidrawRef.current) return;
    
    // For new notes, check if we have meaningful content
    const currentTitle = titleRef.current.trim();
    const sceneElements = excalidrawRef.current.getSceneElements();
    const hasDrawingContent = sceneElements && sceneElements.length > 0;
    const hasContent = hasInitialContentRef.current || hasDrawingContent;
    
    // Don't save empty new whiteboards
    if (!noteId && (!currentTitle || currentTitle === 'New Whiteboard') && !hasContent) {
      return;
    }
    
    // Check if we have actual changes for existing notes
    if (noteId && originalNoteRef.current) {
      const original = originalNoteRef.current;
      if (currentTitle === original.title && !hasContent) {
        return;
      }
    }
    
    // Validate title silently
    if (currentTitle.length > 200) {
      return;
    }
    if (!currentTitle) {
      return;
    }

    savingRef.current = true;
    
    try {
      // Get current scene data from Excalidraw
      const sceneData = excalidrawRef.current.getSceneElements();
      const appState = excalidrawRef.current.getAppState();
      

      
      const whiteboardContent = JSON.stringify({
        elements: sceneData,
        appState: {
          theme: appState.theme,
          viewBackgroundColor: appState.viewBackgroundColor,
          currentItemStrokeColor: appState.currentItemStrokeColor,
          currentItemBackgroundColor: appState.currentItemBackgroundColor,
          currentItemFillStyle: appState.currentItemFillStyle,
          currentItemStrokeWidth: appState.currentItemStrokeWidth,
          currentItemStrokeStyle: appState.currentItemStrokeStyle,
          currentItemRoughness: appState.currentItemRoughness,
          currentItemOpacity: appState.currentItemOpacity,
          currentItemFontFamily: appState.currentItemFontFamily,
          currentItemFontSize: appState.currentItemFontSize,
          currentItemTextAlign: appState.currentItemTextAlign,
          currentItemStartArrowhead: appState.currentItemStartArrowhead,
          currentItemEndArrowhead: appState.currentItemEndArrowhead,
          scrollX: appState.scrollX,
          scrollY: appState.scrollY,
          zoom: appState.zoom,
          cursorButton: appState.cursorButton,
          gridSize: appState.gridSize,
          colorPalette: appState.colorPalette
        }
      });

      let result: CreateNoteResult | SaveNoteResult;

      if (noteId && originalNoteRef.current) {
        // Update existing note
        result = await api.saveNote(
          vaultPath, 
          sessionId, 
          noteId,
          currentTitle,
          whiteboardContent,
          originalNoteRef.current.tags,
          originalNoteRef.current.folder_path
        );
      } else {
        // Create new note
        result = await api.createNote(
          vaultPath, 
          sessionId, 
          currentTitle,
          whiteboardContent,
          undefined,
          undefined,
          'whiteboard'
        );
      }

      if (result.success && result.note) {
        // Update refs with the saved note data
        originalNoteRef.current = result.note;
        titleRef.current = result.note.title;
        
        // Update UI state if the title changed on the server
        if (result.note.title !== title) {
          setTitle(result.note.title);
        }
        
        // For new notes, notify parent about creation
        if (!noteId && onSaved) {
          onSaved(result.note.id);
        }
        
        // Notify parent about the update
        if (onNoteUpdated) {
          onNoteUpdated(result.note);
        }
      } else {
        // Only show errors, never success notifications
        if (onError) {
          onError(result.error_message || 'Failed to save whiteboard');
        }
      }
    } catch (error) {
      if (onError) {
        onError(`Failed to save whiteboard: ${error}`);
      }
    } finally {
      savingRef.current = false;
    }
  }, [noteId, vaultPath, sessionId, onError, onNoteUpdated, onSaved, title]);

  // Debounced auto-save - completely silent
  const debouncedAutoSave = useMemo(
    () => debounce(autoSave, 300),
    [autoSave]
  );

  // Handle title changes - only update state for title validation
  const handleTitleChange = useCallback((newTitle: string) => {
    setTitle(newTitle);
    titleRef.current = newTitle; // Keep ref in sync immediately
    
    if (newTitle.trim().length === 0) {
      setTitleError('Title cannot be empty');
    } else if (newTitle.length > 200) {
      setTitleError('Title cannot exceed 200 characters');
    } else {
      setTitleError('');
    }
    
    // Trigger auto-save for title changes
    debouncedAutoSave();
  }, [debouncedAutoSave]);

  // Handle whiteboard content changes
  const handleWhiteboardChange = useCallback(() => {
    // Mark that we have content and trigger auto-save
    hasInitialContentRef.current = true;
    debouncedAutoSave();
  }, [debouncedAutoSave]);

  // Handle note deletion
  const handleDeleteNote = useCallback(async () => {
    if (!noteId) return;
    
    try {
      const success = await api.deleteNote(vaultPath, sessionId, noteId);
      if (success && onNoteDeleted) {
        await onNoteDeleted(noteId);
      } else if (!success && onError) {
        onError('Failed to delete whiteboard');
      }
    } catch (error) {
      if (onError) {
        onError(`Failed to delete whiteboard: ${error}`);
      }
    }
  }, [vaultPath, sessionId, noteId, onNoteDeleted, onError]);

  if (isLoading) {
    return (
      <Container size="xl" py="xl">
        <Paper p="xl" radius="lg" shadow="md">
          <Stack gap="xl" align="center">
            <Loader size="lg" />
            <Text>Loading whiteboard...</Text>
          </Stack>
        </Paper>
      </Container>
    );
  }

  if (loadError) {
    return (
      <Container size="xl" py="xl">
        <Paper p="xl" radius="lg" shadow="md">
          <Stack gap="xl" align="center">
            <Alert
              icon={<IconAlertTriangle size={16} />}
              title="Error"
              color="red"
              variant="light"
            >
              {loadError}
            </Alert>
            {onCancel && (
              <Button onClick={onCancel}>
                Go Back
              </Button>
            )}
          </Stack>
        </Paper>
      </Container>
    );
  }

  return (
    <div className="whiteboard-editor" style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Paper p="md" radius={0} shadow="sm" style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}>
                 <WhiteboardControls
           title={title}
           titleError={titleError}
           onTitleChange={handleTitleChange}
           {...(noteId && { onDeleteNote: handleDeleteNote })}
           isNewNote={!noteId}
         />
      </Paper>

      <div style={{ flex: 1, minHeight: 0 }}>
        <Excalidraw
          key={noteId || 'new-whiteboard'} // Force new instance for each note
          excalidrawAPI={(api) => {
            excalidrawRef.current = api;
            
            // If there's a pending load function, execute it
            if (pendingLoadFunctionRef.current) {
              setTimeout(pendingLoadFunctionRef.current, 100);
              pendingLoadFunctionRef.current = null;
            }
          }}
          onChange={(elements, _appState, _files) => {
            // Only process onChange events after initial data is loaded
            if (!noteId || isDataLoadedRef.current) {
              if (elements && elements.length > 0) {
                hasInitialContentRef.current = true;
              }
              handleWhiteboardChange();
            }
          }}
          theme={theme === 'dark' ? 'dark' : 'light'}
        />
      </div>
    </div>
  );
} 