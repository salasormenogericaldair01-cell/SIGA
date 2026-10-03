const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { targetFromEnvironment, verifyDatabase, outsideRepository, assertCleanLabels, requireConfirmation, checkAccessProof, emailDigest, ROLES } = require('../../scripts/operations/data-transition-core');
const { credentials, legacyEmails, prepare, assertLegacyGraph, retire } = require('../../scripts/operations/data-transition');

const target = {
  BETA_TARGET: 'siga_demo_egx3', BETA_DATABASE_HOST: 'db.example.org',
  DATABASE_URL: `postgresql://account:${crypto.randomBytes(16).toString('hex')}@db.example.org:5432/siga_demo_egx3?sslmode=require`,
};

function accounts() {
  const env = {};
  for (const key of Object.keys(ROLES)) {
    env[`BETA_${key}_EMAIL`] = `${key.toLowerCase().replace('_', '-')}@example.org`;
    env[`BETA_${key}_PASSWORD`] = crypto.randomBytes(24).toString('base64url');
  }
  return credentials(env);
}

function previousAccounts() {
  const labels = { ADMIN: 'admin', SECRETARIA: 'secretaria', DOCENTE_A: 'docente-a', DOCENTE_B: 'docente-b', ESTUDIANTE_A: 'estudiante-a', ESTUDIANTE_B: 'estudiante-b' };
  const env = Object.fromEntries(Object.entries(labels).map(([key, label]) => [`BETA_LEGACY_${key}_EMAIL`, `demo-${label}@example.invalid`]));
  return legacyEmails(env);
}

function baseline() {
  return ['PRIMARIA', 'SECUNDARIA'].map((code) => ({
    id: `level-${code}`, code, name: `DEMO ${code}`, isActive: true,
    grades: [{ id: `grade-${code}`, order: 1, name: 'DEMO 1.º', isActive: true }],
  }));
}

function fakePrepareDb() {
  const state = { levels: baseline(), grades: [], users: [], periods: [], sections: [], courses: [], teachers: [], students: [], assignments: [], enrollments: [], gradeRecords: [], attendanceRecords: [] };
  let next = 0;
  const insert = (collection, data) => { const row = { id: `id-${++next}`, ...data }; state[collection].push(row); return row; };
  const tx = {
    user: { count: async () => state.users.length, create: async ({ data }) => insert('users', data) },
    academicPeriod: { findUnique: async () => state.periods[0] || null, create: async ({ data }) => insert('periods', data) },
    course: { count: async () => state.courses.length, create: async ({ data }) => insert('courses', data) },
    student: { count: async () => state.students.length, create: async ({ data }) => insert('students', data) },
    educationLevel: {
      findMany: async () => state.levels,
      update: async ({ where, data }) => { const row = state.levels.find((item) => item.id === where.id); Object.assign(row, data); return row; },
      create: async ({ data }) => { const row = insert('levels', data); row.grades = []; return row; },
    },
    grade: {
      update: async ({ where, data }) => { const row = state.levels.flatMap((item) => item.grades).find((item) => item.id === where.id); Object.assign(row, data); return row; },
      create: async ({ data }) => { const row = insert('grades', data); state.levels.find((item) => item.id === data.educationLevelId).grades.push(row); return row; },
    },
    section: { create: async ({ data }) => insert('sections', data) },
    teacher: { create: async ({ data }) => insert('teachers', data) },
    teachingAssignment: { create: async ({ data }) => insert('assignments', data) },
    enrollment: { create: async ({ data }) => insert('enrollments', data) },
    gradeRecord: { create: async ({ data }) => insert('gradeRecords', data) },
    attendanceRecord: { create: async ({ data }) => insert('attendanceRecords', data) },
  };
  return { tx, state };
}

test('rechaza bases, host, puerto y TLS incorrectos sin conectar', () => {
  expect(targetFromEnvironment(target).database).toBe('siga_demo_egx3');
  for (const patch of [
    { DATABASE_URL: target.DATABASE_URL.replace('siga_demo_egx3', 'siga') },
    { DATABASE_URL: target.DATABASE_URL.replace('siga_demo_egx3', 'siga_test') },
    { DATABASE_URL: target.DATABASE_URL.replace(':5432/', ':5433/') },
    { DATABASE_URL: target.DATABASE_URL.replace('sslmode=require', 'sslmode=disable') },
    { BETA_DATABASE_HOST: 'other.example.org' },
    { BETA_TARGET: 'siga' },
  ]) expect(() => targetFromEnvironment({ ...target, ...patch })).toThrow();
  expect(() => requireConfirmation({}, 'prepare')).toThrow();
  expect(() => requireConfirmation({ BETA_TRANSITION_CONFIRM: 'siga_demo_egx3:retire' }, 'prepare')).toThrow();
});

test('consulta el nombre y puerto reales antes de permitir el destino', async () => {
  const prisma = { $queryRaw: jest.fn().mockResolvedValue([{ name: 'siga_test', port: 5432 }]) };
  await expect(verifyDatabase(prisma, target)).rejects.toThrow(/servidor PostgreSQL/);
  prisma.$queryRaw.mockResolvedValue([{ name: 'siga_demo_egx3', port: 5433 }]);
  await expect(verifyDatabase(prisma, target)).rejects.toThrow(/servidor PostgreSQL/);
  prisma.$queryRaw.mockResolvedValue([{ name: 'siga_demo_egx3', port: 5432 }]);
  await expect(verifyDatabase(prisma, target)).resolves.toMatchObject({ database: 'siga_demo_egx3' });
  expect(() => outsideRepository(path.resolve(__dirname, '../.env.backup.dump'))).toThrow(/fuera de Git/);
  expect(() => outsideRepository(path.resolve(__dirname, '../../.env.backup.dump'))).toThrow(/fuera de Git/);
  expect(outsideRepository(path.join(os.tmpdir(), 'siga-backup.dump'))).toBeTruthy();
});

test('rechaza respaldos dentro del checkout principal al ejecutar desde un worktree externo', () => {
  const worktree = path.resolve(__dirname, '../../..');
  const gitEntry = path.join(worktree, '.git');
  if (!fs.statSync(gitEntry).isFile()) return;
  const gitdir = path.resolve(worktree, fs.readFileSync(gitEntry, 'utf8').trim().replace(/^gitdir:\s*/, ''));
  const commonDir = fs.realpathSync(path.resolve(gitdir, fs.readFileSync(path.join(gitdir, 'commondir'), 'utf8').trim()));
  expect(() => outsideRepository(path.join(path.dirname(commonDir), 'backup.dump'))).toThrow(/fuera de Git/);
});

test('prepara catálogo y relaciones sin etiquetas visibles; repetir se detiene sin cambios', async () => {
  const { tx, state } = fakePrepareDb();
  const people = accounts();
  const hashes = Object.fromEntries(Object.keys(people).map((key) => [key, `hash-${key}`]));
  const beforeIds = state.levels.map((item) => [item.id, item.grades[0].id]);
  const result = await prepare(tx, people, hashes);
  expect(result.adminId).toBeTruthy();
  expect(state.levels.map((item) => [item.id, item.grades[0].id]).slice(0, 2)).toEqual(beforeIds);
  expect(state.levels).toHaveLength(3);
  expect(state.levels.flatMap((item) => item.grades)).toHaveLength(14);
  expect(state.users).toHaveLength(6);
  expect(state.sections).toHaveLength(2);
  expect(state.assignments).toHaveLength(2);
  expect(state.enrollments).toHaveLength(2);
  expect(state.gradeRecords).toHaveLength(2);
  expect(state.attendanceRecords).toHaveLength(2);
  for (const record of state.gradeRecords) {
    const assignment = state.assignments.find((item) => item.id === record.teachingAssignmentId);
    const enrollment = state.enrollments.find((item) => item.id === record.enrollmentId);
    expect(record.sectionId).toBe(assignment.sectionId);
    expect(record.sectionId).toBe(enrollment.sectionId);
  }
  assertCleanLabels([
    ...state.levels.map((item) => item.name),
    ...state.levels.flatMap((item) => item.grades.map((grade) => grade.name)),
    ...state.users.flatMap((item) => [item.email, item.firstName, item.lastName]),
    ...state.students.flatMap((item) => [item.studentCode, item.firstName, item.lastName]),
    ...state.courses.flatMap((item) => [item.code, item.name]),
  ]);
  const snapshot = JSON.stringify(state);
  await expect(prepare(tx, people, hashes)).rejects.toThrow(/no se repite/);
  expect(JSON.stringify(state)).toBe(snapshot);
});

test('la validación del grafo impide retirar relaciones ajenas', () => {
  const legacy = previousAccounts();
  const users = [
    ['ADMIN', 'admin', 'Admin', 'ADMIN'], ['SECRETARIA', 'secretaria', 'Secretaria', 'SECRETARIA'],
    ['DOCENTE_A', 'docente-a', 'Docente A', 'DOCENTE'], ['DOCENTE_B', 'docente-b', 'Docente B', 'DOCENTE'],
    ['ESTUDIANTE_A', 'estudiante-a', 'Estudiante A', 'ESTUDIANTE'], ['ESTUDIANTE_B', 'estudiante-b', 'Estudiante B', 'ESTUDIANTE'],
  ].map(([key, name, lastName, role]) => ({ id: name, email: legacy[key], firstName: 'Demo', lastName, role, isActive: true }));
  const graph = {
    users, period: { id: 'period', name: 'DEMO 2026', startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31') },
    students: ['A', 'B'].map((key) => ({ id: `student-${key}`, studentCode: `DEMO-EST-${key}`, firstName: 'Demo', lastName: `Estudiante ${key}`, userId: `estudiante-${key.toLowerCase()}`, isActive: true })),
    teachers: ['A', 'B'].map((key) => ({ id: `teacher-${key}`, userId: `docente-${key.toLowerCase()}` })),
    sections: ['A', 'B'].map((key) => ({ id: `section-${key}`, name: `DEMO-${key}`, academicPeriodId: 'period', grade: { order: 1, educationLevel: { code: key === 'A' ? 'PRIMARIA' : 'SECUNDARIA' } } })),
    courses: ['A', 'B'].map((key) => ({ id: `course-${key}`, code: key === 'A' ? 'DEMO-MAT' : 'DEMO-COM', name: key === 'A' ? 'DEMO Matemática' : 'DEMO Comunicación', isActive: true })),
    assignments: ['A', 'B'].map((key) => ({ id: `assignment-${key}`, sectionId: `section-${key}`, courseId: `course-${key}`, teacherId: `teacher-${key}`, isActive: true })),
    enrollments: ['A', 'B'].map((key) => ({ id: `enrollment-${key}`, studentId: `student-${key}`, sectionId: `section-${key}`, academicPeriodId: 'period', status: 'ACTIVE' })),
    grades: ['A', 'B'].map((key) => ({ enrollmentId: `enrollment-${key}`, teachingAssignmentId: `assignment-${key}`, sectionId: `section-${key}`, term: 1, value: key === 'A' ? 'A' : 'B' })),
    attendance: ['A', 'B'].map((key) => ({ enrollmentId: `enrollment-${key}`, teachingAssignmentId: `assignment-${key}`, sectionId: `section-${key}`, status: 'PRESENT' })),
  };
  expect(() => assertLegacyGraph(graph, legacy)).not.toThrow();
  graph.assignments[0].sectionId = 'section-B';
  expect(() => assertLegacyGraph(graph, legacy)).toThrow(/relaciones/);
  graph.assignments[0].sectionId = 'section-A';
  graph.attendance.push({ ...graph.attendance[0] });
  expect(() => assertLegacyGraph(graph, legacy)).toThrow(/cambió/);
});

test('no retira al ADMIN anterior sin ADMIN nuevo y prueba API completa', async () => {
  const people = accounts();
  const tx = { user: { findUnique: jest.fn().mockResolvedValue(null) } };
  await expect(retire(tx, people, {}, previousAccounts())).rejects.toThrow(/ADMIN/);
  expect(tx.user.findUnique).toHaveBeenCalledTimes(1);
  tx.user.findUnique.mockResolvedValue({ id: 'new-admin', role: 'ADMIN', isActive: true });
  await expect(retire(tx, people, {}, previousAccounts())).rejects.toThrow(/Comprobación API/);
  const now = new Date().toISOString();
  const proof = { database: 'siga_demo_egx3', verifiedAt: now, roles: Object.fromEntries(Object.entries(people).map(([key, item]) => [key, { id: key === 'ADMIN' ? 'new-admin' : key, role: ROLES[key][2], emailSha256: emailDigest(item.email), verifiedAt: now }])) };
  expect(() => checkAccessProof(proof, Object.fromEntries(Object.entries(people).map(([key, item]) => [key, emailDigest(item.email)])), 'new-admin')).not.toThrow();
  proof.roles.ADMIN.id = 'other-admin';
  expect(() => checkAccessProof(proof, Object.fromEntries(Object.entries(people).map(([key, item]) => [key, emailDigest(item.email)])), 'new-admin')).toThrow();
});

test('retire repetido se detiene si los registros anteriores ya no existen', async () => {
  const people = accounts();
  const now = new Date().toISOString();
  const proof = { database: 'siga_demo_egx3', verifiedAt: now, roles: Object.fromEntries(Object.entries(people).map(([key, item]) => [key, { id: key === 'ADMIN' ? 'new-admin' : key, role: ROLES[key][2], emailSha256: emailDigest(item.email), verifiedAt: now }])) };
  const noRows = { findMany: jest.fn().mockResolvedValue([]), deleteMany: jest.fn() };
  const tx = {
    user: { ...noRows, findUnique: jest.fn().mockResolvedValue({ id: 'new-admin', role: 'ADMIN', isActive: true }) },
    student: noRows, teacher: noRows, academicPeriod: { findUnique: jest.fn().mockResolvedValue(null), deleteMany: jest.fn() },
    section: noRows, course: noRows, teachingAssignment: noRows, enrollment: noRows,
    gradeRecord: noRows, attendanceRecord: noRows,
  };
  await expect(retire(tx, people, proof, previousAccounts())).rejects.toThrow(/conjunto DEMO cambió/);
  expect(noRows.deleteMany).not.toHaveBeenCalled();
});

test('rechaza etiquetas prohibidas también en correos nuevos', () => {
  const env = {};
  for (const key of Object.keys(ROLES)) {
    env[`BETA_${key}_EMAIL`] = `${key.toLowerCase()}@example.org`;
    env[`BETA_${key}_PASSWORD`] = crypto.randomBytes(24).toString('base64url');
  }
  env.BETA_ADMIN_EMAIL = 'demo-admin@example.org';
  expect(() => credentials(env)).toThrow(/etiqueta/);
});
