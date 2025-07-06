import { markdown } from '@codemirror/lang-markdown';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { languages } from '@codemirror/language-data';
import { Extension } from '@codemirror/state';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView } from '@codemirror/view';
import { tags } from '@lezer/highlight';
import { Menu, Button, Modal, Text, Group, ActionIcon } from '@mantine/core';
import { githubLight } from '@uiw/codemirror-theme-github';
import CodeMirror from '@uiw/react-codemirror';
import debounce from 'lodash.debounce';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';


import type { Note, SaveNoteResult } from '../types';
import { api } from '../utils/api';

import { Icons } from './Icons';
import './MarkdownEditor.css';

interface MarkdownEditorProps {
  note: Note;
  vaultPath: string;
  sessionId: string;
  isDarkMode: boolean;
  onClose: () => void;
  onError: (error: string) => void;
  onNoteUpdated?: (note: Note) => void;
  onNoteDeleted?: (noteId: string) => void;
}

interface MarkdownEditorCoreProps {
  initialContent: string;
  isDarkMode: boolean;
  noteId: string;
  onContentChange: (content: string) => void;
}

const MarkdownEditorCore: React.FC<MarkdownEditorCoreProps> = React.memo(({
  initialContent,
  isDarkMode,
  noteId,
  onContentChange
}) => {
  const editorRef = useRef<any>(null);
  const currentNoteIdRef = useRef(noteId);
  const [editorKey, setEditorKey] = useState(noteId);

  useEffect(() => {
    if (noteId !== currentNoteIdRef.current) {
      currentNoteIdRef.current = noteId;
      setEditorKey(noteId);
    }
  }, [noteId]);

  const extensions = useMemo(() => {
    const markdownExtension = markdown({ 
      codeLanguages: languages,
      addKeymap: true,
    });

    // Create custom highlighting style for inline markdown preview
    const markdownHighlightStyle = HighlightStyle.define([
      // Headings with progressive sizing and proper styling
      {
        tag: tags.heading1,
        fontSize: '2.25em',
        fontWeight: '700',
        color: isDarkMode ? '#ffffff' : '#1a1a1a',
        lineHeight: '1.2',
        textDecoration: `underline 2px solid ${isDarkMode ? '#4a4a4a' : '#e0e0e0'}`,
      },
      {
        tag: tags.heading2,
        fontSize: '1.875em',
        fontWeight: '600',
        color: isDarkMode ? '#f5f5f5' : '#1f1f1f',
        lineHeight: '1.3',
      },
      {
        tag: tags.heading3,
        fontSize: '1.5em',
        fontWeight: '600',
        color: isDarkMode ? '#f0f0f0' : '#2a2a2a',
        lineHeight: '1.3',
      },
      {
        tag: tags.heading4,
        fontSize: '1.25em',
        fontWeight: '600',
        color: isDarkMode ? '#eeeeee' : '#333333',
        lineHeight: '1.4',
      },
      {
        tag: [tags.heading5, tags.heading6],
        fontSize: '1.125em',
        fontWeight: '600',
        color: isDarkMode ? '#eeeeee' : '#333333',
        lineHeight: '1.4',
      },
      // Bold text
      {
        tag: tags.strong,
        fontWeight: '700',
        color: isDarkMode ? '#ffffff' : '#1a1a1a',
      },
      // Italic text
      {
        tag: tags.emphasis,
        fontStyle: 'italic',
        color: isDarkMode ? '#f0f0f0' : '#2a2a2a',
      },
      // Strikethrough
      {
        tag: tags.strikethrough,
        textDecoration: 'line-through',
        color: isDarkMode ? '#888888' : '#666666',
      },
      // Links
      {
        tag: tags.link,
        color: isDarkMode ? '#66b3ff' : '#0066cc',
        textDecoration: 'underline',
        cursor: 'pointer',
      },
      // Inline code
      {
        tag: tags.monospace,
        fontFamily: '"JetBrains Mono", "Fira Code", "SF Mono", Consolas, monospace',
        fontSize: '0.9em',
        backgroundColor: isDarkMode ? '#2a2a2a' : '#f6f6f6',
        color: isDarkMode ? '#ff6b6b' : '#d73a49',
        padding: '2px 6px',
        borderRadius: '4px',
        border: `1px solid ${isDarkMode ? '#404040' : '#e1e1e1'}`,
      },
      // Blockquotes
      {
        tag: tags.quote,
        borderLeft: `4px solid ${isDarkMode ? '#666666' : '#cccccc'}`,
        paddingLeft: '16px',
        color: isDarkMode ? '#b0b0b0' : '#555555',
        fontStyle: 'italic',
        backgroundColor: isDarkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
        borderRadius: '0 4px 4px 0',
      },
      // Lists
      {
        tag: tags.list,
        paddingLeft: '24px',
      },
      // Markdown syntax markers (meta) - make them less prominent
      {
        tag: tags.meta,
        opacity: '0.5',
        color: isDarkMode ? '#888888' : '#666666',
      },
    ]);

    const themeExtension = EditorView.theme({
      '&': {
        fontSize: '16px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", sans-serif',
      },
      '.cm-content': {
        padding: '32px',
        minHeight: '400px',
        lineHeight: '1.6',
        fontFamily: 'inherit',
        color: isDarkMode ? '#e3e3e3' : '#2c2c2c',
        textAlign: 'left',
      },
      '.cm-focused': {
        outline: 'none',
      },
      '.cm-editor': {
        backgroundColor: isDarkMode ? '#1a1a1a' : '#ffffff',
        border: 'none',
        height: '100%',
      },
      '.cm-line': {
        fontFamily: 'inherit',
        textAlign: 'left',
      },
    });

    return [
      markdownExtension,
      syntaxHighlighting(markdownHighlightStyle),
      themeExtension,
      EditorView.lineWrapping,
    ] as Extension[];
  }, [isDarkMode]);

  const theme = isDarkMode ? oneDark : githubLight;

  return (
    <div className="editor-content">
      <div className="editor-wrapper">
        <CodeMirror
          key={editorKey}
          ref={editorRef}
          value={initialContent}
          onChange={onContentChange}
          extensions={extensions}
          theme={theme}
          placeholder="Start writing your note in Markdown..."
          basicSetup={{
            lineNumbers: false,
            foldGutter: true,
            dropCursor: false,
            allowMultipleSelections: false,
            indentOnInput: true,
            bracketMatching: true,
            closeBrackets: true,
            autocompletion: true,
            highlightSelectionMatches: false,
          }}
        />
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  return prevProps.noteId === nextProps.noteId;
});

// Controls component - handles title and context menu
interface EditorControlsProps {
  title: string;
  titleError: string;
  onTitleChange: (title: string) => void;
  onDeleteNote: () => void;
}

const EditorControls: React.FC<EditorControlsProps> = ({
  title,
  titleError,
  onTitleChange,
  onDeleteNote
}) => {
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onTitleChange(e.target.value);
  };

  const handleDeleteClick = () => {
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = () => {
    setDeleteModalOpen(false);
    onDeleteNote();
  };

  return (
    <>
      <div className="editor-header">
        <div className="editor-title-section">
          <div className="title-with-menu">
            <input
              type="text"
              value={title}
              onChange={handleTitleChange}
              className={`editor-title-input ${titleError ? 'error' : ''}`}
              placeholder="Note title..."
              maxLength={200}
            />
            <Menu shadow="md" width={200}>
              <Menu.Target>
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  size="lg"
                  className="context-menu-trigger"
                >
                  <Icons.dots size="md" />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item
                  color="red"
                  leftSection={<Icons.trash size="sm" />}
                  onClick={handleDeleteClick}
                >
                  Delete Note
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </div>
          {titleError && <div className="title-error">{titleError}</div>}
        </div>
      </div>

      <Modal
        opened={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete Note"
        centered
      >
        <Text size="sm" mb="md">
          Are you sure you want to delete this note? This action cannot be undone.
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

// Main container component - handles all the logic and state
export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  note,
  vaultPath,
  sessionId,
  isDarkMode,
  onError,
  onNoteUpdated,
  onNoteDeleted,
}) => {
  const [title, setTitle] = useState(note.title);
  const [titleError, setTitleError] = useState('');

  const originalNoteRef = useRef(note);
  const contentRef = useRef(note.content);
  const titleRef = useRef(note.title);
  const savingRef = useRef(false);

  const lastActivityRef = useRef<number>(Date.now());
  const activityTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (note.id !== originalNoteRef.current.id) {
      // Completely new note
      originalNoteRef.current = note;
      setTitle(note.title);
      titleRef.current = note.title;
      contentRef.current = note.content;
      // Reset activity tracking for new note
      lastActivityRef.current = Date.now();
    }
  }, [note]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (activityTimeoutRef.current) {
        clearTimeout(activityTimeoutRef.current);
      }
    };
  }, []);

  // Silent auto-save function - no UI updates, no notifications
  const autoSave = useCallback(async () => {
    if (savingRef.current) return;

    // Check if we have actual changes
    const original = originalNoteRef.current;
    const currentTitle = titleRef.current;
    const currentContent = contentRef.current;

    const hasChanges = 
      currentTitle !== original.title ||
      currentContent !== original.content;

    if (!hasChanges) return;

    // Validate title silently
    const trimmedTitle = currentTitle.trim();
    const trimmedContent = currentContent.trim();

    // Don't save if both title and content are empty/default
    if ((!trimmedTitle || trimmedTitle === 'Untitled') && !trimmedContent) {
      return;
    }

    if (trimmedTitle.length > 200) return;

    savingRef.current = true;

    try {
      const result: SaveNoteResult = await api.saveNote(
        vaultPath,
        sessionId,
        note.id,
        trimmedTitle,
        trimmedContent,
        note.tags, // Keep existing tags
        note.folder_path
      );

      if (result.success && result.note) {
        // Update all refs with the saved note data
        originalNoteRef.current = result.note;
        titleRef.current = result.note.title;
        contentRef.current = result.note.content;

        // Update UI state if the title changed on the server
        if (result.note.title !== title) {
          setTitle(result.note.title);
        }

        // Notify parent about the update
        if (onNoteUpdated) {
          onNoteUpdated(result.note);
        }
      } else {
        // Only show errors, never success notifications
        onError(result.error_message || 'Failed to save note');
      }
    } catch (error) {
      onError(`Failed to save note: ${error}`);
    } finally {
      savingRef.current = false;
    }
  }, [note.id, note.folder_path, note.tags, vaultPath, sessionId, onError, onNoteUpdated, title]);

  // Track user activity and trigger autosave after inactivity
  const trackActivity = useCallback(() => {
    lastActivityRef.current = Date.now();

    if (activityTimeoutRef.current) {
      clearTimeout(activityTimeoutRef.current);
    }

    activityTimeoutRef.current = setTimeout(() => {
      autoSave();
    }, 300);
  }, [autoSave]);


  const debouncedTitleValidation = useMemo(
    () => debounce((title: string) => {
      if (title.trim().length === 0) {
        setTitleError('Title cannot be empty');
      } else if (title.length > 200) {
        setTitleError('Title cannot exceed 200 characters');
      } else {
        setTitleError('');
      }
    }, 150),
    []
  );

  // Handle content changes from editor - NO UI state updates
  const handleContentChange = useCallback((value: string) => {
    // Only update the content ref, no state changes
    contentRef.current = value;

    // Track user activity and trigger autosave after inactivity
    trackActivity();
  }, [trackActivity]);

  // Handle title changes - optimized for better UX
  const handleTitleChange = useCallback((newTitle: string) => {
    setTitle(newTitle);
    titleRef.current = newTitle; // Keep ref in sync immediately

    // Clear any existing error immediately for better UX
    if (titleError && newTitle.trim().length > 0 && newTitle.length <= 200) {
      setTitleError('');
    }

    // Debounced validation for edge cases
    debouncedTitleValidation(newTitle);

    // Track user activity and trigger autosave after inactivity
    trackActivity();
  }, [trackActivity, debouncedTitleValidation, titleError]);

  // Handle note deletion
  const handleDeleteNote = useCallback(async () => {
    try {
      const success = await api.deleteNote(vaultPath, sessionId, note.id);
      if (success) {
        if (onNoteDeleted) {
          onNoteDeleted(note.id);
        }
      } else {
        onError('Failed to delete note');
      }
    } catch (error) {
      onError(`Failed to delete note: ${error}`);
    }
  }, [vaultPath, sessionId, note.id, onNoteDeleted, onError]);

  return (
    <div className="markdown-editor">
      <EditorControls
        title={title}
        titleError={titleError}
        onTitleChange={handleTitleChange}
        onDeleteNote={handleDeleteNote}
      />

      <MarkdownEditorCore
        initialContent={note.content}
        isDarkMode={isDarkMode}
        noteId={note.id}
        onContentChange={handleContentChange}
      />
    </div>
  );
}; 
