import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { Button, Notice } from '../components/Ui';
import Icon from '../components/Icon';
import Brand from '../components/Brand';

export default function Login() {
  const { login, user, sessionNotice } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  if (user) return <Navigate to="/" replace />;
  async function submit(event) {
    event.preventDefault(); setError(''); setBusy(true);
    try { await login(email, password); navigate('/', { replace: true }); }
    catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  return <main className="login-shell">
    <div className="login-layout">
      <div className="login-visual" aria-hidden="true"><img src="/images/campus-illustration.png" alt="" /><div className="login-visual-shade" /></div>
      <section className="login-form-side"><div className="login-form-inner">
        <Brand />
        <div className="login-heading"><p className="page-eyebrow">Bienvenido a SIGA</p><h1>Ingresa a tu cuenta</h1><p>Escribe el correo y la contraseña de tu cuenta SIGA.</p></div>
        <Notice message={sessionNotice} kind="success" />
        <form onSubmit={submit} className="login-form">
          <div><label htmlFor="email" className="label">Correo electrónico</label><input id="email" className="input" type="email" autoComplete="username" placeholder="correo@ejemplo.com" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div><label htmlFor="password" className="label">Contraseña</label><div className="password-field"><input id="password" className="input" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /><button type="button" className="password-toggle" aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={showPassword} onClick={() => setShowPassword((current) => !current)}><Icon name={showPassword ? 'eyeOff' : 'eye'} size={18} /></button></div></div>
          <Notice message={error} /><Button type="submit" disabled={busy}>{busy ? 'Ingresando…' : 'Ingresar'}<Icon name="chevronRight" size={18} /></Button>
        </form>
        <p className="login-help">¿No puedes ingresar? Solicita ayuda a quien administra tu cuenta SIGA.</p>
      </div></section>
    </div>
  </main>;
}
