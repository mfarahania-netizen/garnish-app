import { createContext, useContext, useState, useEffect } from 'react';
import apiClient from '../lib/apiClient'; // 👈 جایگزین axios

const AuthContext = createContext();
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token') || '');

  useEffect(() => {
    if (token) {
      apiClient.get('/users/me')
        .then(res => setUser(res.data))
        .catch(() => {
          localStorage.removeItem('token');
          setToken('');
          setUser(null);
        });
    }
  }, [token]);

  const register = async (phone, password, name) => {
    const res = await apiClient.post('/auth/register', { phone, password, name });
    const { token: newToken, user: newUser } = res.data;
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setUser(newUser);
    return newUser;
  };

  const login = async (phone, password) => {
    const res = await apiClient.post('/auth/login', { phone, password });
    const { token: newToken, user: newUser } = res.data;
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setUser(newUser);
    return newUser;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken('');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, register, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};