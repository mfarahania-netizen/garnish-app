import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
export function Chevron({ direction = 'left' }) {
  return direction === 'right' ? <IconChevronLeft size={14} /> : <IconChevronRight size={14} />;
}