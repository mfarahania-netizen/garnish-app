import axios from 'axios';

/**
 * ارسال درخواست به سرور و دریافت پاسخ
 * @param {string} prompt - متن سوال کاربر
 * @param {string} token - توکن JWT کاربر برای شخصی‌سازی
 * @returns {Promise<string>} پاسخ هوشمند
 */
export async function askAI(prompt, token) {
  try {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await axios.post('http://localhost:3000/ai/chat', { prompt }, { headers });
    return res.data.reply;
  } catch (error) {
    console.error('خطا در ارتباط با دستیار:', error);
    return '❌ مشکلی در ارتباط با دستیار پیش اومد. دوباره تلاش کن.';
  }
}