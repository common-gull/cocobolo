import { 
  Container, 
  Paper, 
  Title, 
  Text, 
  Stack, 
  Group,
  Button,
  Center,
  Box
} from '@mantine/core';
import { 
  IconFileText, 
  IconPalette,
  IconPlus
} from '@tabler/icons-react';
import { useSetAtom } from 'jotai';
import { useNavigate } from 'react-router';
import { useOutletContext } from 'react-router';

import { addNoteAtom } from '../stores/notesStore';
import type { NoteMetadata } from '../types';
import { api } from '../utils/api';

interface AppContext {
  sessionId: string;
  vaultInfo: any;
  vaultPath: string;
}

export default function App() {
  const navigate = useNavigate();
  const { vaultInfo, sessionId, vaultPath } = useOutletContext<AppContext>();
  const addNote = useSetAtom(addNoteAtom);

  const handleCreateNote = async () => {
    try {
      const result = await api.createNote(
        vaultPath,
        sessionId,
        'Untitled',
        '',
        undefined,
        undefined,
        'text'
      );

      if (result.success && result.note) {
        // Convert Note to NoteMetadata and add to store
        const noteMetadata: NoteMetadata = {
          id: result.note.id,
          title: result.note.title,
          note_type: result.note.note_type,
          content_preview: result.note.content.substring(0, 100),
          created_at: result.note.created_at,
          updated_at: result.note.updated_at,
          tags: result.note.tags,
          ...(result.note.folder_path && { folder_path: result.note.folder_path })
        };
        addNote(noteMetadata);
        navigate(`/documents/${result.note.id}`);
      } else {
        console.error('Failed to create note:', result.error_message);
      }
    } catch (error) {
      console.error('Failed to create note:', error);
    }
  };

  const handleCreateWhiteboard = async () => {
    try {
      const result = await api.createNote(
        vaultPath,
        sessionId,
        'Untitled Whiteboard',
        '{}',
        undefined,
        undefined,
        'whiteboard'
      );

      if (result.success && result.note) {
        // Convert Note to NoteMetadata and add to store
        const noteMetadata: NoteMetadata = {
          id: result.note.id,
          title: result.note.title,
          note_type: result.note.note_type,
          content_preview: result.note.content.substring(0, 100),
          created_at: result.note.created_at,
          updated_at: result.note.updated_at,
          tags: result.note.tags,
          ...(result.note.folder_path && { folder_path: result.note.folder_path })
        };
        addNote(noteMetadata);
        navigate(`/documents/${result.note.id}`);
      } else {
        console.error('Failed to create whiteboard:', result.error_message);
      }
    } catch (error) {
      console.error('Failed to create whiteboard:', error);
    }
  };

  return (
    <Container size="md" h="100%">
      <Center h="100%">
        <Paper shadow="sm" radius="md" p="xl" w="100%" maw={600}>
          <Stack gap="xl" align="center">
            <Stack gap="sm" align="center">
              <Title order={2}>Welcome to {vaultInfo?.name || 'Your Vault'}</Title>
              <Text c="dimmed" ta="center">
                Create a new note or whiteboard to get started, or select an existing note from the sidebar.
              </Text>
            </Stack>

            <Group gap="lg">
              <Button
                size="lg"
                leftSection={<IconFileText size={20} />}
                onClick={handleCreateNote}
                variant="light"
              >
                Create Note
              </Button>
              
              <Button
                size="lg"
                leftSection={<IconPalette size={20} />}
                onClick={handleCreateWhiteboard}
                variant="light"
                color="teal"
              >
                Create Whiteboard
              </Button>
            </Group>

            <Box>
              <Text size="sm" c="dimmed" ta="center">
                Or use the <IconPlus size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> button in the sidebar to create new content.
              </Text>
            </Box>
          </Stack>
        </Paper>
      </Center>
    </Container>
  );
} 