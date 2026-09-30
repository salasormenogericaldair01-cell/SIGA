import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createApi } from '../services/api';

const AuthContext = createContext(null);
const storageKey = 'siga_token';

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => sessionStorage.getItem(storageKey));
  const tokenRef = useRef(token);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(token));
  function clearSession() {
    tokenRef.current = null;
    sessionStorage.removeItem(storageKey);
    setToken(null);
    setUser(null);
    setLoading(false);
  }
  const api = useMemo(() => createApi(() => tokenRef.current, clearSession), []);

  useEffect(() => {
    if (!token) return;
    let live = true;
    api('/auth/me').then(({ user: current }) => {
      if (live) setUser(current);
    }).catch((error) => {
      if (live && error.status !== 401) setUser(null);
    }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, []);

  async function login(email, password) {
    const result = await api('/auth/login', { method: 'POST', body: { email, password } });
    tokenRef.current = result.token;
    sessionStorage.setItem(storageKey, result.token);
    setToken(result.token);
    try {
      const current = await api('/auth/me');
      setUser(current.user);
      return current.user;
    } catch (error) {
      if (error.status === 401) clearSession();
      throw error;
    }
  }

  async function retrySession() {
    if (!tokenRef.current) return;
    setLoading(true);
    try {
      const current = await api('/auth/me');
      setUser(current.user);
    } finally { setLoading(false); }
  }

  return <AuthContext.Provider value={{ token, user, loading, login, logout: clearSession, retrySession, api }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
