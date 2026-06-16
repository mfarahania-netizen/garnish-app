import { Box, Text } from '@mantine/core';
import { Link } from 'react-router-dom';

/**
 * NotFound — the in-shell 404. Any route that isn't "/" lands here for now
 * (no content pages exist yet), so the nav still routes and stays framed by
 * the shell instead of showing a blank or broken page.
 */
export default function NotFound() {
  return (
    <Box
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--g-space-3)',
        paddingInline: 'var(--g-space-6)',
        paddingBlock: 'var(--g-space-12)',
        textAlign: 'center',
      }}
    >
      <Text
        component="span"
        style={{
          fontFamily: 'var(--g-font-fa)',
          fontSize: 'var(--g-font-size-34)',
          fontWeight: 700,
          color: 'var(--g-color-brand-600)',
        }}
      >
        ۴۰۴
      </Text>
      <Text
        component="h1"
        style={{
          fontFamily: 'var(--g-font-fa)',
          fontSize: 'var(--g-font-size-22)',
          fontWeight: 700,
          color: 'var(--g-color-text-primary)',
        }}
      >
        صفحه پیدا نشد
      </Text>
      <Text
        style={{
          fontFamily: 'var(--g-font-fa)',
          fontSize: 'var(--g-font-size-16)',
          color: 'var(--g-color-text-secondary)',
          maxInlineSize: '32ch',
          lineHeight: 'var(--g-leading-body)',
        }}
      >
        این بخش هنوز ساخته نشده است. به‌زودی اضافه می‌شود.
      </Text>
      <Text
        component={Link}
        to="/"
        style={{
          marginBlockStart: 'var(--g-space-2)',
          color: 'var(--g-color-brand-600)',
          fontFamily: 'var(--g-font-fa)',
          fontSize: 'var(--g-font-size-16)',
          fontWeight: 600,
          textDecoration: 'none',
        }}
      >
        بازگشت به خانه
      </Text>
    </Box>
  );
}
