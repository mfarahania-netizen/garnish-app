import apiClient from '../../../lib/apiClient';

/**
 * ارسال درخواست به سرور و دریافت پاسخ
 * @param {string} prompt - متن سوال کاربر
 * @returns {Promise<string>} پاسخ هوشمند
 */
export async function askAI(prompt) {
  try {
    const res = await apiClient.post('/ai/chat', { prompt });
    return res.data.reply;
  } catch (error) {
    console.error('خطا در ارتباط با دستیار:', error);
    return '❌ مشکلی در ارتباط با دستیار پیش اومد. دوباره تلاش کن.';
  }
}