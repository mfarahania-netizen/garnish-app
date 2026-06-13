import { motion } from 'framer-motion';
import { Box } from '@mantine/core';
import { pressResponse, withReducedMotion } from '../../lib/motion';

/**
 * Button — the single action primitive (PL row 1).
 *
 * Variants: primary (saffron) / secondary (surface + border) / ghost / destructive (danger).
 * States: default / hover / active (pressResponse) / focus-visible (base.css ring) /
 *         disabled / loading (spinner-in-place, label kept, aria-busy).
 *
 * Pure presentational: behavior via onClick. No business logic / no network.
 */

const VARIANT_STYLES = {
  primary: {
    background: 'var(--g-color-brand-600)',
    color: 'var(--g-color-text-inverse)',
    border: '1px solid transparent',
    boxShadow: 'var(--g-shadow-1)',
  },
  secondary: {
    background: 'var(--g-color-bg-surface)',
    color: 'var(--g-color-text-primary)',
    border: '1px solid var(--g-color-border-strong)',
    boxShadow: 'var(--g-shadow-1)',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--g-color-text-primary)',
    border: '1px solid transparent',
    boxShadow: 'none',
  },
  destructive: {
    background: 'var(--g-color-state-danger-bg)',
    color: 'var(--g-color-state-danger-fg)',
    border: '1px solid var(--g-color-state-danger-fg)',
    boxShadow: 'none',
  },
};

function Spinner() {
  // Reuse the approved skeleton shimmer surface as a calm in-place busy
  // indicator: a circular g-skeleton dot. No ad-hoc @keyframes.
  return (
    <Box
      aria-hidden="true"
      className="g-skeleton"
      style={{
        width: 18,
        height: 18,
        borderRadius: 'var(--g-radius-chip)',
        flex: '0 0 auto',
      }}
    />
  );
}

export function Button({
  variant = 'primary',
  loading = false,
  disabled = false,
  leftIcon = null,
  children,
  onClick,
  type = 'button',
  fullWidth = false,
  ...rest
}) {
  const variantStyle = VARIANT_STYLES[variant] ?? VARIANT_STYLES.primary;
  const isDisabled = disabled || loading;

  const handleClick = (event) => {
    // loading blocks re-tap; disabled never fires.
    if (isDisabled) return;
    onClick?.(event);
  };

  return (
    <motion.button
      type={type}
      onClick={handleClick}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      data-variant={variant}
      {...withReducedMotion(pressResponse)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--g-space-2)',
        minHeight: 44,
        minWidth: 44,
        width: fullWidth ? '100%' : 'auto',
        paddingInline: 'var(--g-space-5)',
        paddingBlock: 'var(--g-space-2)',
        borderRadius: 'var(--g-radius-input)',
        fontFamily: 'var(--g-font-text)',
        fontSize: 'var(--g-font-size-16)',
        fontWeight: 600,
        lineHeight: 'var(--g-leading-heading)',
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        opacity: isDisabled && !loading ? 0.5 : 1,
        textAlign: 'center',
        ...variantStyle,
      }}
      {...rest}
    >
      {loading ? (
        <Spinner />
      ) : (
        leftIcon && (
          <span
            aria-hidden="true"
            style={{ display: 'inline-flex', flex: '0 0 auto' }}
          >
            {leftIcon}
          </span>
        )
      )}
      {/* label is kept during loading (spinner-in-place contract) */}
      <span>{children}</span>
    </motion.button>
  );
}

export default Button;
