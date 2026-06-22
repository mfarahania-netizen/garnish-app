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
  const [added, setAdded] = useState({}); // message index → true once its allergens were added
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
      // §3 conversational-allergy: a confirm-then-write offer rides on the turn. The user must tap to write it
      // (decision D2); nothing is auto-saved. Only honor the recognized shape.
      const sa = data?.suggestedAction;
      const suggestedAction =
        sa && sa.type === 'add_allergy' && Array.isArray(sa.allergens) && sa.allergens.length ? sa : undefined;
      setMessages((m) => [...m, { role: 'ai', text: reply, suggestedAction }]);
    } catch {
      setError(true);
    } finally {
      setThinking(false);
    }
  }, [thinking]);

  // §3 confirm: write the offered allergens to the declared set (POST /users/allergies). The deterministic hard
  // gate then filters them from every recipe. Optimistic-safe: we only mark "added" after the server confirms.
  const confirmAllergens = useCallback(async (index, allergens) => {
    const tokens = [...new Set((allergens || []).map((a) => a && a.token).filter(Boolean))];
    if (!tokens.length || added[index]) return;
    try {
      await apiClient.post('/users/allergies', { allergies: tokens });
      setAdded((s) => ({ ...s, [index]: true }));
      setMessages((m) => [...m, { role: 'ai', text: 'انجام شد ✓ این مواد رو به آلرژی‌هات اضافه کردم و از این به بعد از غذاهات حذفشون می‌کنم.' }]);
    } catch {
      setMessages((m) => [...m, { role: 'ai', text: 'الان نتونستم ذخیره‌اش کنم — می‌تونی از پروفایلت دستی اضافه‌اش کنی.' }]);
    }
  }, [added]);

  const retry = useCallback(() => { if (lastPrompt.current) { setError(false); send(lastPrompt.current); } }, [send]);
  const reset = useCallback(() => { setMessages([]); setThinking(false); setError(false); setFeedback({}); convId.current = undefined; }, []);
  const rate = useCallback((index, vote) => {
    setFeedback((f) => ({ ...f, [index]: vote }));
    try { trackEvent('ai_feedback', { vote }); } catch { /* non-blocking */ }
  }, [trackEvent]);

  return { messages, thinking, error, feedback, added, starters: STARTERS, send, retry, reset, rate, confirmAllergens, isEmpty: messages.length === 0 };
}
