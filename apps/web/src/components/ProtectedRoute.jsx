// apps/web/src/components/ProtectedRoute.jsx
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Center, Loader } from '@mantine/core';

export function ProtectedRoute({ children }) {
  const { token, isLoading } = useAuth();
  
  // در حال بارگذاری وضعیت کاربر (مثلاً وقتی token داریم ولی user هنوز verify نشده)
  if (isLoading) {
    return (
      <Center style={{ height: '60vh' }}>
        <Loader color="orange" size="lg" />
      </Center>
    );
  }
  
  // اگر اصلاً token نداریم → برگشت به صفحه احراز هویت
  if (!token) return <Navigate to="/auth" replace />;
  
  // همه چیز اوکی است
  return children;
}

export function AdminRoute({ children }) {
  const { token, user, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <Center style={{ height: '60vh' }}>
        <Loader color="orange" size="lg" />
      </Center>
    );
  }
  
  if (!token) return <Navigate to="/auth" replace />;
  
  // اگر user هنوز null است (در حال fetch) یا isAdmin صریحاً false است → برگشت به خانه
  if (!user || user.isAdmin !== true) return <Navigate to="/" replace />;
  
  return children;
}