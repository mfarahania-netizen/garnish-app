import { Group, Badge, ScrollArea } from '@mantine/core';
import { getTimeBasedContext } from '../services/personalizationService';

const CHIPS = {
  'صبحانه': ['املت', 'عدسی', 'حلیم', 'پنکیک'],
  'ناهار': ['قرمه‌سبزی', 'چلوکباب', 'زرشک‌پلو', 'خورشت'],
  'شام': ['کوکو', 'سوپ', 'املت', 'سالاد'],
};

export default function SuggestionChips({ onChipClick }) {
  const timeContext = getTimeBasedContext();
  const chips = CHIPS[timeContext] || CHIPS['ناهار'];

  return (
    <ScrollArea type="never" mb="sm">
      <Group gap="xs" wrap="nowrap" px="md">
        {chips.map((chip, idx) => (
          <Badge
            key={idx}
            variant="light"
            size="lg"
            radius="xl"
            style={{ cursor: 'pointer', flexShrink: 0 }}
            onClick={() => onChipClick(`طرز تهیه ${chip}`)}
          >
            {chip}
          </Badge>
        ))}
      </Group>
    </ScrollArea>
  );
}