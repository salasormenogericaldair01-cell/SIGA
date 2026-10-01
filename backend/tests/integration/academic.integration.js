const request = require('supertest');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('node:crypto');
const prisma = require('../../src/config/prisma');
const { createApp } = require('../../src/app');

const app = createApp();
const ids = { users: [], levels: [], grades: [], periods: [], sections: [] };
let verified = false;

function auth(user) {
  const token = jwt.sign({ tokenVersion: user.tokenVersion }, process.env.JWT_SECRET, { algorithm: 'HS256', subject: user.id, expiresIn: '1h' });
  return `Bearer ${token}`;
}

beforeAll(async () => {
  const rows = await prisma.$queryRaw`SELECT current_database() AS name, inet_server_addr()::text AS host, inet_server_port() AS port`;
  const url = new URL(process.env.DATABASE_URL);
  if (rows[0].name !== 'siga_test' || rows[0].port !== 5433 || !['127.0.0.1', 'localhost'].includes(url.hostname) || url.pathname !== '/siga_test') {
    throw new Error('La integración académica exige siga_test en localhost:5433');
  }
  verified = true;
});

afterAll(async () => {
  if (verified) {
    await prisma.section.deleteMany({ where: { id: { in: ids.sections } } });
    await prisma.grade.deleteMany({ where: { id: { in: ids.grades } } });
    await prisma.academicPeriod.deleteMany({ where: { id: { in: ids.periods } } });
    await prisma.educationLevel.deleteMany({ where: { id: { in: ids.levels } } });
    await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
  }
  await prisma.$disconnect();
});

test('PostgreSQL real: permisos, nivel → grado → periodo → sección, duplicados, filtros e inactivos', async () => {
  const admin = await prisma.user.create({ data: { email: `admin-academic-${randomUUID()}@test.edu`, passwordHash: 'no-login', firstName: 'Admin', lastName: 'Test', role: 'ADMIN' } });
  ids.users.push(admin.id);
  const secretary = await prisma.user.create({ data: { email: `secretary-academic-${randomUUID()}@test.edu`, passwordHash: 'no-login', firstName: 'Secretaria', lastName: 'Test', role: 'SECRETARIA' } });
  ids.users.push(secretary.id);
  const teacher = await prisma.user.create({ data: { email: `teacher-academic-${randomUUID()}@test.edu`, passwordHash: 'no-login', firstName: 'Docente', lastName: 'Test', role: 'DOCENTE' } });
  ids.users.push(teacher.id);

  await request(app).get('/api/education-levels').expect(401);
  await request(app).get('/api/education-levels').set('Authorization', auth(teacher)).expect(403);

  const level = await request(app).post('/api/education-levels').set('Authorization', auth(admin))
    .send({ code: 'INICIAL', name: ' Inicial ' }).expect(201);
  ids.levels.push(level.body.item.id);
  const grade = await request(app).post('/api/grades').set('Authorization', auth(secretary))
    .send({ educationLevelId: level.body.item.id, name: '3 años', order: 3 }).expect(201);
  ids.grades.push(grade.body.item.id);
  const uniqueName = `Periodo ${randomUUID()}`;
  const period = await request(app).post('/api/academic-periods').set('Authorization', auth(admin))
    .send({ name: uniqueName, startDate: '2026-03-01', endDate: '2026-12-01' }).expect(201);
  ids.periods.push(period.body.item.id);
  const section = await request(app).post('/api/sections').set('Authorization', auth(secretary))
    .send({ gradeId: grade.body.item.id, academicPeriodId: period.body.item.id, name: ' a ' }).expect(201);
  ids.sections.push(section.body.item.id);
  expect(section.body.item.name).toBe('A');

  const nextPeriod = await request(app).post('/api/academic-periods').set('Authorization', auth(admin))
    .send({ name: `Periodo ${randomUUID()}`, startDate: '2027-03-01', endDate: '2027-12-01' }).expect(201);
  ids.periods.push(nextPeriod.body.item.id);
  const nextSection = await request(app).post('/api/sections').set('Authorization', auth(admin))
    .send({ gradeId: grade.body.item.id, academicPeriodId: nextPeriod.body.item.id, name: 'A' }).expect(201);
  ids.sections.push(nextSection.body.item.id);

  await request(app).post('/api/grades').set('Authorization', auth(admin))
    .send({ educationLevelId: level.body.item.id, name: 'Duplicado', order: 3 }).expect(409);
  await request(app).post('/api/sections').set('Authorization', auth(admin))
    .send({ gradeId: grade.body.item.id, academicPeriodId: period.body.item.id, name: 'a' }).expect(409);
  const filtered = await request(app).get(`/api/sections?gradeId=${grade.body.item.id}&academicPeriodId=${period.body.item.id}&isActive=true`)
    .set('Authorization', auth(admin)).expect(200);
  expect(filtered.body.items.map((item) => item.id)).toContain(section.body.item.id);
  expect(filtered.body.items.map((item) => item.id)).not.toContain(nextSection.body.item.id);

  await request(app).patch(`/api/academic-periods/${period.body.item.id}`).set('Authorization', auth(admin))
    .send({ endDate: '2026-02-01' }).expect(400);
  await request(app).patch(`/api/education-levels/${level.body.item.id}`).set('Authorization', auth(admin))
    .send({ isActive: false }).expect(200);
  await request(app).post('/api/grades').set('Authorization', auth(admin))
    .send({ educationLevelId: level.body.item.id, name: '4 años', order: 4 }).expect(400);
  await request(app).post('/api/sections').set('Authorization', auth(admin))
    .send({ gradeId: grade.body.item.id, academicPeriodId: period.body.item.id, name: 'B' }).expect(400);
  await request(app).get(`/api/sections/${section.body.item.id}`).set('Authorization', auth(admin)).expect(200);
  expect(await prisma.section.count({ where: { id: section.body.item.id } })).toBe(1);
});
