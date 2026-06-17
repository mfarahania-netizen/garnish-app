import { useState, useRef, useCallback } from 'react';
import apiClient from '../../lib/apiClient';
import { useAnalytics } from '../../hooks/useAnalytics';

/**
 * useAssistant — the L3 AI surface. Every turn routes through the REAL POST /ai/chat orchestrator, which
 * is itself guarded server-side (prompt-injection / medical / vision → a safe, kind, non-medical reply).
 * The FE renders the guarded `reply` string with mandatory disclosure + hedge; it never fabricates an
 * answer, never claims certainty, and keeps the conversationId for thread continuity. 👍/👎 is recorded
 * as a real analytics event.
 */

const STARTERS = [
  { id: 'sub', text: 'جایگزینِ ماست چی بزنم؟' },
  { id: 'cook', text: 'با مرغ و سبزی چی بپزم؟' },
  // wellness reframe of the mockup's «برای لاغری چی بخورم؟» — no weight-loss/diet-as-medical framing
  { id: 'light', text: 'یه غذای سبک و مقوی چی بپزم؟' },
];

export function useAssistant() {
  const { trackEvent } = useAnalytics();
  const [messages, setMessages] = useState([]); // { role:'user'|'ai', text }
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState(false);
  const [feedback, setFeedback] = useState({}); // index → 'up'|'down'
  const convId = useRef(undefined);
  const lastPrompt = useRef('');

  const send = useCallback(async (raw) => {
    const prompt = String(raw || '').trim();
    if (!prompt || thinking) return;
    lastPrompt.current = prompt;
    setError(false);
    setMessages((m) => [...m, { role: 'user', text: prompt }]);
    setThinking(true);
    try {
      const data = await apiClient.post('/ai/chat', { prompt, conversationId: convId.current }).then((r) => r.data);
      if (data?.conversationId) convId.current = data.conversationId;
      const reply = (typeof data?.reply === 'string' && data.reply.trim()) ? data.reply.trim() : 'الان نتونستم جوابِ روشنی بدم — یه‌جور دیگه بپرس.';
      setMessages((m) => [...m, { role: 'ai', text: reply }]);
    } catch {
      setError(true);
    } finally {
      setThinking(false);
    }
  }, [thinking]);

  const retry = useCallback(() => { if (lastPrompt.current) { setError(false); send(lastPrompt.current); } }, [send]);
  const reset = useCallback(() => { setMessages([]); setThinking(false); setError(false); setFeedback({}); convId.current = undefined; }, []);
  const rate = useCallback((index, vote) => {
    setFeedback((f) => ({ ...f, [index]: vote }));
    try { trackEvent('ai_feedback', { vote }); } catch { /* non-blocking */ }
  }, [trackEvent]);

  return { messages, thinking, error, feedback, starters: STARTERS, send, retry, reset, rate, isEmpty: messages.length === 0 };
}
