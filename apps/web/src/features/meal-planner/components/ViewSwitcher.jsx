import { SegmentedControl } from '@mantine/core';
import { IconCalendar, IconSun, IconList } from '@tabler/icons-react';

export default function ViewSwitcher({ view, onChange }) {
  return (
    <SegmentedControl
      fullWidth
      mb="md"
      value={view}
      onChange={onChange}
      data={[
        { value: 'today', label: 'امروز' },
        { value: 'week', label: 'هفتگی' },
        { value: 'list', label: 'لیست' },
      ]}
    />
  );
}