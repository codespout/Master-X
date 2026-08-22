import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, getToken, setToken, onUnauthorized } from '../api';
import { connect, disconnect } from '../ws';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const doLogout = useCallback(() => {
    setToken(null);
    setUser(null);
    disconnect();
  }, []);

  useEffect(() => {
    onUnauthorized(doLogout);
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api
      .get('/api/auth/me')
      .then((u) => {
        setUser(u);
        connect();
      })
      .catch(() => {
        setToken(null);
      })
      .finally(() => setLoading(false));
  }, [doLogout]);

  const login = useCallback(async (email, password) => {
    const data = await api.post('/api/auth/login', { email, password });
    setToken(data.token);
    setUser(data.user);
    connect();
    return data.user;
  }, []);

  const refresh = useCallback(async () => {
    try {
      const u = await api.get('/api/auth/me');
      setUser(u);
      return u;
    } catch {
      return null;
    }
  }, []);

  const logout = useCallback(() => {
    doLogout();
  }, [doLogout]);

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
