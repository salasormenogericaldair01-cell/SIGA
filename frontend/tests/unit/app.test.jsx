import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import App from '../../src/App';
import { AuthProvider } from '../../src/auth/AuthContext';
import { ReferenceField } from '../../src/components/Ui';

const admin = { id: '00000000-0000-4000-8000-000000000001', firstName: 'Ana', lastName: 'Admin', email: 'ana@test.edu', role: 'ADMIN' };
const secretary = { ...admin, role: 'SECRETARIA' };
const student = { ...admin, role: 'ESTUDIANTE' };
const teacher = { ...admin, role: 'DOCENTE' };
const json = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
function mockApi(handler) { global.fetch = vi.fn((url, options = {}) => handler(new URL(url).pathname, options)); }

describe('Mi perfil', () => {
  it.each([admin, secretary, teacher, student])('permite a %s abrir Mi perfil antes de Cambiar contraseña', async (account) => {
    sessionStorage.setItem('siga_token', 'sesion');
    mockApi((path) => path === '/api/auth/me' ? json(200, { user: account }) : json(500, {}));
    render(<App />);
    const profile = await screen.findByRole('link', { name: 'Mi perfil' });
    const password = screen.getByRole('link', { name: 'Cambiar contraseña' });
    expect(profile.compareDocumentPosition(password) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(profile);
    expect(await screen.findByRole('heading', { name: 'Mi perfil' })).toBeInTheDocument();
    expect(screen.getByLabelText('Nombres')).toHaveValue(account.firstName);
    expect(screen.getByLabelText('Apellidos')).toHaveValue(account.lastName);
    expect(screen.queryByLabelText('Correo electrónico')).not.toBeInTheDocument();
  });

  it('actualiza el encabezado y conserva la sesión después de guardar', async () => {
    sessionStorage.setItem('siga_token', 'sesion');
    const changed = { ...admin, firstName: 'Lucía', lastName: 'Rojas' };
    mockApi((path, options) => path === '/api/auth/me' && options.method === 'PATCH'
      ? json(200, { user: changed }) : path === '/api/auth/me' ? json(200, { user: admin }) : json(500, {}));
    render(<App />);
    fireEvent.click(await screen.findByRole('link', { name: 'Mi perfil' }));
    fireEvent.change(screen.getByLabelText('Nombres'), { target: { value: '  Lucía  ' } });
    fireEvent.change(screen.getByLabelText('Apellidos'), { target: { value: ' Rojas ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar nombre' }));
    expect(await screen.findByText('Lucía Rojas')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Tu nombre de perfil se actualizó.');
    const call = global.fetch.mock.calls.find(([url, options]) => new URL(url).pathname === '/api/auth/me' && options.method === 'PATCH');
    expect(JSON.parse(call[1].body)).toEqual({ firstName: 'Lucía', lastName: 'Rojas' });
    expect(sessionStorage.getItem('siga_token')).toBe('sesion');
  });

  it('muestra un error de API sin perder los datos editados ni cerrar sesión', async () => {
    sessionStorage.setItem('siga_token', 'sesion');
    mockApi((path, options) => path === '/api/auth/me' && options.method === 'PATCH'
      ? json(400, { message: 'Datos inválidos' }) : path === '/api/auth/me' ? json(200, { user: admin }) : json(500, {}));
    render(<App />);
    fireEvent.click(await screen.findByRole('link', { name: 'Mi perfil' }));
    fireEvent.change(screen.getByLabelText('Nombres'), { target: { value: 'Lucía' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar nombre' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Datos inválidos');
    expect(screen.getByLabelText('Nombres')).toHaveValue('Lucía');
    expect(sessionStorage.getItem('siga_token')).toBe('sesion');
  });
});

describe('sesión y navegación', () => {
  it('permite mostrar y ocultar la contraseña sin alterar su valor', () => {
    mockApi(() => json(401, { message: 'Credenciales inválidas' }));
    render(<App />);
    const password = screen.getByLabelText('Contraseña');
    fireEvent.change(password, { target: { value: 'frase-de-prueba' } });
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar contraseña' }));
    expect(password).toHaveAttribute('type', 'text');
    expect(password).toHaveValue('frase-de-prueba');
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar contraseña' }));
    expect(password).toHaveAttribute('type', 'password');
  });

  it('inicia sesión y consulta /auth/me antes de mostrar el panel', async () => {
    mockApi((path) => path === '/api/auth/login' ? json(200, { token: 'token-local', user: admin }) : json(200, { user: admin }));
    render(<App />);
    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'ana@test.edu' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'contraseña-muy-segura' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
    expect(await screen.findByText('Bienvenido, Ana')).toBeInTheDocument();
    expect(sessionStorage.getItem('siga_token')).toBe('token-local');
    expect(global.fetch.mock.calls.map(([url]) => new URL(url).pathname)).toEqual(['/api/auth/login', '/api/auth/me']);
  });

  it('muestra error de credenciales sin guardar sesión', async () => {
    mockApi(() => json(401, { message: 'Credenciales inválidas' }));
    render(<App />);
    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'ana@test.edu' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'incorrecta' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Credenciales inválidas');
    expect(sessionStorage.getItem('siga_token')).toBeNull();
  });

  it('recupera la sesión guardada y la limpia si /auth/me devuelve 401', async () => {
    sessionStorage.setItem('siga_token', 'previo');
    window.history.replaceState({}, '', '/');
    mockApi(() => json(401, { message: 'No autorizado' }));
    render(<App />);
    expect(await screen.findByRole('button', { name: 'Ingresar' })).toBeInTheDocument();
    expect(sessionStorage.getItem('siga_token')).toBeNull();
  });

  it('recupera una sesión válida sin pedir otra contraseña', async () => {
    sessionStorage.setItem('siga_token', 'previo');
    mockApi((path) => path === '/api/auth/me' ? json(200, { user: admin }) : json(500, {}));
    render(<App />);
    expect(await screen.findByText('Bienvenido, Ana')).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem('siga_token')).toBe('previo');
  });

  it('abre y cierra el menú adaptable sin cambiar la sesión', async () => {
    sessionStorage.setItem('siga_token', 'previo');
    mockApi((path) => path === '/api/auth/me' ? json(200, { user: admin }) : json(500, {}));
    render(<App />);
    const open = await screen.findByRole('button', { name: 'Abrir menú' });
    fireEvent.click(open);
    expect(screen.getByRole('button', { name: 'Cerrar menú' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByRole('link', { name: 'Estudiantes' })).toHaveLength(2);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByRole('button', { name: 'Abrir menú' })).toHaveAttribute('aria-expanded', 'false');
    expect(sessionStorage.getItem('siga_token')).toBe('previo');
  });

  it('conserva el token si /auth/me falla por error de servidor', async () => {
    sessionStorage.setItem('siga_token', 'previo');
    mockApi(() => json(500, { message: 'Error interno del servidor' }));
    render(<App />);
    expect(await screen.findByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
    expect(sessionStorage.getItem('siga_token')).toBe('previo');
  });

  it('conserva sesión ante 403 y permite cerrar sesión local', async () => {
    sessionStorage.setItem('siga_token', 'previo');
    mockApi((path) => path === '/api/auth/me' ? json(200, { user: student }) : json(403, { message: 'Sin perfil vinculado' }));
    render(<App />);
    fireEvent.click((await screen.findAllByRole('link', { name: /Mis calificaciones/ }))[0]);
    expect(await screen.findByRole('alert')).toHaveTextContent('No tienes un perfil de estudiante');
    expect(sessionStorage.getItem('siga_token')).toBe('previo');
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    expect(await screen.findByRole('button', { name: 'Ingresar' })).toBeInTheDocument();
    expect(sessionStorage.getItem('siga_token')).toBeNull();
  });

  it.each([admin, secretary, teacher, student])('ofrece cambio de contraseña al rol %s', async (user) => {
    sessionStorage.setItem('siga_token', 'previo');
    mockApi((path) => path === '/api/auth/me' ? json(200, { user }) : json(500, {}));
    render(<App />);
    expect(await screen.findByRole('link', { name: 'Cambiar contraseña' })).toBeInTheDocument();
  });

  it('cambia la contraseña, limpia la sesión y vuelve al login con una explicación', async () => {
    sessionStorage.setItem('siga_token', 'previo');
    mockApi((path) => path === '/api/auth/me' ? json(200, { user: admin }) :
      path === '/api/auth/change-password' ? json(200, { message: 'Contraseña actualizada' }) : json(500, {}));
    render(<App />);
    fireEvent.click(await screen.findByRole('link', { name: 'Cambiar contraseña' }));
    fireEvent.change(screen.getByLabelText('Contraseña actual'), { target: { value: 'AnteriorSegura123' } });
    fireEvent.change(screen.getByLabelText('Nueva contraseña'), { target: { value: 'NuevaFraseSegura123' } });
    fireEvent.change(screen.getByLabelText('Confirmar nueva contraseña'), { target: { value: 'NuevaFraseSegura123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar contraseña' }));
    expect(await screen.findByText('Contraseña actualizada. Inicia sesión con la nueva contraseña.')).toBeInTheDocument();
    expect(sessionStorage.getItem('siga_token')).toBeNull();
    const request = global.fetch.mock.calls.find(([url]) => new URL(url).pathname === '/api/auth/change-password');
    expect(JSON.parse(request[1].body)).toEqual({ currentPassword: 'AnteriorSegura123', newPassword: 'NuevaFraseSegura123' });
  });

  it('mantiene la sesión y el formulario ante una contraseña actual incorrecta', async () => {
    sessionStorage.setItem('siga_token', 'previo');
    mockApi((path) => path === '/api/auth/me' ? json(200, { user: admin }) :
      path === '/api/auth/change-password' ? json(400, { message: 'La contraseña actual es incorrecta' }) : json(500, {}));
    render(<App />);
    fireEvent.click(await screen.findByRole('link', { name: 'Cambiar contraseña' }));
    fireEvent.change(screen.getByLabelText('Contraseña actual'), { target: { value: 'IncorrectaSegura123' } });
    fireEvent.change(screen.getByLabelText('Nueva contraseña'), { target: { value: 'NuevaFraseSegura123' } });
    fireEvent.change(screen.getByLabelText('Confirmar nueva contraseña'), { target: { value: 'NuevaFraseSegura123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar contraseña' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('La contraseña actual es incorrecta');
    expect(sessionStorage.getItem('siga_token')).toBe('previo');
    expect(screen.getByLabelText('Nueva contraseña')).toHaveValue('NuevaFraseSegura123');
  });

  it('restringe operaciones y navegación de secretaría y estudiante', async () => {
    sessionStorage.setItem('siga_token', 'previo');
    mockApi((path) => path === '/api/auth/me' ? json(200, { user: secretary }) : json(200, { data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } }));
    render(<App />);
    expect(await screen.findByText('Bienvenido, Ana')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Usuarios' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'Docentes' }));
    expect(await screen.findByRole('heading', { name: 'Docentes' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Crear perfil docente' })).not.toBeInTheDocument();
    expect(global.fetch.mock.calls.every(([url]) => !new URL(url).pathname.endsWith('/users'))).toBe(true);
  });

  it('el estudiante solo ve sus dos módulos de consulta', async () => {
    sessionStorage.setItem('siga_token', 'previo');
    mockApi((path) => path === '/api/auth/me' ? json(200, { user: student }) : json(200, { data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } }));
    render(<App />);
    expect(await screen.findByText('Bienvenido, Ana')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Usuarios' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Cursos' })).not.toBeInTheDocument();
    fireEvent.click((await screen.findAllByRole('link', { name: /Mis calificaciones/ }))[0]);
    expect(await screen.findByRole('heading', { name: 'Mis calificaciones' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Registrar calificación' })).not.toBeInTheDocument();
    expect(global.fetch.mock.calls.every(([url]) => !new URL(url).pathname.endsWith('/users'))).toBe(true);
  });

  it('secretaría crea estudiantes sin consultar usuarios ni mostrar vinculación', async () => {
    sessionStorage.setItem('siga_token', 'previo');
    mockApi((path) => path === '/api/auth/me' ? json(200, { user: secretary }) : json(200, { data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } }));
    render(<App />);
    fireEvent.click(await screen.findByRole('link', { name: 'Estudiantes' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Registrar estudiante' }));
    expect(screen.queryByLabelText('Cuenta de estudiante (opcional)')).not.toBeInTheDocument();
    expect(global.fetch.mock.calls.every(([url]) => !new URL(url).pathname.endsWith('/users'))).toBe(true);
  });

  it('muestra estudiantes reales, paginación y el formulario aprobado', async () => {
    sessionStorage.setItem('siga_token', 'previo');
    mockApi((path) => {
      if (path === '/api/auth/me') return json(200, { user: secretary });
      if (path === '/api/students') return json(200, { data: [{ id: 'student-1', studentCode: 'EST001', firstName: 'Lucía', lastName: 'Pérez', birthDate: '2015-04-12', user: null, isActive: true }], pagination: { page: 1, limit: 20, total: 21, totalPages: 2 } });
      return json(500, {});
    });
    render(<App />);
    fireEvent.click(await screen.findByRole('link', { name: 'Estudiantes' }));
    expect(await screen.findByText('EST001')).toBeInTheDocument();
    expect(screen.getByText('Lucía Pérez')).toBeInTheDocument();
    expect(screen.getByText('Página 1 de 2 · 21 registros')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Registrar estudiante' }));
    expect(screen.getByText('Puedes registrar al estudiante sin vincular una cuenta de acceso.')).toBeInTheDocument();
    expect(screen.getByLabelText('Nombres')).toBeInTheDocument();
    expect(screen.getByLabelText('Fecha de nacimiento')).toBeInTheDocument();
    expect(document.getElementById('field-isActive')).toHaveValue('true');
  });

  it('limpia un filtro aplicado y vuelve a consultar la lista completa', async () => {
    sessionStorage.setItem('siga_token', 'previo');
    mockApi((path) => path === '/api/auth/me' ? json(200, { user: secretary }) : json(200, { data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } }));
    render(<App />);
    fireEvent.click(await screen.findByRole('link', { name: 'Estudiantes' }));
    const search = screen.getByLabelText('Buscar por código o nombre');
    fireEvent.change(search, { target: { value: 'Ana' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }));
    await waitFor(() => expect(global.fetch.mock.calls.some(([url]) => new URL(url).searchParams.get('search') === 'Ana')).toBe(true));
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar' }));
    expect(search).toHaveValue('');
    await waitFor(() => {
      const calls = global.fetch.mock.calls.filter(([url]) => new URL(url).pathname === '/api/students');
      expect(new URL(calls.at(-1)[0]).searchParams.has('search')).toBe(false);
    });
  });

  it('docente no consulta catálogos administrativos para filtrar asignaciones', async () => {
    sessionStorage.setItem('siga_token', 'previo');
    mockApi((path) => path === '/api/auth/me' ? json(200, { user: teacher }) : json(200, { data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } }));
    render(<App />);
    fireEvent.click((await screen.findAllByRole('link', { name: 'Mi aula' }))[0]);
    expect(await screen.findByRole('heading', { name: 'Mis asignaciones' })).toBeInTheDocument();
    expect(global.fetch.mock.calls.every(([url]) => !/\/(users|students|teachers|sections|academic-periods)$/.test(new URL(url).pathname))).toBe(true);
  });

  it('conecta el formulario de curso y conserva sus datos ante 409', async () => {
    sessionStorage.setItem('siga_token', 'previo');
    mockApi((path, options) => {
      if (path === '/api/auth/me') return json(200, { user: admin });
      if (path === '/api/courses' && options.method === 'POST') return json(409, { message: 'Registro duplicado' });
      return json(200, { data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } });
    });
    render(<App />);
    fireEvent.click(await screen.findByRole('link', { name: 'Cursos' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Crear curso' }));
    fireEvent.change(screen.getByLabelText('Código'), { target: { value: 'MAT' } });
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Matemática' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Registro duplicado');
    expect(screen.getByLabelText('Código')).toHaveValue('MAT');
    expect(screen.getByLabelText('Nombre')).toHaveValue('Matemática');
  });

  it('identifica matrículas por nombre de Student sin cuenta en lista, detalle y selectores', async () => {
    sessionStorage.setItem('siga_token', 'previo');
    const ficha = { id: 'student-1', studentCode: 'EST-2026-001', firstName: 'María Elena del Carmen', lastName: 'Rojas Quispe de la Cruz', userId: null };
    const matricula = { id: 'enrollment-1', studentId: ficha.id, student: ficha, sectionId: 'section-1', section: { id: 'section-1', name: 'A' }, academicPeriodId: 'period-1', academicPeriod: { id: 'period-1', name: '2026' }, status: 'ACTIVE' };
    mockApi((path) => {
      if (path === '/api/auth/me') return json(200, { user: admin });
      if (path === '/api/enrollments/enrollment-1') return json(200, { data: matricula });
      if (path === '/api/enrollments') return json(200, { data: [matricula], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } });
      if (path === '/api/students') return json(200, { data: [ficha], pagination: { page: 1, limit: 100, total: 1, totalPages: 1 } });
      if (path === '/api/sections') return json(200, { items: [{ id: 'section-1', gradeId: 'grade-1', academicPeriodId: 'period-1', name: 'A' }] });
      if (path === '/api/grades') return json(200, { items: [{ id: 'grade-1', educationLevelId: 'level-1', name: '1.º' }] });
      if (path === '/api/academic-periods') return json(200, { items: [{ id: 'period-1', name: '2026' }] });
      if (path === '/api/education-levels') return json(200, { items: [{ id: 'level-1', name: 'Primaria' }] });
      return json(500, { message: 'Ruta inesperada' });
    });
    render(<App />);
    fireEvent.click(await screen.findByRole('link', { name: 'Matrículas' }));
    const cell = await screen.findByRole('cell', { name: /María Elena del Carmen Rojas Quispe de la Cruz.*Código: EST-2026-001/ });
    expect(cell.querySelector('.student-identity-name')).toHaveTextContent('María Elena del Carmen Rojas Quispe de la Cruz');
    expect(cell.querySelector('.student-identity-code')).toHaveTextContent('EST-2026-001');
    fireEvent.click(screen.getByRole('button', { name: 'Ver' }));
    expect(await screen.findByRole('heading', { name: 'Detalle' })).toBeInTheDocument();
    expect(screen.getAllByText('María Elena del Carmen Rojas Quispe de la Cruz').length).toBeGreaterThan(1);
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar detalle' }));
    fireEvent.click(screen.getByRole('button', { name: 'Registrar matrícula' }));
    expect(await screen.findByRole('option', { name: 'María Elena del Carmen Rojas Quispe de la Cruz · EST-2026-001' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar formulario' }));
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    expect(screen.getByRole('region', { name: 'Editar matrícula' })).toHaveTextContent('María Elena del Carmen Rojas Quispe de la Cruz');
    expect(screen.getByRole('region', { name: 'Editar matrícula' })).toHaveTextContent('EST-2026-001');
  });

  it('permite avanzar y volver en un selector con listado paginado', async () => {
    sessionStorage.setItem('siga_token', 'previo');
    global.fetch = vi.fn((url) => {
      const parsed = new URL(url);
      if (parsed.pathname === '/api/auth/me') return Promise.resolve(json(200, { user: admin }));
      if (parsed.pathname === '/api/courses') {
        const page = Number(parsed.searchParams.get('page'));
        return Promise.resolve(json(200, {
          data: page === 1 ? [{ id: 'course-1', name: 'Curso inicial' }] : [{ id: 'course-2', name: 'Curso final' }],
          pagination: { page, limit: 100, total: 101, totalPages: 2 },
        }));
      }
      return Promise.resolve(json(500, {}));
    });
    render(<AuthProvider><label htmlFor="course-selector">Curso</label><ReferenceField field={{ key: 'courseId', label: 'Curso', type: 'ref', resource: 'courses' }} value="" onChange={vi.fn()} id="course-selector" /></AuthProvider>);
    expect(await screen.findByRole('option', { name: 'Curso inicial' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Más opciones' }));
    expect(await screen.findByRole('option', { name: 'Curso final' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Opciones anteriores' }));
    expect(await screen.findByRole('option', { name: 'Curso inicial' })).toBeInTheDocument();
  });

  it('descarta filas y filtros del módulo anterior al cambiar de recurso', async () => {
    sessionStorage.setItem('siga_token', 'previo');
    global.fetch = vi.fn((url) => {
      const parsed = new URL(url);
      if (parsed.pathname === '/api/auth/me') return Promise.resolve(json(200, { user: admin }));
      if (parsed.pathname === '/api/courses') return Promise.resolve(json(200, { data: [{ id: 'course-1', code: 'DEMO-MAT', name: 'Matemática', isActive: true }], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } }));
      if (parsed.pathname === '/api/grade-records') return Promise.resolve(json(200, { data: [{ id: 'record-1', term: 1, value: 'A', teachingAssignment: { course: { name: 'Matemática' } }, enrollment: { student: { firstName: 'Demo', lastName: 'Alumna' } } }], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } }));
      if (['/api/academic-periods', '/api/grades', '/api/sections', '/api/education-levels'].includes(parsed.pathname)) return Promise.resolve(json(200, { items: [] }));
      return Promise.resolve(json(200, { data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } }));
    });
    render(<App />);
    fireEvent.click(await screen.findByRole('link', { name: 'Cursos' }));
    expect(await screen.findByText('DEMO-MAT')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'Calificaciones' }));
    expect(await screen.findByRole('cell', { name: 'A' })).toBeInTheDocument();
    expect(screen.queryByText('DEMO-MAT')).not.toBeInTheDocument();
  });
});
