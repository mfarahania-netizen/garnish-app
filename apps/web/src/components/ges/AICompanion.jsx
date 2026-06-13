import { useState } from 'react';
import { Box, Stack, Group, Text, UnstyledButton, ActionIcon } from '@mantine/core';
import {
  IconSparkles,
  IconSend,
  IconThumbUp,
  IconThumbDown,
  IconShield,
  IconAlertCircle,
  IconRefresh,
} from '@tabler/icons-react';
import { motion } from 'framer-motion';
import {
  riseIn,
  cardShift,
  pressResponse,
  withReducedMotion,
} from '../../lib/motion';

/**
 * AICompanion (PL row 7) — open multi-turn food chat (presentational shell).
 *
 * Anatomy: disclosure header ("AI" glyph + label) + message history list
 * (user / assistant bubbles) + composer. Empty state shows starter prompts.
 * Each assistant answer carries 👍/👎 feedback controls.
 *
 * Presentational ONLY — no real AI, no network, no memory claims. Streaming /
 * refusal / nutrition text must already be guard-filtered + badged by the
 * caller. Kind refusals with alternatives; never medical advice; never fake
 * certainty; always shows the "AI" disclosure.
 *
 * States (via `state` prop): empty (starter prompts) | loading | streaming |
 * answer | guard-refusal | error | offline.
 *
 * A11y: history region is aria-live="polite" so new messages announce; the
 * composer is a real form; feedback buttons are labelled icon controls with
 * 44px targets.
 *
 * Props:
 *  - messages: [{ id, role: 'user' | 'assistant', content, refusal?, alternatives?, feedback? }]
 *  - onSend: (text) => void
 *  - onFeedback: (messageId, score: 'up' | 'down') => void
 *  - state: 'empty' | 'loading' | 'streaming' | 'answer' | 'guard-refusal' | 'error' | 'offline'
 *  - onRetry: retry callback for the error state
 *  - starterPrompts: string[] shown in the empty state
 *  - placeholder: composer placeholder copy
 *  - aiLabel: disclosure label text (default "AI")
 */
export function AICompanion({
  messages = [],
  onSend,
  onFeedback,
  state = messages.length === 0 ? 'empty' : 'answer',
  onRetry,
  starterPrompts = [
    'What can I make with what I have?',
    'Suggest a quick weeknight dinner',
    'Help me use up leftover rice',
  ],
  placeholder = 'Ask about food, recipes, or your week',
  aiLabel = 'AI',
}) {
  const [draft, setDraft] = useState('');
  const isOffline = state === 'offline';
  const isBusy = state === 'loading' || state === 'streaming';

  const submit = (text) => {
    const value = (text ?? draft).trim();
    if (!value || isOffline) return;
    onSend?.(value);
    setDraft('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    submit();
  };

  const renderBubble = (msg) => {
    const isUser = msg.role === 'user';
    const isRefusal = Boolean(msg.refusal);

    return (
      <motion.div
        key={msg.id}
        variants={withReducedMotion(cardShift).item ?? withReducedMotion(riseIn)}
        style={{
          alignSelf: isUser ? 'flex-end' : 'flex-start',
          maxInlineSize: '86%',
        }}
      >
        <Box
          style={{
            paddingBlock: 'var(--g-space-2)',
            paddingInline: 'var(--g-space-3)',
            borderRadius: 'var(--g-radius-card)',
            background: isUser
              ? 'var(--g-color-brand-50)'
              : 'var(--g-color-ai-surface)',
            border: isUser
              ? '1px solid var(--g-color-border-subtle)'
              : 'var(--g-border-ai)',
            boxShadow: 'var(--g-shadow-1)',
          }}
        >
          {isRefusal ? (
            <Stack style={{ gap: 'var(--g-space-2)' }}>
              <Group style={{ gap: 'var(--g-space-2)' }} wrap="nowrap" align="flex-start">
                <IconShield
                  size={18}
                  stroke={1.5}
                  aria-hidden="true"
                  style={{ color: 'var(--g-color-text-secondary)', flexShrink: 0 }}
                />
                <Text
                  style={{
                    fontSize: 'var(--g-font-size-14)',
                    lineHeight: 'var(--g-leading-body)',
                    color: 'var(--g-color-text-secondary)',
                    textAlign: 'start',
                  }}
                >
                  {msg.content}
                </Text>
              </Group>
              {Array.isArray(msg.alternatives) && msg.alternatives.length > 0 && (
                <Stack
                  component="ul"
                  style={{
                    gap: 'var(--g-space-1)',
                    margin: 0,
                    paddingInlineStart: 'var(--g-space-5)',
                  }}
                >
                  {msg.alternatives.map((alt, i) => (
                    <Text
                      key={i}
                      component="li"
                      style={{
                        fontSize: 'var(--g-font-size-14)',
                        lineHeight: 'var(--g-leading-body)',
                        color: 'var(--g-color-text-primary)',
                        textAlign: 'start',
                      }}
                    >
                      {alt}
                    </Text>
                  ))}
                </Stack>
              )}
            </Stack>
          ) : (
            <Text
              style={{
                fontSize: 'var(--g-font-size-16)',
                lineHeight: 'var(--g-leading-body)',
                color: 'var(--g-color-text-primary)',
                textAlign: 'start',
                whiteSpace: 'pre-wrap',
              }}
            >
              {msg.content}
            </Text>
          )}
        </Box>

        {/* Per-answer feedback — assistant messages only */}
        {!isUser && (
          <Group style={{ gap: 'var(--g-space-1)', marginBlockStart: 'var(--g-space-1)' }} wrap="nowrap">
            <ActionIcon
              component={motion.button}
              type="button"
              onClick={() => onFeedback?.(msg.id, 'up')}
              whileTap={pressResponse.whileTap}
              aria-label="Helpful answer"
              aria-pressed={msg.feedback === 'up'}
              variant="transparent"
              style={{
                minHeight: 44,
                minWidth: 44,
                color:
                  msg.feedback === 'up'
                    ? 'var(--g-color-state-success-fg)'
                    : 'var(--g-color-text-muted)',
              }}
            >
              <IconThumbUp size={18} stroke={1.5} aria-hidden="true" />
            </ActionIcon>
            <ActionIcon
              component={motion.button}
              type="button"
              onClick={() => onFeedback?.(msg.id, 'down')}
              whileTap={pressResponse.whileTap}
              aria-label="Unhelpful answer"
              aria-pressed={msg.feedback === 'down'}
              variant="transparent"
              style={{
                minHeight: 44,
                minWidth: 44,
                color:
                  msg.feedback === 'down'
                    ? 'var(--g-color-state-warning-fg)'
                    : 'var(--g-color-text-muted)',
              }}
            >
              <IconThumbDown size={18} stroke={1.5} aria-hidden="true" />
            </ActionIcon>
          </Group>
        )}
      </motion.div>
    );
  };

  const renderHistory = () => {
    // Empty: starter prompts (one clear way to begin).
    if (state === 'empty' && messages.length === 0) {
      return (
        <Stack
          role="status"
          style={{ gap: 'var(--g-space-3)', paddingBlock: 'var(--g-space-6)' }}
        >
          <Text
            style={{
              fontFamily: 'var(--g-font-display)',
              fontSize: 'var(--g-font-size-18)',
              color: 'var(--g-color-text-primary)',
              textAlign: 'start',
            }}
          >
            How can I help with food today?
          </Text>
          <Stack style={{ gap: 'var(--g-space-2)' }}>
            {starterPrompts.map((prompt, i) => (
              <UnstyledButton
                key={i}
                component={motion.button}
                type="button"
                onClick={() => submit(prompt)}
                whileTap={pressResponse.whileTap}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  minHeight: 44,
                  inlineSize: '100%',
                  paddingInline: 'var(--g-space-4)',
                  paddingBlock: 'var(--g-space-2)',
                  borderRadius: 'var(--g-radius-input)',
                  background: 'var(--g-color-ai-surface)',
                  border: 'var(--g-border-ai)',
                  color: 'var(--g-color-text-primary)',
                  fontSize: 'var(--g-font-size-14)',
                  textAlign: 'start',
                }}
              >
                {prompt}
              </UnstyledButton>
            ))}
          </Stack>
        </Stack>
      );
    }

    return (
      <motion.div
        variants={withReducedMotion(cardShift).container ?? undefined}
        initial="initial"
        animate="animate"
      >
        <Stack style={{ gap: 'var(--g-space-3)' }}>
          {messages.map(renderBubble)}

          {/* Streaming / loading hint — calm skeleton, never typing theatre */}
          {isBusy && (
            <Box
              role="status"
              aria-busy="true"
              style={{ alignSelf: 'flex-start', maxInlineSize: '86%', inlineSize: '60%' }}
            >
              <span className="g-sr-only">Thinking</span>
              <Box
                className="g-skeleton"
                aria-hidden="true"
                style={{ blockSize: 'var(--g-space-5)', borderRadius: 'var(--g-radius-card)' }}
              />
            </Box>
          )}

          {/* Error — calm inline notice with retry; nothing lost */}
          {state === 'error' && (
            <Box
              role="alert"
              aria-live="assertive"
              style={{
                inlineSize: '100%',
                background: 'var(--g-color-state-info-bg)',
                borderRadius: 'var(--g-radius-input)',
                padding: 'var(--g-space-3)',
              }}
            >
              <Group style={{ gap: 'var(--g-space-2)' }} wrap="nowrap" justify="space-between">
                <Group style={{ gap: 'var(--g-space-2)' }} wrap="nowrap">
                  <IconAlertCircle
                    size={18}
                    stroke={1.5}
                    aria-hidden="true"
                    style={{ color: 'var(--g-color-text-secondary)', flexShrink: 0 }}
                  />
                  <Text
                    style={{
                      fontSize: 'var(--g-font-size-14)',
                      color: 'var(--g-color-text-secondary)',
                      textAlign: 'start',
                    }}
                  >
                    Couldn’t get an answer. Your messages are still here.
                  </Text>
                </Group>
                {onRetry && (
                  <UnstyledButton
                    component={motion.button}
                    type="button"
                    onClick={onRetry}
                    whileTap={pressResponse.whileTap}
                    aria-label="Try again"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 'var(--g-space-1)',
                      minHeight: 44,
                      minWidth: 44,
                      paddingInline: 'var(--g-space-3)',
                      color: 'var(--g-color-food-saffron)',
                      fontFamily: 'var(--g-font-display)',
                      fontSize: 'var(--g-font-size-14)',
                      flexShrink: 0,
                    }}
                  >
                    <IconRefresh size={16} stroke={1.5} aria-hidden="true" />
                    Try again
                  </UnstyledButton>
                )}
              </Group>
            </Box>
          )}
        </Stack>
      </motion.div>
    );
  };

  return (
    <Box
      style={{
        display: 'flex',
        flexDirection: 'column',
        blockSize: '100%',
        inlineSize: '100%',
        background: 'var(--g-color-bg-canvas)',
      }}
    >
      {/* Disclosure header — mandatory AI glyph + label */}
      <Group
        wrap="nowrap"
        style={{
          gap: 'var(--g-space-2)',
          paddingInline: 'var(--g-space-4)',
          paddingBlock: 'var(--g-space-3)',
          background: 'var(--g-color-ai-surface)',
          borderBlockEnd: 'var(--g-border-ai)',
        }}
      >
        <IconSparkles
          size="var(--g-ai-glyph-size)"
          stroke={1.5}
          aria-hidden="true"
          style={{
            inlineSize: 'var(--g-ai-glyph-size)',
            blockSize: 'var(--g-ai-glyph-size)',
            color: 'var(--g-color-food-saffron)',
            flexShrink: 0,
          }}
        />
        <Text
          style={{
            fontFamily: 'var(--g-font-display)',
            fontSize: 'var(--g-font-size-12)',
            fontWeight: 600,
            letterSpacing: '0.04em',
            color: 'var(--g-color-text-secondary)',
          }}
        >
          {aiLabel}
        </Text>
        <Text
          component="h2"
          style={{
            fontFamily: 'var(--g-font-display)',
            fontSize: 'var(--g-font-size-16)',
            fontWeight: 600,
            color: 'var(--g-color-text-primary)',
            textAlign: 'start',
          }}
        >
          Food companion
        </Text>
      </Group>

      {/* History — aria-live so new messages announce politely */}
      <Box
        aria-live="polite"
        aria-busy={isBusy || undefined}
        style={{
          flex: 1,
          overflowY: 'auto',
          paddingInline: 'var(--g-space-4)',
          paddingBlock: 'var(--g-space-4)',
        }}
      >
        {renderHistory()}
      </Box>

      {/* Composer */}
      <Box
        component="form"
        onSubmit={handleSubmit}
        style={{
          paddingInline: 'var(--g-space-4)',
          paddingBlockStart: 'var(--g-space-3)',
          paddingBlockEnd: 'calc(var(--g-space-3) + env(safe-area-inset-bottom))',
          borderBlockStart: '1px solid var(--g-color-border-subtle)',
          background: 'var(--g-color-bg-surface)',
        }}
      >
        {isOffline && (
          <Text
            style={{
              fontSize: 'var(--g-font-size-12)',
              color: 'var(--g-color-text-muted)',
              marginBlockEnd: 'var(--g-space-2)',
              textAlign: 'start',
            }}
          >
            You’re offline. Your past chat is still here — sending resumes when you reconnect.
          </Text>
        )}
        <Group wrap="nowrap" style={{ gap: 'var(--g-space-2)' }} align="flex-end">
          <Box
            component="textarea"
            value={draft}
            onChange={(e) => setDraft(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={1}
            disabled={isOffline}
            placeholder={placeholder}
            aria-label="Message"
            style={{
              flex: 1,
              resize: 'none',
              minHeight: 44,
              maxHeight: 120,
              paddingInline: 'var(--g-space-4)',
              paddingBlock: 'var(--g-space-3)',
              borderRadius: 'var(--g-radius-input)',
              border: '1px solid var(--g-color-border-strong)',
              background: 'var(--g-color-bg-surface)',
              color: 'var(--g-color-text-primary)',
              fontFamily: 'var(--g-font-text)',
              fontSize: 'var(--g-font-size-16)',
              lineHeight: 'var(--g-leading-body)',
              textAlign: 'start',
            }}
          />
          <ActionIcon
            component={motion.button}
            type="submit"
            whileTap={pressResponse.whileTap}
            aria-label="Send message"
            disabled={isOffline || !draft.trim()}
            variant="transparent"
            style={{
              minHeight: 44,
              minWidth: 44,
              borderRadius: 'var(--g-radius-input)',
              background: 'var(--g-color-food-saffron)',
              color: 'var(--g-color-text-inverse)',
              boxShadow: 'var(--g-shadow-1)',
              opacity: isOffline || !draft.trim() ? 0.5 : 1,
              flexShrink: 0,
            }}
          >
            <IconSend size={20} stroke={1.5} aria-hidden="true" />
          </ActionIcon>
        </Group>
      </Box>
    </Box>
  );
}

export default AICompanion;
