import { useState } from 'react';
import { Textarea, Button, Group, Paper, Text, Stack, ActionIcon } from '@mantine/core';
import { IconPlus, IconTrash } from '@tabler/icons-react';

export default function StepsSection({ textColor, steps, setSteps }) {
  const [instruction, setInstruction] = useState('');

  const addStep = () => {
    if (!instruction.trim()) return;
    setSteps([...steps, { instruction: instruction.trim() }]);
    setInstruction('');
  };

  return (
    <Stack gap="sm">
      <Text c={textColor} fw={500}>مراحل پخت</Text>
      <Textarea
        placeholder="شرح مرحله"
        value={instruction}
        onChange={(e) => setInstruction(e.target.value)}
        minRows={2}
      />
      <Button variant="light" leftSection={<IconPlus size={16} />} onClick={addStep}>
        افزودن مرحله
      </Button>
      {steps.length > 0 && (
        <Stack gap="xs">
          {steps.map((step, idx) => (
            <Paper key={idx} p="xs" withBorder radius="md">
              <Group justify="space-between">
                <Text size="sm">{idx + 1}. {step.instruction}</Text>
                <ActionIcon variant="subtle" color="red" onClick={() => {
                  const updated = steps.filter((_, i) => i !== idx);
                  setSteps(updated);
                }}>
                  <IconTrash size={14} />
                </ActionIcon>
              </Group>
            </Paper>
          ))}
        </Stack>
      )}
    </Stack>
  );
}