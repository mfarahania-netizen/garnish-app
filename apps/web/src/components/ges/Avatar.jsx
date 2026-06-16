import { Box, Text } from '@mantine/core';
import { IconUser } from '@tabler/icons-react';

/**
 * Avatar — a user avatar: photo when available, else initials, else a neutral
 * user glyph. Calm, token-pure, circular. No status-ring spectacle.
 *
 * Pure presentational. Token-pure.
 *
 * Props:
 *  - name: used to derive initials + the default alt text
 *  - src: optional photo URL
 *  - size: diameter in px (default 40)
 *  - alt: override alt / accessible label
 */
function initialsOf(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export function Avatar({ name = '', src, size = 40, alt }) {
  const initials = initialsOf(name);
  const label = alt || (name ? `${name}` : 'User');

  const base = {
    inlineSize: size,
    blockSize: size,
    borderRadius: 'var(--g-radius-chip)',
    flexShrink: 0,
    overflow: 'hidden',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--g-color-brand-50)',
    border: '1px solid var(--g-color-border-subtle)',
  };

  if (src) {
    return (
      <Box style={base}>
        <Box
          component="img"
          src={src}
          alt={label}
          style={{ inlineSize: '100%', blockSize: '100%', objectFit: 'cover' }}
        />
      </Box>
    );
  }

  return (
    <Box role="img" aria-label={label} style={base}>
      {initials ? (
        <Text
          component="span"
          aria-hidden="true"
          style={{
            fontFamily: 'var(--g-font-display)',
            fontSize: Math.max(12, Math.round(size * 0.4)),
            fontWeight: 700,
            color: 'var(--g-color-brand-700)',
            lineHeight: 1,
          }}
        >
          {initials}
        </Text>
      ) : (
        <IconUser size={Math.round(size * 0.55)} stroke={1.6} aria-hidden="true" style={{ color: 'var(--g-color-brand-600)' }} />
      )}
    </Box>
  );
}

export default Avatar;
