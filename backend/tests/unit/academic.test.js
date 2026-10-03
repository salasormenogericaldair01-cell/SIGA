jest.mock('../../src/config/prisma', () => ({
  user: { findUnique: jest.fn() },
  educationLevel: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
  grade: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
  academicPeriod: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
  section: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
}));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('node:crypto');
const prisma = require('../../src/config/prisma');
const { createApp } = require('../../src/app');
const { seedAcademic } = require('../../scripts/setup/seed-academic');

const app = createApp();
const id = () => randomUUID();
const users = Object.fromEntries(['ADMIN', 'SECRETARIA', 'DOCENTE', 'ESTUDIANTE'].map((role) => [role, { id: id(), email: `${role.toLowerCase()}@test.edu`, firstName: 'A', lastName: 'B', role, isActive: true, tokenVersion: 0 }]));
const token = (role) => `Bearer ${jwt.sign({ tokenVersion: 0 }, process.env.JWT_SECRET, { algorithm: 'HS256', subject: users[role].id, expiresIn: '1h' })}`;
const send = (method, route, role, body) => {
  const req = request(app)[method](route).set('Authorization', token(role));
  return body === undefined ? req : req.send(body);
};

let records;
let level;
let grade;
let period;

beforeEach(() => {
  jest.clearAllMocks();
  level = { id: id(), code: 'INICIAL', name: 'Inicial', isActive: true };
  grade = { id: id(), educationLevelId: level.id, name: '3 años', order: 3, isActive: true };
  period = { id: id(), name: '2026', startDate: new Date('2026-03-01'), endDate: new Date('2026-12-01'), isActive: true };
  records = { educationLevel: new Map([[level.id, level]]), grade: new Map([[grade.id, grade]]), academicPeriod: new Map([[period.id, period]]), section: new Map() };
  prisma.user.findUnique.mockImplementation(async ({ where }) => Object.values(users).find((u) => u.id === where.id) || null);
  for (const model of Object.keys(records)) {
    prisma[model].findUnique.mockImplementation(async ({ where }) => records[model].get(where.id) || null);
    prisma[model].findMany.mockImplementation(async ({ where }) => [...records[model].values()].filter((r) => Object.entries(where).every(([k, v]) => r[k] === v)));
    prisma[model].create.mockImplementation(async ({ data }) => {
      const unique = model === 'educationLevel' ? (r) => r.code === data.code
        : model === 'grade' ? (r) => r.educationLevelId === data.educationLevelId && r.order === data.order
          : model === 'academicPeriod' ? (r) => r.name === data.name
            : (r) => r.gradeId === data.gradeId && r.academicPeriodId === data.academicPeriodId && r.name === data.name;
      if ([...records[model].values()].some(unique)) throw Object.assign(new Error('duplicate'), { code: 'P2002' });
      const record = { id: id(), isActive: true, ...data };
      records[model].set(record.id, record);
      return record;
    });
    prisma[model].update.mockImplementation(async ({ where, data }) => {
      const record = records[model].get(where.id);
      if (!record) throw Object.assign(new Error('missing'), { code: 'P2025' });
      Object.assign(record, data);
      return record;
    });
  }
});

test('todos los recursos requieren token y restringen DOCENTE y ESTUDIANTE', async () => {
  for (const route of ['education-levels', 'grades', 'academic-periods', 'sections']) {
    await request(app).get(`/api/${route}`).expect(401);
    for (const role of ['DOCENTE', 'ESTUDIANTE']) {
      await send('get', `/api/${route}`, role).expect(403);
      await send('post', `/api/${route}`, role, {}).expect(403);
      await send('patch', `/api/${route}/${id()}`, role, {}).expect(403);
    }
    for (const role of ['ADMIN', 'SECRETARIA']) await send('get', `/api/${route}`, role).expect(200);
  }
});

test('ADMIN y SECRETARIA crean y editan; nombres se normalizan', async () => {
  const l = await send('post', '/api/education-levels', 'ADMIN', { code: 'PRIMARIA', name: '  Primaria  ' }).expect(201);
  expect(l.body.item.name).toBe('Primaria');
  const g = await send('post', '/api/grades', 'SECRETARIA', { educationLevelId: l.body.item.id, name: ' Primer grado ', order: 1 }).expect(201);
  const p = await send('post', '/api/academic-periods', 'ADMIN', { name: ' 2027 ', startDate: '2027-03-01', endDate: '2027-12-01' }).expect(201);
  const s = await send('post', '/api/sections', 'SECRETARIA', { gradeId: g.body.item.id, academicPeriodId: p.body.item.id, name: ' a ' }).expect(201);
  expect(s.body.item.name).toBe('A');
  await send('patch', `/api/sections/${s.body.item.id}`, 'ADMIN', { name: ' b ' }).expect(200);
  expect(records.section.get(s.body.item.id).name).toBe('B');
  for (const [route, value] of [['education-levels', l], ['grades', g], ['academic-periods', p], ['sections', s]]) {
    await send('get', `/api/${route}/${value.body.item.id}`, 'SECRETARIA').expect(200);
  }
});

test('UUID, filtros, cuerpos estrictos y PATCH vacío se rechazan', async () => {
  for (const route of ['education-levels', 'grades', 'academic-periods', 'sections']) {
    await send('get', `/api/${route}/bad`, 'ADMIN').expect(400);
    await send('get', `/api/${route}?isActive=1`, 'ADMIN').expect(400);
    await send('get', `/api/${route}?extra=x`, 'ADMIN').expect(400);
    await send('patch', `/api/${route}/${id()}`, 'ADMIN', {}).expect(400);
  }
  await send('get', '/api/grades?educationLevelId=bad', 'ADMIN').expect(400);
  await send('get', '/api/sections?gradeId=bad', 'ADMIN').expect(400);
  await send('get', '/api/sections?academicPeriodId=bad', 'ADMIN').expect(400);
  await send('post', '/api/education-levels', 'ADMIN', { code: 'INICIAL', name: ' ' }).expect(400);
  await send('patch', `/api/education-levels/${level.id}`, 'ADMIN', { code: 'PRIMARIA' }).expect(400);
  await send('patch', `/api/grades/${grade.id}`, 'ADMIN', { educationLevelId: id() }).expect(400);
  await send('patch', `/api/sections/${id()}`, 'ADMIN', { gradeId: id() }).expect(400);
  await send('get', `/api/sections/${id()}`, 'ADMIN').expect(404);
});

test('duplicados, referencias inexistentes y rango de grados', async () => {
  await send('post', '/api/education-levels', 'ADMIN', { code: 'INICIAL', name: 'Otro' }).expect(409);
  await send('post', '/api/grades', 'ADMIN', { educationLevelId: id(), name: '3', order: 3 }).expect(404);
  for (const order of [1, 2, 6]) await send('post', '/api/grades', 'ADMIN', { educationLevelId: level.id, name: 'x', order }).expect(400);
  for (const [code, invalidOrder] of [['PRIMARIA', 7], ['SECUNDARIA', 6]]) {
    level.code = code;
    await send('post', '/api/grades', 'ADMIN', { educationLevelId: level.id, name: 'x', order: invalidOrder }).expect(400);
  }
  level.code = 'INICIAL';
  await send('post', '/api/grades', 'ADMIN', { educationLevelId: level.id, name: 'Otro', order: 3 }).expect(409);
  await send('post', '/api/sections', 'ADMIN', { gradeId: id(), academicPeriodId: period.id, name: 'A' }).expect(404);
  await send('post', '/api/sections', 'ADMIN', { gradeId: grade.id, academicPeriodId: id(), name: 'A' }).expect(404);
});

test('fechas se comprueban en creación y con PATCH parcial', async () => {
  await send('post', '/api/academic-periods', 'ADMIN', { name: 'x', startDate: '2026-12-01', endDate: '2026-03-01' }).expect(400);
  await send('post', '/api/academic-periods', 'ADMIN', { name: 'x', startDate: '2026-02-30', endDate: '2026-12-01' }).expect(400);
  await send('patch', `/api/academic-periods/${period.id}`, 'ADMIN', { startDate: '2027-01-01' }).expect(400);
  await send('patch', `/api/academic-periods/${period.id}`, 'ADMIN', { endDate: '2026-02-01' }).expect(400);
  await send('patch', `/api/academic-periods/${period.id}`, 'ADMIN', { endDate: '2027-02-01' }).expect(200);
});

test('secciones de periodos distintos conviven; inactivos impiden asociaciones sin cascada', async () => {
  const p2 = await send('post', '/api/academic-periods', 'ADMIN', { name: '2027', startDate: '2027-03-01', endDate: '2027-12-01' }).expect(201);
  const a = await send('post', '/api/sections', 'ADMIN', { gradeId: grade.id, academicPeriodId: period.id, name: 'A' }).expect(201);
  await send('post', '/api/sections', 'ADMIN', { gradeId: grade.id, academicPeriodId: period.id, name: 'a' }).expect(409);
  await send('post', '/api/sections', 'ADMIN', { gradeId: grade.id, academicPeriodId: p2.body.item.id, name: 'A' }).expect(201);
  expect((await send('get', `/api/sections?academicPeriodId=${period.id}&isActive=true`, 'ADMIN').expect(200)).body.items).toHaveLength(1);
  await send('patch', `/api/grades/${grade.id}`, 'ADMIN', { isActive: false }).expect(200);
  await send('post', '/api/sections', 'ADMIN', { gradeId: grade.id, academicPeriodId: period.id, name: 'B' }).expect(400);
  expect(records.section.has(a.body.item.id)).toBe(true);
  await send('patch', `/api/grades/${grade.id}`, 'ADMIN', { isActive: true }).expect(200);
  await send('patch', `/api/academic-periods/${period.id}`, 'ADMIN', { isActive: false }).expect(200);
  await send('post', '/api/sections', 'ADMIN', { gradeId: grade.id, academicPeriodId: period.id, name: 'B' }).expect(400);
  await send('patch', `/api/education-levels/${level.id}`, 'ADMIN', { isActive: false }).expect(200);
  await send('post', '/api/grades', 'ADMIN', { educationLevelId: level.id, name: '4 años', order: 4 }).expect(400);
  expect(records.grade.has(grade.id)).toBe(true);
});

test('seed académico es idempotente y conserva cambios previos', async () => {
  const saved = new Map([['INICIAL', { id: id(), code: 'INICIAL', name: 'Nombre propio', isActive: false }]]);
  const grades = new Map();
  const db = {
    educationLevel: { upsert: jest.fn(async ({ where, create }) => {
      if (!saved.has(where.code)) saved.set(where.code, { id: id(), ...create, isActive: true });
      return saved.get(where.code);
    }) },
    grade: { upsert: jest.fn(async ({ where, create }) => {
      const key = `${where.educationLevelId_order.educationLevelId}-${where.educationLevelId_order.order}`;
      if (!grades.has(key)) grades.set(key, { id: id(), ...create, isActive: true });
      return grades.get(key);
    }) },
  };
  await seedAcademic(db);
  const first = [...grades.values()].find((g) => g.educationLevelId === saved.get('INICIAL').id);
  first.name = 'Personalizado';
  first.isActive = false;
  await seedAcademic(db);
  expect(saved.size).toBe(3);
  expect(grades.size).toBe(14);
  expect(saved.get('INICIAL')).toMatchObject({ name: 'Nombre propio', isActive: false });
  expect(first).toMatchObject({ name: 'Personalizado', isActive: false });
});
