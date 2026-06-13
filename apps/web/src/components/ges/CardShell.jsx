import { motion } from 'framer-motion';
import { pressResponse, withReducedMotion } from '../../lib/motion';

/**
 * CardShell — the base card container.
 *
 * radius-card + shadow-1 + surface bg + padding var(--g-space-4).
 * Props:
 *   children
 *   padded      — apply the standard inner padding (default true)
 *   interactive — render as a pressable surface (adds pressResponse + button role)
 *   onClick     — callback when interactive
 *   as          — override the rendered element tag (default 'div' / 'button' when interactive)
 *
 * Pure presentational; no business logic.
 */

export function CardShell({
  children,
  padded = true,
  interactive = false,
  onClick,
  as,
  ...rest
}) {
  const baseStyle = {
    background: 'var(--g-color-bg-surface)',
    color: 'var(--g-color-text-primary)',
    borderRadius: 'var(--g-radius-card)',
    boxShadow: 'var(--g-shadow-1)',
    padding: padded ? 'var(--g-space-4)' : 0,
    border: '1px solid var(--g-color-border-subtle)',
  };

  if (interactive) {
    const Tag = motion[as ?? 'button'] ?? motion.button;
    return (
      <Tag
        type={as ? undefined : 'button'}
        onClick={onClick}
        {...withReducedMotion(pressResponse)}
        style={{
          ...baseStyle,
          display: 'block',
          inlineSize: '100%',
          textAlign: 'start',
          cursor: 'pointer',
          minHeight: 44,
        }}
        {...rest}
      >
        {children}
      </Tag>
    );
  }

  const Tag = motion[as ?? 'div'] ?? motion.div;
  return (
    <Tag style={baseStyle} {...rest}>
      {children}
    </Tag>
  );
}

export default CardShell;
