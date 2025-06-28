import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { oneDark } from '@codemirror/theme-one-dark';
import { githubLight } from '@uiw/codemirror-theme-github';
import { EditorView } from '@codemirror/view';
import { Extension } from '@codemirror/state';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import debounce from 'lodash.debounce';
import { api } from '../utils/api';
import type { Note, SaveNoteResult } from '../types';
import './MarkdownEditor.css';

interface MarkdownEditorProps {
  note: Note;
  vaultPath: string;
  sessionId: string;
  isDarkMode: boolean;
  onClose: () => void;
  onError: (error: string) => void;
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

// Controls component - handles title, tags, status, buttons
interface EditorControlsProps {
  title: string;
  tags: string;
  titleError: string;
  noteCreatedAt: string;
  noteUpdatedAt: string;
  onTitleChange: (title: string) => void;
  onTagsChange: (tags: string) => void;
  onClose: () => void;
}

const EditorControls: React.FC<EditorControlsProps> = ({
  title,
  tags,
  titleError,
  noteCreatedAt,
  noteUpdatedAt,
  onTitleChange,
  onTagsChange,
  onClose
}) => {
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onTitleChange(e.target.value);
  };

  const handleTagsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onTagsChange(e.target.value);
  };

  return (
    <>
      <div className="editor-header">
        <div className="editor-title-section">
          <input
            type="text"
            value={title}
            onChange={handleTitleChange}
            className={`editor-title-input ${titleError ? 'error' : ''}`}
            placeholder="Note title..."
            maxLength={200}
          />
          {titleError && <div className="title-error">{titleError}</div>}
        </div>
        
        <div className="editor-controls">
          <div className="editor-status">
          </div>
          
          <div className="editor-buttons">
            <button
              type="button"
              onClick={onClose}
              className="close-button"
              title="Close Editor"
            >
              ✕
            </button>
          </div>
        </div>
      </div>

      <div className="editor-meta">
        <div className="tags-section">
          <label htmlFor="note-tags">Tags:</label>
          <input
            id="note-tags"
            type="text"
            value={tags}
            onChange={handleTagsChange}
            placeholder="tag1, tag2, tag3..."
            className="tags-input"
          />
        </div>
        
        <div className="note-info">
          <span>Created: {new Date(noteCreatedAt).toLocaleDateString()}</span>
          <span>Updated: {new Date(noteUpdatedAt).toLocaleDateString()}</span>
        </div>
      </div>


    </>
  );
};

// Main container component - handles all the logic and state
export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  note,
  vaultPath,
  sessionId,
  isDarkMode,
  onClose,
  onError
}) => {
  const [title, setTitle] = useState(note.title);
  const [tags, setTags] = useState(note.tags.join(', '));
  const [titleError, setTitleError] = useState('');
  
  // Refs for auto-save operations - no UI state for content changes
  const originalNoteRef = useRef(note);
  const contentRef = useRef(note.content);
  const savingRef = useRef(false);

  // Update refs when note changes from outside (switching notes)
  useEffect(() => {
    if (note.id !== originalNoteRef.current.id) {
      // Completely new note
      originalNoteRef.current = note;
      setTitle(note.title);
      setTags(note.tags.join(', '));
      contentRef.current = note.content;
    }
  }, [note]);

  // Silent auto-save function - no UI updates, no notifications
  const autoSave = useCallback(async () => {
    if (savingRef.current) return;
    
    // Check if we have actual changes
    const original = originalNoteRef.current;
    const currentTags = tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
    
    const hasChanges = 
      title !== original.title ||
      contentRef.current !== original.content ||
      JSON.stringify(currentTags.sort()) !== JSON.stringify(original.tags.sort());
    
    if (!hasChanges) return;
    
    // Validate title silently
    const trimmedTitle = title.trim();
    if (!trimmedTitle || trimmedTitle.length > 200) return;

    savingRef.current = true;
    
    try {
      const currentContent = contentRef.current;
      
      const result: SaveNoteResult = await api.saveNote(
        vaultPath,
        sessionId,
        note.id,
        trimmedTitle,
        currentContent,
        currentTags,
        note.folder_path
      );

      if (result.success && result.note) {
        // Silently update the original note reference
        originalNoteRef.current = result.note;
        // No need to call onNoteUpdated - we already know the current note!
      } else {
        // Only show errors, never success notifications
        onError(result.error_message || 'Failed to save note');
      }
    } catch (error) {
      onError(`Failed to save note: ${error}`);
    } finally {
      savingRef.current = false;
    }
  }, [title, tags, note.id, note.folder_path, vaultPath, sessionId, onError]);

  // Debounced auto-save - completely silent
  const debouncedAutoSave = useMemo(
    () => debounce(autoSave, 300),
    [autoSave]
  );

  // Handle content changes from editor - NO UI state updates
  const handleContentChange = useCallback((value: string) => {
    // Only update the content ref, no state changes
    contentRef.current = value;
    
    // Trigger silent auto-save
    debouncedAutoSave();
  }, [debouncedAutoSave]);

  // Handle title changes - only update state for title validation
  const handleTitleChange = useCallback((newTitle: string) => {
    setTitle(newTitle);
    
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

  // Handle tags changes
  const handleTagsChange = useCallback((newTags: string) => {
    setTags(newTags);
    
    // Trigger auto-save for tag changes
    debouncedAutoSave();
  }, [debouncedAutoSave]);

  // Handle close - no unsaved changes warning since everything auto-saves
  const handleClose = useCallback(() => {
    debouncedAutoSave.cancel();
    onClose();
  }, [debouncedAutoSave, onClose]);



  return (
    <div className="markdown-editor">
      <EditorControls
        title={title}
        tags={tags}
        titleError={titleError}
        noteCreatedAt={note.created_at}
        noteUpdatedAt={note.updated_at}
        onTitleChange={handleTitleChange}
        onTagsChange={handleTagsChange}
        onClose={handleClose}
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