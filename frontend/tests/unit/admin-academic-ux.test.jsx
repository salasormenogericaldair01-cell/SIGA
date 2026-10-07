import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import App from '../../src/App';
import { sectionLabel } from '../../src/utils/format';

const admin = { id: '00000000-0000-4000-8000-000000000001', firstName: 'Administradora', lastName: 'General', role: 'ADMIN' };
const secretary = { ...admin, role: 'SECRETARIA' };
const levelPrimary = { id: '00000000-0000-4000-8000-000000000011', code: 'PRIMARIA', name: 'Primaria' };
const levelSecondary = { id: '00000000-0000-4000-8000-000000000012', code: 'SECUNDARIA', name: 'Secundaria' };
const response = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const open = (route, user = admin, handler) => {
  sessionStorage.setItem('siga_token', 'token-simulado');
  window.history.replaceState({}, '', route);
  global.fetch = vi.fn((url, options = {}) => {
    const parsed = new URL(url);
    if (parsed.pathname === '/api/auth/me') return Promise.resolve(response(200, { user }));
    return Promise.resolve(handler(parsed, options));
  });
  render(<App />);
};

it('Ver y Editar cuenta usan rutas reales; guardar elimina un error anterior y preserva el estado', async () => {
  const account = { id: '00000000-0000-4000-8000-000000000002', firstName: 'Elena', lastName: 'Rojas', email: 'elena@siga.local', role: 'DOCENTE', isActive: true };
  let current = account;
  open('/users', admin, (url, options) => {
    if (url.pathname === '/api/users' && options.method === 'GET') return response(200, { users: [current], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } });
    if (url.pathname === `/api/users/${account.id}` && options.method === 'GET') return response(200, { user: current });
    if (url.pathname === `/api/users/${account.id}` && options.method === 'PATCH') {
      current = { ...current, ...JSON.parse(options.body) };
      return response(200, { user: current });
    }
    if (url.pathname === `/api/users/${account.id}/status`) return response(200, { user: current });
    throw new Error(`Ruta inesperada: ${url.pathname}`);
  });
  fireEvent.click(await screen.findByRole('button', { name: 'Ver' }));
  expect(await screen.findByRole('heading', { name: 'Detalle' })).toBeInTheDocument();
  expect(screen.queryByText('Ruta no encontrada')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Editar cuenta' }));
  expect(screen.getByRole('heading', { name: 'Editar datos de cuenta' })).toBeInTheDocument();
  expect(screen.queryByLabelText('Contraseña')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Nombres'), { target: { value: 'Lucía' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Cambios guardados');
  expect(screen.queryByText('Ruta no encontrada')).not.toBeInTheDocument();
  expect(current).toMatchObject({ firstName: 'Lucía', role: 'DOCENTE', isActive: true });
  fireEvent.click(screen.getByRole('button', { name: 'Cambiar estado' }));
  expect(screen.getByRole('heading', { name: 'Cambiar estado de cuenta' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
  expect(screen.queryByRole('heading', { name: 'Cambiar estado de cuenta' })).not.toBeInTheDocument();
});

it('Usuarios envía búsqueda, rol y estado junto con la página, y Limpiar restablece la consulta', async () => {
  open('/users', admin, (url) => {
    if (url.pathname !== '/api/users') return response(404, {});
    const page = Number(url.searchParams.get('page'));
    const filtered = url.searchParams.get('search') === 'Elena';
    const users = filtered ? Array.from({ length: page === 1 ? 20 : 1 }, (_, i) => ({ id: `account-${page}-${i}`, firstName: 'Elena', lastName: String(i), email: `cuenta${i}@siga.local`, role: 'DOCENTE', isActive: false })) : [];
    return response(200, { users, pagination: { page, limit: 20, total: filtered ? 21 : 0, totalPages: filtered ? 2 : 0 } });
  });
  await screen.findByRole('heading', { name: 'Usuarios' });
  fireEvent.change(screen.getByLabelText('Buscar por nombre o correo'), { target: { value: 'Elena' } });
  fireEvent.change(screen.getByLabelText('Rol'), { target: { value: 'DOCENTE' } });
  fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'false' } });
  fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }));
  await waitFor(() => expect(global.fetch.mock.calls.some(([url]) => {
    const parsed = new URL(url);
    return parsed.pathname === '/api/users' && parsed.searchParams.get('search') === 'Elena' && parsed.searchParams.get('role') === 'DOCENTE' && parsed.searchParams.get('isActive') === 'false' && parsed.searchParams.get('page') === '1';
  })).toBe(true));
  fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
  await waitFor(() => expect(global.fetch.mock.calls.some(([url]) => {
    const parsed = new URL(url);
    return parsed.pathname === '/api/users' && parsed.searchParams.get('page') === '2' && parsed.searchParams.get('role') === 'DOCENTE' && parsed.searchParams.get('isActive') === 'false';
  })).toBe(true));
  fireEvent.click(screen.getByRole('button', { name: 'Limpiar' }));
  await waitFor(() => expect(new URL(global.fetch.mock.calls.at(-1)[0]).searchParams.has('role')).toBe(false));
  expect(new URL(global.fetch.mock.calls.at(-1)[0]).searchParams.get('page')).toBe('1');
});

it('Grados descarta filas antiguas al elegir Secundaria y aplica educationLevelId', async () => {
  const primary = { id: '00000000-0000-4000-8000-000000000021', educationLevelId: levelPrimary.id, name: 'Primero de primaria', order: 1, isActive: true };
  const secondary = { id: '00000000-0000-4000-8000-000000000022', educationLevelId: levelSecondary.id, name: 'Primero de secundaria', order: 1, isActive: true };
  let resolveFiltered;
  open('/grades', admin, (url) => {
    if (url.pathname === '/api/education-levels') return response(200, { items: [levelPrimary, levelSecondary] });
    if (url.pathname === '/api/grades') return url.searchParams.get('educationLevelId') === levelSecondary.id
      ? new Promise((resolve) => { resolveFiltered = () => resolve(response(200, { items: [secondary] })); })
      : response(200, { items: [primary, secondary] });
    return response(404, {});
  });
  expect(await screen.findByText('Primero de primaria')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Nivel'), { target: { value: levelSecondary.id } });
  expect(screen.queryByText('Primero de primaria')).not.toBeInTheDocument();
  await waitFor(() => expect(resolveFiltered).toBeTypeOf('function'));
  resolveFiltered();
  expect(await screen.findByText('Primero de secundaria')).toBeInTheDocument();
  expect(screen.queryByText('Primero de primaria')).not.toBeInTheDocument();
});

it('la respuesta tardía de Secundaria no reemplaza la selección posterior de Primaria', async () => {
  const primary = { id: '00000000-0000-4000-8000-000000000023', educationLevelId: levelPrimary.id, name: 'Primero de primaria', order: 1, isActive: true };
  const secondary = { id: '00000000-0000-4000-8000-000000000024', educationLevelId: levelSecondary.id, name: 'Primero de secundaria', order: 1, isActive: true };
  let releaseOldRequest;
  open('/grades', admin, (url) => {
    if (url.pathname === '/api/education-levels') return response(200, { items: [levelPrimary, levelSecondary] });
    if (url.pathname !== '/api/grades') return response(404, {});
    if (url.searchParams.get('educationLevelId') === levelSecondary.id) return new Promise((resolve) => { releaseOldRequest = () => resolve(response(200, { items: [secondary] })); });
    return response(200, { items: [primary] });
  });
  expect(await screen.findByText('Primero de primaria')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Nivel'), { target: { value: levelSecondary.id } });
  await waitFor(() => expect(releaseOldRequest).toBeTypeOf('function'));
  await waitFor(() => expect(screen.getByLabelText('Nivel')).not.toBeDisabled());
  fireEvent.change(screen.getByLabelText('Nivel'), { target: { value: levelPrimary.id } });
  expect(await screen.findByText('Primero de primaria')).toBeInTheDocument();
  releaseOldRequest();
  await waitFor(() => expect(screen.queryByText('Primero de secundaria')).not.toBeInTheDocument());
});

it('Periodos permite consultar Históricos y Limpiar vuelve a Todos', async () => {
  const current = { id: 'period-current', name: '2026', isActive: true };
  const historic = { id: 'period-old', name: '2025', isActive: false };
  open('/academic-periods', admin, (url) => url.pathname === '/api/academic-periods'
    ? response(200, { items: url.searchParams.get('isActive') === 'false' ? [historic] : [current, historic] }) : response(404, {}));
  expect(await screen.findByText('2026')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'false' } });
  fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }));
  await waitFor(() => expect(screen.queryByText('2026')).not.toBeInTheDocument());
  expect(screen.getByText('2025')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Limpiar' }));
  expect(await screen.findByText('2026')).toBeInTheDocument();
});

it('un formulario nuevo ofrece solo periodos activos y propone Única como sección', async () => {
  open('/sections', admin, (url) => {
    if (url.pathname === '/api/sections') return response(200, { items: [] });
    if (url.pathname === '/api/grades') return response(200, { items: [{ id: 'grade-1', educationLevelId: levelPrimary.id, name: '1.º', isActive: true }] });
    if (url.pathname === '/api/education-levels') return response(200, { items: [levelPrimary] });
    if (url.pathname === '/api/academic-periods') return response(200, { items: url.searchParams.get('isActive') === 'true' ? [{ id: 'period-2026', name: '2026', isActive: true }] : [{ id: 'period-2026', name: '2026', isActive: true }, { id: 'period-2025', name: '2025', isActive: false }] });
    return response(404, {});
  });
  fireEvent.click(await screen.findByRole('button', { name: 'Crear sección' }));
  expect(screen.getByLabelText('Sección')).toHaveValue('Única');
  await waitFor(() => expect(global.fetch.mock.calls.some(([url]) => new URL(url).pathname === '/api/academic-periods' && new URL(url).searchParams.get('isActive') === 'true')).toBe(true));
  await waitFor(() => expect(screen.getAllByLabelText('Periodo').at(-1)).toHaveValue('period-2026'));
  expect(screen.getAllByLabelText('Periodo').at(-1).querySelector('option[value="period-2025"]')).toBeNull();
});

it('Estudiante muestra nombre y correo de su cuenta; SECRETARIA no recibe enlace de edición', async () => {
  const linked = { id: '00000000-0000-4000-8000-000000000031', studentCode: 'S-01', firstName: 'Estudiante', lastName: '01', user: { id: admin.id, firstName: 'Cuenta', lastName: 'Vinculada', email: 'cuenta@siga.local' }, isActive: true };
  const unlinked = { ...linked, id: '00000000-0000-4000-8000-000000000032', studentCode: 'S-02', user: null };
  open('/students', secretary, (url) => url.pathname === '/api/students'
    ? response(200, { data: [linked, unlinked], pagination: { page: 1, limit: 20, total: 2, totalPages: 1 } })
    : url.pathname === `/api/students/${linked.id}` ? response(200, { data: linked }) : response(404, {}));
  expect(await screen.findByText('Cuenta Vinculada')).toBeInTheDocument();
  expect(screen.getByText('cuenta@siga.local')).toBeInTheDocument();
  expect(screen.getByText('Sin cuenta vinculada')).toBeInTheDocument();
  fireEvent.click(screen.getAllByRole('button', { name: 'Ver' })[0]);
  expect(await screen.findByRole('heading', { name: 'Detalle' })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Editar cuenta vinculada' })).not.toBeInTheDocument();
});

it('sección única usa el grado como etiqueta principal', () => {
  expect(sectionLabel({ name: 'ÚNICA', grade: { name: '1.º', educationLevel: { name: 'Primaria' } } })).toBe('1.º de Primaria');
  expect(sectionLabel({ name: 'A', grade: { name: '1.º', educationLevel: { name: 'Primaria' } } })).toContain('Sección A');
});
