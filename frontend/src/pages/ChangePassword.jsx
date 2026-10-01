import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { Button, Notice, PageHeader } from '../components/Ui';

export default function ChangePassword() {
  const { changePassword } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError('');
    if (newPassword.length < 12 || new TextEncoder().encode(newPassword).length > 72) {
      setError('La nueva contraseña debe tener al menos 12 caracteres y no superar 72 bytes UTF-8.');
      return;
    }
    if (newPassword !== confirmation) {
      setError('La confirmación no coincide con la nueva contraseña.');
      return;
    }
    setBusy(true);
    try {
      await changePassword(currentPassword, newPassword);
      navigate('/login', { replace: true });
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  return <div>
    <PageHeader eyebrow="Mi cuenta" title="Cambiar contraseña" subtitle="Después del cambio, tendrás que iniciar sesión nuevamente en todos tus dispositivos." />
    <section className="panel panel-pad max-w-xl">
      <form className="space-y-4" onSubmit={submit}>
        <div><label className="label" htmlFor="current-password">Contraseña actual</label><input className="input" id="current-password" type="password" autoComplete="current-password" required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></div>
        <div><label className="label" htmlFor="new-password">Nueva contraseña</label><input className="input" id="new-password" type="password" autoComplete="new-password" required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /><p className="form-help">Usa al menos 12 caracteres. El límite es de 72 bytes UTF-8.</p></div>
        <div><label className="label" htmlFor="confirm-password">Confirmar nueva contraseña</label><input className="input" id="confirm-password" type="password" autoComplete="new-password" required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></div>
        <Notice message={error} />
        <Button type="submit" disabled={busy}>{busy ? 'Actualizando…' : 'Actualizar contraseña'}</Button>
      </form>
    </section>
  </div>;
}
