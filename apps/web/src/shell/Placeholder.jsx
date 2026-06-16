import { Box, Image, Text } from '@mantine/core';

/**
 * Placeholder — the single trivial route at "/" so the shell is
 * screenshot-verifiable. Deliberately empty/minimal: this is NOT the Home
 * page. Real content screens arrive one-by-one in later sprints.
 */
export default function Placeholder() {
  return (
    <Box
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--g-space-4)',
        paddingInline: 'var(--g-space-6)',
        paddingBlock: 'var(--g-space-12)',
        textAlign: 'center',
      }}
    >
      <Image src="/logo-garnish.png" alt="گارنیش" h={72} w="auto" fit="contain" />
      <Text
        component="h1"
        style={{
          fontFamily: 'var(--g-font-fa)',
          fontSize: 'var(--g-font-size-28)',
          fontWeight: 700,
          color: 'var(--g-color-text-primary)',
        }}
      >
        به‌زودی
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
        اسکلت اپلیکیشن گارنیش آماده است. صفحه‌ها یکی‌یکی ساخته و بازبینی می‌شوند.
      </Text>
    </Box>
  );
}
