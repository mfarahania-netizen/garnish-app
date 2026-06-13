import { Box, Text, ActionIcon } from '@mantine/core';
import {
  IconPlayerPause,
  IconPlayerPlay,
  IconX,
  IconCheck,
  IconClock,
  IconAlertTriangle,
} from '@tabler/icons-react';

/**
 * TimerChip (PL row 18) — one parallel cooking timer, as a pill.
 *
 * Anatomy: optional state glyph + label + mm:ss + pause/resume + dismiss.
 * States: idle | running | paused | finished | missed.
 *   - finished announces via aria-live=polite (gentle, never a modal alarm wall).
 *   - missed uses a kind catch-up tone, not danger/shame styling.
 * Behavior: DISPLAY ONLY. There is no real interval/countdown here — the caller
 * supplies `seconds` + `state` and owns timing. Controls just emit callbacks.
 *
 * Pure presentational; no business logic, no timers, no network.
 *
 * Props:
 *   label     — what the timer is for (e.g. "Rice")
 *   seconds   — remaining seconds to display as mm:ss (clamped ≥0; default 0)
 *   state     — idle | running | paused | finished | missed (default 'idle')
 *   onPause   — toggle pause/resume; renders a labelled control when provided
 *   onDismiss — clear the timer; renders a labelled control when provided
 */

const formatTime = (totalSeconds) => {
  const safe = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const minutes = Math.floor(safe / 60);
  const secs = safe % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(secs).padStart(2, '0');
  return `${mm}:${ss}`;
};

const STATE_STYLES = {
  idle: {
    bg: 'var(--g-color-bg-surface)',
    fg: 'var(--g-color-text-secondary)',
    border: 'var(--g-color-border-subtle)',
    Icon: IconClock,
  },
  running: {
    bg: 'var(--g-color-bg-surface)',
    fg: 'var(--g-color-text-primary)',
    border: 'var(--g-color-border-strong)',
    Icon: IconClock,
  },
  paused: {
    bg: 'var(--g-color-state-info-bg)',
    fg: 'var(--g-color-state-info-fg)',
    border: 'var(--g-color-border-subtle)',
    Icon: IconPlayerPause,
  },
  finished: {
    bg: 'var(--g-color-state-success-bg)',
    fg: 'var(--g-color-state-success-fg)',
    border: 'var(--g-color-state-success-fg)',
    Icon: IconCheck,
  },
  missed: {
    bg: 'var(--g-color-state-warning-bg)',
    fg: 'var(--g-color-state-warning-fg)',
    border: 'var(--g-color-border-subtle)',
    Icon: IconAlertTriangle,
  },
};

export function TimerChip({
  label = 'Timer',
  seconds = 0,
  state = 'idle',
  onPause,
  onDismiss,
}) {
  const tone = STATE_STYLES[state] ?? STATE_STYLES.idle;
  const { Icon } = tone;

  const isRunning = state === 'running';
  const isFinished = state === 'finished';
  const isMissed = state === 'missed';
  const timeLabel = formatTime(seconds);

  // Finish/missed are the moments worth announcing; otherwise stay quiet.
  const liveRegion = isFinished || isMissed ? 'polite' : 'off';
  const statusText = isFinished
    ? `${label} timer done`
    : isMissed
      ? `${label} timer finished a moment ago`
      : `${label}, ${timeLabel} remaining`;

  return (
    <Box
      data-state={state}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--g-space-2)',
        paddingInlineStart: 'var(--g-space-3)',
        paddingInlineEnd: 'var(--g-space-1)',
        paddingBlock: 'var(--g-space-1)',
        minBlockSize: 44,
        maxInlineSize: '100%',
        borderRadius: 'var(--g-radius-chip)',
        background: tone.bg,
        color: tone.fg,
        border: `1px solid ${tone.border}`,
        boxShadow: 'var(--g-shadow-1)',
      }}
    >
      {/* State glyph — meaning carried by glyph + text + color (not color alone). */}
      <Icon
        size={16}
        stroke={1.5}
        aria-hidden="true"
        style={{ flex: '0 0 auto', color: tone.fg }}
      />

      {/* Visible label + time. Live status announced separately for clarity. */}
      <Text
        component="span"
        style={{
          minInlineSize: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontFamily: 'var(--g-font-text)',
          fontSize: 'var(--g-font-size-14)',
          fontWeight: 500,
          lineHeight: 'var(--g-leading-heading)',
          color: tone.fg,
        }}
      >
        {label}
      </Text>

      <Text
        component="span"
        style={{
          flex: '0 0 auto',
          fontFamily: 'var(--g-font-display)',
          fontSize: 'var(--g-font-size-14)',
          fontWeight: 600,
          lineHeight: 'var(--g-leading-heading)',
          fontVariantNumeric: 'tabular-nums',
          color: tone.fg,
        }}
      >
        {timeLabel}
      </Text>

      <Box
        role="status"
        aria-live={liveRegion}
        aria-atomic="true"
        className="g-sr-only"
      >
        {statusText}
      </Box>

      {/* Pause / resume — hidden once finished/missed (nothing left to run). */}
      {onPause && !isFinished && !isMissed && (
        <ActionIcon
          variant="subtle"
          onClick={() => onPause?.()}
          aria-label={isRunning ? `Pause ${label} timer` : `Resume ${label} timer`}
          style={{
            minInlineSize: 44,
            minBlockSize: 44,
            flex: '0 0 auto',
            color: tone.fg,
            background: 'transparent',
          }}
        >
          {isRunning ? (
            <IconPlayerPause size={18} stroke={1.5} aria-hidden="true" />
          ) : (
            <IconPlayerPlay size={18} stroke={1.5} aria-hidden="true" />
          )}
        </ActionIcon>
      )}

      {/* Dismiss / clear */}
      {onDismiss && (
        <ActionIcon
          variant="subtle"
          onClick={() => onDismiss?.()}
          aria-label={`Dismiss ${label} timer`}
          style={{
            minInlineSize: 44,
            minBlockSize: 44,
            flex: '0 0 auto',
            color: tone.fg,
            background: 'transparent',
          }}
        >
          <IconX size={18} stroke={1.5} aria-hidden="true" />
        </ActionIcon>
      )}
    </Box>
  );
}

export default TimerChip;
