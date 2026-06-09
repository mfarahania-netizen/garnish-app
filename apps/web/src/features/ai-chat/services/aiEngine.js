// apps/web/src/features/ai-chat/services/aiEngine.js
import apiClient from '../../../lib/apiClient';

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
      throw new Error('⏳ پاسخ دستیار خیلی طول کشید. لطفاً دوباره تلاش کن.');
    }
    console.error('خطا در ارتباط با دستیار:', error);
    throw error;
  }
}