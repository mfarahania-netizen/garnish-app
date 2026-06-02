import { Group, Box } from '@mantine/core';
import { motion } from 'framer-motion';

const dotVariants = {
  animate: (i) => ({
    y: [0, -6, 0],
    transition: { duration: 0.6, repeat: Infinity, delay: i * 0.15 },
  }),
};

export default function ThinkingIndicator() {
  return (
    <Group gap="xs" py="sm" px="md">
      <Box
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #FF6B35, #FF8F65)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 18,
        }}
      >
        🧑‍🍳
      </Box>
      <Group gap={4}>
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            custom={i}
            variants={dotVariants}
            animate="animate"
            style={{ width: 8, height: 8, borderRadius: '50%', background: '#FF6B35' }}
          />
        ))}
      </Group>
    </Group>
  );
}