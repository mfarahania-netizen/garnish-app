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
      localStorage.removeItem('token');
      // redirect to the REAL auth/login entry (/onboarding); '/auth' is not a route (TRUTH-AND-SAFETY FIX 3).
      if (!window.location.pathname.startsWith('/admin')) {
        window.location.href = '/onboarding';
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;