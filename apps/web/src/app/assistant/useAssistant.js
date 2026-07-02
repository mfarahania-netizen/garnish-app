import { useState, useRef, useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import apiClient from '../../lib/apiClient';
import { useAnalytics } from '../../hooks/useAnalytics';
import { invalidateProfileDomain } from '../../lib/queryKeys';

/**
 * useAssistant — the L3 AI surface. Every turn routes through the REAL POST /ai/chat orchestrator, which
 * is itself guarded server-side (prompt-injection / medical / vision → a safe, kind, non-medical reply).
 * The FE renders the guarded `reply` string with mandatory disclosure + hedge; it never fabricates an
 * answer, never claims certainty. THREADS: the conversation is persisted server-side; on entry we resume the
 * saved thread's history (no more "cleared" chat) and expose list/open/new/rename/delete so the user can keep
 * separate threads (questions vs the weekly plan). The convId is kept in localStorage for re-entry continuity.
 */

const STARTERS = [
  { id: 'sub', text: 'جایگزینِ ماست چی بزنم؟' },
  { id: 'cook', text: 'با مرغ و سبزی چی بپزم؟' },
  // wellness reframe of the mockup's «برای لاغری چی بخورم؟» — no weight-loss/diet-as-medical framing
  { id: 'light', text: 'یه غذای سبک و مقوی چی بپزم؟' },
];

const CONVID_KEY = 'garnish_assistant_convid';
const readSavedConv = () => { try { return localStorage.getItem(CONVID_KEY) || undefined; } catch { return undefined; } };
const toMsg = (m) => ({ role: m.role === 'assistant' ? 'ai' : 'user', text: m.content });
const isAllergyRemovalPrompt = (value) => {
  const t = String(value || '')
    .replace(/\u200c/g, ' ')
    .replace(/[آأإ]/g, 'ا')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  return /(حذف|پاک|بردار|برداشته|درار|در بیار|لغو|remove|delete|clear)/.test(t) && /(حساس|الرژی|آلرژی|allerg)/.test(t);
};

export function useAssistant() {
  const { trackEvent } = useAnalytics();
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState([]); // { role:'user'|'ai', text }
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState(false);
  const [feedback, setFeedback] = useState({}); // index → 'up'|'down'
  const [added, setAdded] = useState({}); // message index → true once its allergens were added
  const [removed, setRemoved] = useState({});
  const [conversations, setConversations] = useState([]); // [{ id, title, preview, updatedAt }]
  const [convId, setConvId] = useState(readSavedConv);
  const [opener, setOpener] = useState(null); // { greeting, suggestion: { text, prompt } | null } — proactive entry
  const lastPrompt = useRef('');
  const inFlight = useRef(new Set()); // message indexes whose allergy write is in flight (sync double-tap guard)
  const sendSeq = useRef(0); // monotonic turn token — switching/clearing a thread bumps it, invalidating any in-flight reply

  const persistConv = useCallback((id) => {
    try { if (id) localStorage.setItem(CONVID_KEY, id); else localStorage.removeItem(CONVID_KEY); } catch { /* private mode */ }
    setConvId(id);
  }, []);

  // The assistant can DO things — build the week plan, add to the shopping list, save a favorite, set taste/allergy.
  // Those writes land server-side, but each target screen owns its OWN React-Query cache. Without this, the user
  // builds a plan in the chat, the 21 slots ARE saved, yet the برنامه‌غذایی screen keeps serving its stale cache and
  // looks unchanged — the founder's "it shows a table in chat but never goes into the meal-plan section" bug. Marking
  // these stale makes the change appear the instant the user opens that screen. Prefix keys match their sub-keys
  // (['plan'] → ['plan','current'], etc.).
  const refreshActionSurfaces = useCallback(() => {
    invalidateProfileDomain(queryClient);
    ['plan', 'shopping', 'favorites', 'home', 'profile'].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
  }, [queryClient]);

  const loadConversations = useCallback(async () => {
    try {
      const { data } = await apiClient.get('/ai/conversations');
      setConversations(Array.isArray(data?.conversations) ? data.conversations : []);
    } catch { /* non-blocking */ }
  }, []);

  // PROACTIVE opener — a greeting + one data-grounded suggestion for the empty state (the assistant "knows you" on entry).
  const loadOpener = useCallback(async () => {
    try { const { data } = await apiClient.get('/ai/opener'); setOpener(data && typeof data === 'object' ? data : null); } catch { /* non-blocking */ }
  }, []);

  // On entry: list the threads + load the proactive opener + RESUME the saved thread's history.
  useEffect(() => {
    loadConversations();
    loadOpener();
    const saved = readSavedConv();
    if (!saved) return;
    apiClient.get(`/ai/conversations/${saved}`)
      .then(({ data }) => {
        const msgs = (data?.messages || []).map(toMsg);
        if (msgs.length) setMessages(msgs);
        else persistConv(undefined); // stale/empty id → start clean
      })
      .catch(() => persistConv(undefined));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = useCallback(async (raw) => {
    const prompt = String(raw || '').trim();
    if (!prompt || thinking) return;
    const mySeq = ++sendSeq.current; // claim this turn; a thread switch/new-chat bumps the ref and invalidates us
    lastPrompt.current = prompt;
    setError(false);
    const wasNew = !convId;
    setMessages((m) => [...m, { role: 'user', text: prompt }]);
    setThinking(true);
    // Revived emitter: the rebuilt chat had stopped emitting ai_message_send → the admin "AI usage" sat on dead
    // data. Shape-only (NO raw prompt text; GDPR) — any topic enrichment is derived server-side.
    try { trackEvent('ai_message_send', {}); } catch { /* non-blocking */ }
    try {
      const data = await apiClient.post('/ai/chat', { prompt, conversationId: convId }).then((r) => r.data);
      // RACE GUARD: if the user switched/started a thread mid-flight, the backend already saved this reply to ITS
      // own thread — don't splice it into the now-current view (it'll load from history on return). Fixes the
      // founder's "switching chats stops/loses the previous one" + a reply landing in the wrong conversation.
      if (sendSeq.current !== mySeq) return;
      if (data?.conversationId && data.conversationId !== convId) persistConv(data.conversationId);
      let reply = (typeof data?.reply === 'string' && data.reply.trim()) ? data.reply.trim() : 'الان نتونستم جوابِ روشنی بدم — یه‌جور دیگه بپرس.';
      // §3 conversational-allergy: a confirm-then-write offer rides on the turn. The user must tap to write it
      // (decision D2); nothing is auto-saved. Only honor the recognized shape.
      const sa = data?.suggestedAction;
      let suggestedAction =
        sa && (sa.type === 'add_allergy' || sa.type === 'remove_allergy') && Array.isArray(sa.allergens) && sa.allergens.length ? sa : undefined;
      if (suggestedAction?.type === 'add_allergy' && isAllergyRemovalPrompt(prompt)) {
        suggestedAction = { ...suggestedAction, type: 'remove_allergy' };
        const names = suggestedAction.allergens.map((a) => a?.label).filter(Boolean).join('، ');
        reply = names
          ? `متوجه شدم. اگر تأیید کنی، ${names} را از آلرژی‌هایت حذف می‌کنم.`
          : 'متوجه شدم. اگر تأیید کنی، این مورد را از آلرژی‌هایت حذف می‌کنم.';
      }
      setMessages((m) => [...m, { role: 'ai', text: reply, suggestedAction }]);
      refreshActionSurfaces(); // the turn may have written a plan / shopping item / favorite — let those screens refetch
      if (wasNew) loadConversations(); // a fresh thread was just created → show it in the sidebar
    } catch {
      if (sendSeq.current === mySeq) setError(true);
    } finally {
      if (sendSeq.current === mySeq) setThinking(false);
    }
  }, [thinking, convId, persistConv, loadConversations, refreshActionSurfaces, trackEvent]);

  // §3 confirm: write the offered allergens to the declared set (POST /users/allergies). The deterministic hard
  // gate then filters them from every recipe. Optimistic-safe: we only mark "added" after the server confirms.
  const confirmAllergens = useCallback(async (index, allergens) => {
    const tokens = [...new Set((allergens || []).map((a) => a && a.token).filter(Boolean))];
    if (!tokens.length || added[index] || inFlight.current.has(index)) return;
    inFlight.current.add(index);
    try {
      const res = await apiClient.post('/users/allergies', { allergies: tokens });
      const addedTokens = Array.isArray(res?.data?.added) ? res.data.added : [];
      const missing = tokens.filter((t) => !addedTokens.includes(t));
      setAdded((s) => ({ ...s, [index]: true }));
      refreshActionSurfaces(); // a new allergy re-filters every recipe surface — refetch them
      const text = missing.length === 0
        ? 'انجام شد ✓ این مواد رو به آلرژی‌هات اضافه کردم و از این به بعد از غذاهات حذفشون می‌کنم.'
        : 'بعضی موارد رو نتونستم ذخیره کنم — لطفاً از پروفایلت دستی اضافه‌شون کن.';
      setMessages((m) => [...m, { role: 'ai', text }]);
    } catch {
      setMessages((m) => [...m, { role: 'ai', text: 'الان نتونستم ذخیره‌اش کنم — می‌تونی از پروفایلت دستی اضافه‌اش کنی.' }]);
    } finally {
      inFlight.current.delete(index);
    }
  }, [added, refreshActionSurfaces]);

  const removeAllergens = useCallback(async (index, allergens) => {
    const tokens = [...new Set((allergens || []).map((a) => a && a.token).filter(Boolean))];
    const key = `remove:${index}`;
    if (!tokens.length || removed[index] || inFlight.current.has(key)) return;
    inFlight.current.add(key);
    try {
      const res = await apiClient.delete('/users/allergies', { data: { allergies: tokens } });
      const removedTokens = Array.isArray(res?.data?.removed) ? res.data.removed : [];
      const missing = tokens.filter((t) => !removedTokens.includes(t));
      setRemoved((s) => ({ ...s, [index]: true }));
      refreshActionSurfaces();
      const text = missing.length === 0
        ? 'انجام شد ✓ این مورد از آلرژی‌هایت حذف شد. از این به بعد فیلتر ایمنی با لیست تازه اعمال می‌شود.'
        : 'بعضی موردها در آلرژی‌های ذخیره‌شده پیدا نشدند. لیست فعلی را از تنظیمات بررسی کن.';
      setMessages((m) => [...m, { role: 'ai', text }]);
    } catch {
      setMessages((m) => [...m, { role: 'ai', text: 'الان نتونستم حذفش کنم — از تنظیمات هم می‌تونی آلرژی‌ها رو تغییر بدی.' }]);
    } finally {
      inFlight.current.delete(key);
    }
  }, [removed, refreshActionSurfaces]);

  const retry = useCallback(() => { if (lastPrompt.current) { setError(false); send(lastPrompt.current); } }, [send]);
  const rate = useCallback((index, vote) => {
    setFeedback((f) => ({ ...f, [index]: vote }));
    try { trackEvent('ai_feedback', { vote }); } catch { /* non-blocking */ }
  }, [trackEvent]);

  // ── thread management ──
  const newChat = useCallback(() => {
    sendSeq.current += 1; // invalidate any in-flight reply so it can't land in the fresh thread
    setMessages([]); setThinking(false); setError(false); setFeedback({}); setAdded({}); setRemoved({}); inFlight.current.clear();
    persistConv(undefined);
    loadOpener(); // refresh the proactive suggestion for the fresh empty state
  }, [persistConv, loadOpener]);

  const openConversation = useCallback(async (id) => {
    if (!id || id === convId) return;
    sendSeq.current += 1; // invalidate any in-flight reply from the thread we're leaving (it's saved server-side)
    setError(false); setThinking(false); setFeedback({}); setAdded({}); setRemoved({}); inFlight.current.clear();
    try {
      const { data } = await apiClient.get(`/ai/conversations/${id}`);
      setMessages((data?.messages || []).map(toMsg));
      persistConv(id);
    } catch { /* non-blocking */ }
  }, [convId, persistConv]);

  const renameConversation = useCallback(async (id, title) => {
    const t = String(title || '').trim();
    if (!t) return;
    try { await apiClient.patch(`/ai/conversations/${id}`, { title: t }); await loadConversations(); } catch { /* non-blocking */ }
  }, [loadConversations]);

  const deleteConversation = useCallback(async (id) => {
    try {
      await apiClient.delete(`/ai/conversations/${id}`);
      if (id === convId) newChat();
      await loadConversations();
    } catch { /* non-blocking */ }
  }, [convId, newChat, loadConversations]);

  return {
    messages, thinking, error, feedback, added, removed, starters: STARTERS, isEmpty: messages.length === 0,
    conversations, convId, opener,
    send, retry, rate, confirmAllergens, removeAllergens,
    newChat, openConversation, renameConversation, deleteConversation, loadConversations,
  };
}
