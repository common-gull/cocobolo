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
  Menu,
  ActionIcon,
  Modal
} from '@mantine/core';
import { 
  IconAlertTriangle, 
  IconDots
} from '@tabler/icons-react';
import debounce from 'lodash.debounce';
import { useTheme } from '../hooks/useTheme';
import { api } from '../utils/api';
import type { CreateNoteResult, SaveNoteResult, Note } from '../types';
import { Icons } from './Icons';
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import './WhiteboardEditor.css';

interface WhiteboardEditorProps {
  vaultPath: string;
  sessionId: string;
  note?: Note; // For editing existing whiteboard
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
              size="sm"
              variant="unstyled"
              className="title-input"
              maxLength={200}
              styles={{
                input: {
                  fontSize: '12px',
                  fontWeight: 600,
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
  note,
  onSaved, 
  onCancel,
  onError,
  onNoteUpdated,
  onNoteDeleted
}: WhiteboardEditorProps) {
  const { effectiveTheme } = useTheme();
  const excalidrawRef = useRef<any>(null);

  // Simple state management
  const [title, setTitle] = useState(note?.title || 'New Whiteboard');
  const [titleError, setTitleError] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  
  // Refs for auto-save
  const savingRef = useRef(false);
  const hasContentRef = useRef(false);
  const debouncedAutoSaveRef = useRef<ReturnType<typeof debounce> | null>(null);

  // Initialize whiteboard data when note changes
  useEffect(() => {
    if (!note) {
      // New whiteboard
      setTitle('New Whiteboard');
      setIsLoaded(true);
      hasContentRef.current = false;
      return;
    }

    // Existing whiteboard - load data
    try {
      setLoadError(null);
      setTitle(note.title);
      
      let whiteboardData;
      try {
        whiteboardData = JSON.parse(note.content || '{"elements": [], "appState": {}}');
      } catch (err) {
        console.warn('Failed to parse whiteboard content, using defaults:', err);
        whiteboardData = { elements: [], appState: {} };
      }

      // Load data into Excalidraw when it's ready
      const loadData = () => {
        if (excalidrawRef.current) {
          excalidrawRef.current.updateScene({
            elements: whiteboardData.elements || [],
            appState: {
              ...whiteboardData.appState,
              theme: effectiveTheme === 'dark' ? 'dark' : 'light'
            }
          });
          hasContentRef.current = whiteboardData.elements && whiteboardData.elements.length > 0;
          setIsLoaded(true);
        }
      };

      if (excalidrawRef.current) {
        setTimeout(loadData, 10);
      } else {
        // Wait for Excalidraw to be ready
        const checkReady = () => {
          if (excalidrawRef.current) {
            loadData();
          } else {
            setTimeout(checkReady, 100);
          }
        };
        checkReady();
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load whiteboard';
      console.error('Failed to load whiteboard:', error);
      setLoadError(errorMessage);
      if (onError) {
        onError(errorMessage);
      }
    }
  }, [note, effectiveTheme, onError]);

  // Auto-save function
  const autoSave = useCallback(async () => {
    if (savingRef.current || !excalidrawRef.current || !isLoaded) return;
    
    const currentTitle = title.trim();
    const sceneElements = excalidrawRef.current.getSceneElements();
    const hasDrawingContent = sceneElements && sceneElements.length > 0;
    const hasContent = hasContentRef.current || hasDrawingContent;
    
    // Don't save empty new whiteboards
    if (!note && (!currentTitle || currentTitle === 'New Whiteboard') && !hasContent) {
      return;
    }
    
    // Validate title
    if (!currentTitle || currentTitle.length > 200) {
      return;
    }

    savingRef.current = true;
    
    try {
      // Get current scene data
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

      if (note) {
        // Update existing note
        result = await api.saveNote(
          vaultPath, 
          sessionId, 
          note.id,
          currentTitle,
          whiteboardContent,
          note.tags,
          note.folder_path
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
        // For new notes, notify parent about creation
        if (!note && onSaved) {
          onSaved(result.note.id);
        }
        
        // Notify parent about the update
        if (onNoteUpdated) {
          onNoteUpdated(result.note);
        }
      } else if (!result.success && onError) {
        onError(result.error_message || 'Failed to save whiteboard');
      }
    } catch (error) {
      if (onError) {
        onError(`Failed to save whiteboard: ${error}`);
      }
    } finally {
      savingRef.current = false;
    }
  }, [note, vaultPath, sessionId, title, isLoaded, onError, onNoteUpdated, onSaved]);

  // Debounced auto-save
  const debouncedAutoSave = useMemo(() => {
    if (debouncedAutoSaveRef.current) {
      debouncedAutoSaveRef.current.cancel();
    }
    
    const newDebouncedAutoSave = debounce(autoSave, 300);
    debouncedAutoSaveRef.current = newDebouncedAutoSave;
    
    return newDebouncedAutoSave;
  }, [autoSave]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      if (debouncedAutoSaveRef.current) {
        debouncedAutoSaveRef.current.cancel();
      }
    };
  }, []);

  // Handle title changes
  const handleTitleChange = useCallback((newTitle: string) => {
    setTitle(newTitle);
    
    if (newTitle.trim().length === 0) {
      setTitleError('Title cannot be empty');
    } else if (newTitle.length > 200) {
      setTitleError('Title cannot exceed 200 characters');
    } else {
      setTitleError('');
    }
    
    debouncedAutoSave();
  }, [debouncedAutoSave]);

  // Handle whiteboard content changes
  const handleWhiteboardChange = useCallback(() => {
    if (!isLoaded) return; // Ignore changes during initial load
    
    hasContentRef.current = true;
    debouncedAutoSave();
  }, [debouncedAutoSave, isLoaded]);

  // Handle note deletion
  const handleDeleteNote = useCallback(async () => {
    if (!note) return;
    
    try {
      const success = await api.deleteNote(vaultPath, sessionId, note.id);
      if (success && onNoteDeleted) {
        await onNoteDeleted(note.id);
      } else if (!success && onError) {
        onError('Failed to delete whiteboard');
      }
    } catch (error) {
      if (onError) {
        onError(`Failed to delete whiteboard: ${error}`);
      }
    }
  }, [vaultPath, sessionId, note, onNoteDeleted, onError]);

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
    <div className="whiteboard-editor">
      <div>
        <WhiteboardControls
          title={title}
          titleError={titleError}
          onTitleChange={handleTitleChange}
          {...(note && { onDeleteNote: handleDeleteNote })}
          isNewNote={!note}
        />
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        <Excalidraw
          excalidrawAPI={(api) => {
            excalidrawRef.current = api;
          }}
          onChange={(elements, _appState, _files) => {
            if (elements && elements.length > 0) {
              hasContentRef.current = true;
            }
            handleWhiteboardChange();
          }}
          theme={effectiveTheme === 'dark' ? 'dark' : 'light'}
          initialData={{
            elements: [],
            appState: {
              theme: effectiveTheme === 'dark' ? 'dark' : 'light',
              viewBackgroundColor: effectiveTheme === 'dark' ? '#1a1a1a' : '#ffffff'
            }
          }}
        />
      </div>
    </div>
  );
}