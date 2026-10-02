import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { Button, Notice, PageHeader } from '../components/Ui';

export default function Profile() {
  const { user, updateProfile } = useAuth();
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function submit(event) {
    event.preventDefault();
    setError('');
    setSuccess('');
    const fields = { firstName: firstName.trim(), lastName: lastName.trim() };
    if (!fields.firstName || !fields.lastName || fields.firstName.length > 100 || fields.lastName.length > 100) {
      setError('Escribe nombres y apellidos de hasta 100 caracteres.');
      return;
    }
    setBusy(true);
    try {
      const updated = await updateProfile(fields);
      setFirstName(updated.firstName);
      setLastName(updated.lastName);
      setSuccess('Tu nombre de perfil se actualizó.');
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  return <div>
    <PageHeader eyebrow="Mi cuenta" title="Mi perfil" subtitle="Actualiza el nombre que aparece en tu cuenta. Tus datos académicos se gestionan por separado." />
    <section className="panel panel-pad max-w-xl">
      <form className="space-y-4" onSubmit={submit}>
        <div><label className="label" htmlFor="profile-first-name">Nombres</label><input className="input" id="profile-first-name" autoComplete="given-name" maxLength={100} required value={firstName} onChange={(event) => setFirstName(event.target.value)} /></div>
        <div><label className="label" htmlFor="profile-last-name">Apellidos</label><input className="input" id="profile-last-name" autoComplete="family-name" maxLength={100} required value={lastName} onChange={(event) => setLastName(event.target.value)} /></div>
        <Notice message={error} />
        <Notice message={success} kind="success" />
        <Button type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Guardar nombre'}</Button>
      </form>
    </section>
  </div>;
}
