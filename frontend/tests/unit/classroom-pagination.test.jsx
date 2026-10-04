import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import App from '../../src/App';

const teacher = { id: '00000000-0000-4000-8000-000000000001', firstName: 'Docente', lastName: 'A', email: 'teacher@invalid.example', role: 'DOCENTE' };
const uuid = (number) => `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
const assignment = (number, name) => ({ id: uuid(number), isActive: true, course: { name }, section: { name: String(number), grade: { name: 'Primero', educationLevel: { name: 'Primaria' } }, academicPeriod: { name: '2026' } }, teacher: { user: teacher } });
const first = assignment(1, 'Matemática');
const second = assignment(2, 'Comunicación');
const rosterA = Array.from({ length: 125 }, (_, index) => ({ id: uuid(index + 1000), status: 'ACTIVE', student: { studentCode: `A-${index + 1}`, firstName: `Alumno ${index + 1}`, lastName: 'A' } }));
const rosterB = [{ id: uuid(3000), status: 'ACTIVE', student: { studentCode: 'B-1', firstName: 'Alumno B', lastName: 'B' } }];
const json = (body) => ({ ok: true, status: 200, json: async () => body });

it('Mi aula pagina 125 matrículas sin conservar UUID ni filas de otra página o asignación', async () => {
  sessionStorage.setItem('siga_token', 'local-only');
  global.fetch = vi.fn(async (raw) => {
    const url = new URL(raw);
    if (url.pathname === '/api/auth/me') return json({ user: teacher });
    if (url.pathname === '/api/teaching-assignments') return json({ data: [first, second], pagination: { page: 1, limit: 20, total: 2, totalPages: 1 } });
    if (url.pathname.endsWith('/enrollments')) {
      const list = url.pathname.includes(first.id) ? rosterA : rosterB;
      const page = Number(url.searchParams.get('page'));
      const limit = Number(url.searchParams.get('limit'));
      return json({ data: list.slice((page - 1) * limit, page * limit), pagination: { page, limit, total: list.length, totalPages: Math.ceil(list.length / limit) } });
    }
    if (url.pathname === '/api/grade-records') return json({ data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } });
    throw new Error(`Solicitud inesperada: ${url.pathname}`);
  });
  render(<App />);
  fireEvent.click((await screen.findAllByRole('link', { name: 'Mi aula' }))[0]);
  fireEvent.click(await screen.findByRole('button', { name: /Matemática/ }));
  const section = screen.getByRole('heading', { name: 'Estudiantes matriculados' }).closest('section');
  const select = screen.getByLabelText('Estudiante');
  await waitFor(() => expect(within(section).getAllByRole('row')).toHaveLength(101));
  expect(within(section).getByText('Página 1 de 2 · 125 registros')).toBeInTheDocument();
  fireEvent.change(select, { target: { value: rosterA[99].id } });
  expect(select).toHaveValue(rosterA[99].id);

  fireEvent.click(within(section).getByRole('button', { name: 'Siguiente' }));
  expect(select).toHaveValue('');
  expect(within(section).queryByText('A-100')).not.toBeInTheDocument();
  await waitFor(() => expect(within(section).getAllByRole('row')).toHaveLength(26));
  expect(within(section).getByText('Página 2 de 2 · 125 registros')).toBeInTheDocument();
  expect(select.options).toHaveLength(26);
  fireEvent.change(select, { target: { value: rosterA[124].id } });
  expect(select).toHaveValue(rosterA[124].id);
  fireEvent.click(within(section).getByRole('button', { name: 'Anterior' }));
  expect(select).toHaveValue('');
  await waitFor(() => expect(within(section).getAllByRole('row')).toHaveLength(101));
  expect(within(section).queryByText('A-125')).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /Comunicación/ }));
  expect(select).toHaveValue('');
  expect(within(section).queryByText('A-1')).not.toBeInTheDocument();
  await waitFor(() => expect(within(section).getAllByRole('row')).toHaveLength(2));
  expect(select.options).toHaveLength(2);
  expect(select.options[1].value).toBe(rosterB[0].id);
  expect(global.fetch.mock.calls.every(([raw]) => new URL(raw).pathname !== '/api/students')).toBe(true);
});
