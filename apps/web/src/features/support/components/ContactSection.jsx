import { Paper, Text, Group, ActionIcon, Tooltip, Box, useMantineColorScheme } from '@mantine/core';
import { IconPhone, IconBrandWhatsapp, IconBrandTelegram, IconMessageCircle } from '@tabler/icons-react';

const SUPPORT_CONTACTS = [
  { icon: <IconPhone size={22} />, label: 'تماس تلفنی', action: 'tel:+982112345678' },
  { icon: <IconBrandWhatsapp size={22} color="#25D366" />, label: 'واتساپ', action: 'https://wa.me/989121234567' },
  { icon: <IconBrandTelegram size={22} color="#0088cc" />, label: 'تلگرام', action: 'https://t.me/garnish_support' },
  { icon: <IconMessageCircle size={22} color="#00A885" />, label: 'بله', action: 'https://ble.im/garnish_bot' },
];

export default function ContactSection() {
  const { colorScheme } = useMantineColorScheme();
  const dark = colorScheme === 'dark';
  const bgColor = dark ? '#1e1e24' : '#fff';
  const textColor = dark ? '#fff' : '#1A237E';

  return (
    <Paper shadow="sm" p="md" radius="lg" mb="lg" style={{ backgroundColor: bgColor }}>
      <Text fw={500} mb="md" ta="center" c={textColor}>راه‌های ارتباطی</Text>
      <Group justify="center" gap="xl" wrap="wrap">
        {SUPPORT_CONTACTS.map((contact, i) => (
          <Tooltip key={i} label={contact.label} withArrow>
            <Box
              component="a"
              href={contact.action}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 52,
                height: 52,
                borderRadius: '50%',
                background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                border: `1px solid ${dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
                boxShadow: dark ? 'none' : '0 2px 6px rgba(0,0,0,0.03)',
                textDecoration: 'none',
                transition: 'transform 0.2s, box-shadow 0.2s',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.08)';
                e.currentTarget.style.boxShadow = dark ? '0 0 0 1px rgba(255,255,255,0.2)' : '0 4px 14px rgba(0,0,0,0.06)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = dark ? 'none' : '0 2px 6px rgba(0,0,0,0.03)';
              }}
            >
              {contact.icon}
            </Box>
          </Tooltip>
        ))}
      </Group>
    </Paper>
  );
}