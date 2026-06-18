import { Box, Text, UnstyledButton } from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import { IconChevronRight } from '@tabler/icons-react';

/**
 * LegalPage — a minimal, token-pure, RTL legal scaffold for /terms + /privacy. These exist so the onboarding
 * consent links no longer 404; content reflects the app's ACTUAL, current practices in plain Persian (not
 * fabricated boilerplate). Public (pre-auth) route, opened standalone (target=_blank) from onboarding.
 */
export default function LegalPage({ title, updated, intro, sections }) {
  const navigate = useNavigate();
  const back = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  };
  return (
    <Box style={{ minBlockSize: '100dvh', display: 'flex', justifyContent: 'center', background: 'var(--g-color-bg-canvas)' }}>
      <Box style={{ width: '100%', maxInlineSize: 560, minBlockSize: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--g-color-bg-canvas)', borderInline: '1px solid var(--g-color-border-subtle)' }}>
        <Box component="header" style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)', paddingInline: 'var(--g-space-4)', paddingBlockStart: 'calc(var(--g-space-4) + env(safe-area-inset-top))', paddingBlockEnd: 'var(--g-space-3)', borderBlockEnd: '1px solid var(--g-color-border-subtle)' }}>
          <UnstyledButton type="button" onClick={back} aria-label="بازگشت" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', inlineSize: 40, blockSize: 40, borderRadius: '50%', background: 'var(--g-color-bg-surface)', border: '1px solid var(--g-color-border-subtle)', color: 'var(--g-color-text-primary)' }}>
            <IconChevronRight size={20} stroke={1.8} />
          </UnstyledButton>
          <Text component="h1" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-18)', fontWeight: 800, color: 'var(--g-color-text-primary)', margin: 0 }}>{title}</Text>
        </Box>

        <Box component="main" style={{ flex: 1, overflowY: 'auto', paddingInline: 'var(--g-space-4)', paddingBlock: 'var(--g-space-4)' }}>
          {updated ? (
            <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-text-muted)', margin: '0 0 var(--g-space-3)' }}>آخرین به‌روزرسانی: {updated}</Text>
          ) : null}
          {intro ? (
            <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', lineHeight: 'var(--g-leading-body)', color: 'var(--g-color-text-secondary)', margin: '0 0 var(--g-space-4)' }}>{intro}</Text>
          ) : null}
          {sections.map((s, i) => (
            <Box key={i} style={{ marginBlockEnd: 'var(--g-space-5)' }}>
              <Text component="h2" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-15)', fontWeight: 800, color: 'var(--g-color-text-primary)', margin: '0 0 var(--g-space-2)' }}>{s.heading}</Text>
              <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', lineHeight: 'var(--g-leading-body)', color: 'var(--g-color-text-secondary)', margin: 0 }}>{s.body}</Text>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}
