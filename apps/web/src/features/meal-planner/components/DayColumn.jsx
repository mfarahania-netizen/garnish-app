import { Badge, Paper, Text } from '@mantine/core';
import MealSlot from './MealSlot';
import { MEALS } from '../services/planHelpers';

export default function DayColumn({ day, isToday, onOpenPicker, onRemoveMeal, getRecipeTitle, dark }) {
  return (
    <Paper
      shadow="sm"
      p="sm"
      radius="lg"
      withBorder
      style={{
        backgroundColor: isToday
          ? dark ? 'rgba(255,107,53,0.1)' : 'rgba(255,107,53,0.05)'
          : dark ? '#1e1e24' : '#fff',
        border: isToday ? '1px solid #FF6B35' : undefined,
        minWidth: 130,
      }}
    >
      <Text fw={700} mb="sm" ta="center" c={isToday ? 'orange' : dark ? 'white' : 'navy.9'}>
        {day}
        {isToday && <Badge color="orange" size="xs" ml={6}>امروز</Badge>}
      </Text>

      {MEALS.map((meal) => (
        <MealSlot
          key={meal}
          day={day}
          meal={meal}
          recipeTitle={getRecipeTitle(day, meal)}
          onOpenPicker={onOpenPicker}
          onRemove={onRemoveMeal}
          dark={dark}
        />
      ))}
    </Paper>
  );
}
