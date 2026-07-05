import { Box, Text } from '@mantine/core';
import IngredientRow from './IngredientRow.jsx';

const card = {
  background: 'var(--g-color-bg-surface)',
  border: '1px solid var(--g-color-border-subtle)',
  borderRadius: 'var(--g-radius-card)',
  overflow: 'hidden',
};

export default function IngredientListSection({ sections = [], renderItemProps = () => ({}) }) {
  return (
    <>
      {sections.map((section) => (
        <Box key={section.title} style={{ marginBlockEnd: 'var(--g-space-3)' }}>
          <Text
            component="div"
            style={{
              fontFamily: 'var(--g-font-fa)',
              fontSize: 'var(--g-font-size-13)',
              fontWeight: 850,
              color: 'var(--g-color-brand-700)',
              margin: '0 0 var(--g-space-2)',
              textAlign: 'right',
            }}
          >
            {section.title}
          </Text>
          <Box component="ul" dir="rtl" style={{ ...card, margin: 0, padding: 0 }}>
            {section.items.map((item, index) => (
              <IngredientRow
                key={`${section.title}-${item.titleFa}-${index}`}
                item={item}
                {...renderItemProps(item, index, section)}
              />
            ))}
          </Box>
        </Box>
      ))}
    </>
  );
}
