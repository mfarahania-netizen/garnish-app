// apps/web/src/lib/apiClient.js
import axios from 'axios';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  headers: {
    'Content-Type': 'application/json',
  },
});

// درخواست interceptor – توکن را از localStorage می‌خواند و به هدر اضافه می‌کند
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 🆕 پاسخ interceptor – مدیریت 401 Unauthorized
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const requestUrl = String(error.config?.url || '');
      const path = window.location?.pathname || '';
      const isAuthAttempt = /\/auth\/(login|register|guest)$/.test(requestUrl);
      const isPublicAuthRoute = path === '/login' || path === '/onboarding' || path === '/terms' || path === '/privacy';
      if (!isAuthAttempt) localStorage.removeItem('token');
      if (!isAuthAttempt && !isPublicAuthRoute && !path.startsWith('/admin')) window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default apiClient;
