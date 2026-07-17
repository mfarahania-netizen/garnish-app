// apps/web/src/features/ai-chat/services/aiEngine.js
import apiClient from '../../../lib/apiClient';

// ── E47-L4 grounded assistant capabilities (deterministic, server-grounded) ──
// Each returns the backend's structured payload (with `resultStatus` for graceful degradation).

export async function getSubstitutions(ingredient, { avoidAllergens, dislikes, limit } = {}) {
  const { data } = await apiClient.post('/ai/substitutions', { ingredient, avoidAllergens, dislikes, limit });
  return data;
}

export async function matchPantry(have, { limit } = {}) {
  const { data } = await apiClient.post('/ai/pantry-match', { have, limit });
  return data;
}

export async function getPairings({ ingredient, recipeId, limit } = {}) {
  const { data } = await apiClient.post('/ai/pairings', { ingredient, recipeId, limit });
  return data;
}

export async function getTechnique(recipeId, step) {
  const { data } = await apiClient.get(`/ai/recipes/${recipeId}/technique`, {
    params: step != null && step !== '' ? { step } : {},
  });
  return data;
}

export async function askAI(prompt) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // ۳۰ ثانیه

  try {
    const { data } = await apiClient.post('/ai/chat', { prompt }, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return data.reply;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError' || error.code === 'ERR_CANCELED') {
      throw new Error('⏳ پاسخ دستیار خیلی طول کشید. لطفاً دوباره تلاش کن.', { cause: error });
    }
    console.error('خطا در ارتباط با دستیار:', error);
    throw error;
  }
}
