import { useState, useCallback } from 'react';
import { 
  Container, 
  Paper, 
  Title, 
  Text, 
  TextInput, 
  Textarea, 
  Button, 
  Group, 
  Stack, 
  Alert, 
  Box,
  Divider,
  Progress
} from '@mantine/core';
import { 
  IconAlertTriangle, 
  IconFileText,
  IconCheck
} from '@tabler/icons-react';
import { api } from '../utils/api';
import type { CreateNoteResult } from '../types';

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

      const title = state.title.trim();
      const content = state.content.trim() || undefined;
      const tags = state.tags.trim() 
        ? state.tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0)
        : undefined;
      const folderPath = state.folderPath.trim() || undefined;

      const result: CreateNoteResult = await api.createNote(
        vaultPath, 
        sessionId, 
        title,
        content,
        tags,
        folderPath
      );

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
  const titleLength = state.title.length;
  const titleProgress = (titleLength / 200) * 100;

  return (
    <Container size="md" py="xl">
      <Paper p="xl" radius="lg" shadow="md">
        <Stack gap="xl">
          {/* Header */}
          <Box>
            <Title order={2} mb="xs">
              <Group gap="sm">
                <IconFileText size={24} />
                Create New Note
              </Group>
            </Title>
            <Text c="dimmed" size="lg">
              Add a new note to your encrypted vault
            </Text>
          </Box>

          <Divider />

          {/* Form Section */}
          <Stack gap="lg">
            <Box>
              <TextInput
                label="Title"
                placeholder="Enter note title"
                value={state.title}
                onChange={(e) => handleTitleChange(e.target.value)}
                onKeyDown={handleKeyPress}
                disabled={state.isCreating}
                error={titleValidation && !titleValidation.valid ? titleValidation.message : undefined}
                size="md"
                required
                autoFocus
                maxLength={250}
              />
              
              {/* Character count and progress */}
              <Group justify="space-between" mt="xs">
                <Text size="xs" c="dimmed">
                  {titleLength}/200 characters
                </Text>
                {titleLength > 0 && (
                  <Text size="xs" c={titleLength > 200 ? 'red' : 'dimmed'}>
                    {titleLength > 200 ? 'Too long' : 'Good'}
                  </Text>
                )}
              </Group>
              
              {titleLength > 0 && (
                <Progress 
                  value={Math.min(titleProgress, 100)} 
                  color={titleLength > 200 ? 'red' : titleLength > 150 ? 'orange' : 'blue'}
                  size="xs" 
                  mt="xs"
                />
              )}
            </Box>

            <Textarea
              label="Content"
              placeholder="Start writing your note..."
              value={state.content}
              onChange={(e) => handleContentChange(e.target.value)}
              disabled={state.isCreating}
              size="md"
              minRows={8}
              maxRows={15}
              autosize
            />

            <TextInput
              label="Tags"
              placeholder="tag1, tag2, tag3"
              value={state.tags}
              onChange={(e) => handleTagsChange(e.target.value)}
              disabled={state.isCreating}
              size="md"
              description="Separate tags with commas"
            />

            <TextInput
              label="Folder Path"
              placeholder="folder/subfolder"
              value={state.folderPath}
              onChange={(e) => handleFolderPathChange(e.target.value)}
              disabled={state.isCreating}
              size="md"
              description="Optional folder path to organize your note"
            />
          </Stack>

          {/* Error Display */}
          {state.error && (
            <Alert
              icon={<IconAlertTriangle size={16} />}
              title="Error"
              color="red"
              variant="light"
            >
              {state.error}
            </Alert>
          )}

          <Divider />

          {/* Form Actions */}
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              Press Ctrl+Enter to create quickly
            </Text>
            
            <Group gap="md">
              {onCancel && (
                <Button
                  variant="light"
                  onClick={onCancel}
                  disabled={state.isCreating}
                  size="md"
                >
                  Cancel
                </Button>
              )}
              
              <Button
                leftSection={<IconCheck size={16} />}
                onClick={handleCreateNote}
                disabled={!canCreateNote()}
                loading={state.isCreating}
                size="md"
              >
                {state.isCreating ? 'Creating Note...' : 'Create Note'}
              </Button>
            </Group>
          </Group>
        </Stack>
      </Paper>
    </Container>
  );
} 