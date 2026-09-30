import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { Button, Notice } from '../components/Ui';
import Icon from '../components/Icon';

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (user) return <Navigate to="/" replace />;
  async function submit(event) {
    event.preventDefault(); setError(''); setBusy(true);
    try { await login(email, password); navigate('/', { replace: true }); }
    catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  return <main className="login-shell">
    <div className="panel login-card">
      <div className="login-brand"><span className="brand-mark"><Icon name="levels" size={20} /></span>SIGA</div>
      <h1>Ingresar al sistema</h1><p className="page-subtitle">Sistema de Gestión Académica</p>
      <form onSubmit={submit}>
        <div><label htmlFor="email" className="label">Correo electrónico</label><input id="email" className="input" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div><label htmlFor="password" className="label">Contraseña</label><input id="password" className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        <Notice message={error} /><Button type="submit" disabled={busy}>{busy ? 'Ingresando…' : 'Ingresar'}</Button>
      </form>
    </div>
  </main>;
}
