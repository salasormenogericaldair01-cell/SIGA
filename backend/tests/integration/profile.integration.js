const request = require('supertest');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('node:crypto');
const prisma = require('../../src/config/prisma');
const { createApp } = require('../../src/app');

const app = createApp();
let testUserId;
let targetVerified = false;

beforeAll(async () => {
  const url = new URL(process.env.DATABASE_URL);
  const [target] = await prisma.$queryRaw`SELECT current_database() AS name, inet_server_port() AS port`;
  if (target.name !== 'siga_test' || target.port !== 5433 ||
    !['127.0.0.1', 'localhost'].includes(url.hostname) || url.port !== '5433' || url.pathname !== '/siga_test') {
    throw new Error('Esta integración solo puede escribir en siga_test en localhost:5433');
  }
  targetVerified = true;
  const user = await prisma.user.create({ data: {
    email: `profile-${randomUUID()}@test.invalid`,
    passwordHash: await bcrypt.hash('FraseTemporalSegura123', 10),
    firstName: 'Nombre', lastName: 'Inicial', role: 'ESTUDIANTE',
  } });
  testUserId = user.id;
});

afterAll(async () => {
  if (targetVerified && testUserId) await prisma.user.delete({ where: { id: testUserId } });
  await prisma.$disconnect();
});

test('PostgreSQL: solo cambia el nombre propio; conserva credenciales, rol y versión', async () => {
  const before = await prisma.user.findUnique({ where: { id: testUserId } });
  const token = jwt.sign({ tokenVersion: before.tokenVersion }, process.env.JWT_SECRET, {
    algorithm: 'HS256', subject: before.id, expiresIn: '1h',
  });
  const bearer = { Authorization: `Bearer ${token}` };
  await request(app).patch('/api/auth/me').send({ firstName: 'Ajeno' }).expect(401);
  await request(app).patch('/api/auth/me').set(bearer)
    .send({ firstName: 'Nuevo', role: 'ADMIN' }).expect(400);
  const response = await request(app).patch('/api/auth/me').set(bearer)
    .send({ firstName: '  Nombre actualizado  ', lastName: '  Propio  ' }).expect(200);
  expect(response.body.user).toMatchObject({
    id: before.id, email: before.email, firstName: 'Nombre actualizado',
    lastName: 'Propio', role: 'ESTUDIANTE',
  });
  expect(JSON.stringify(response.body)).not.toMatch(/passwordHash|tokenVersion|isActive/);
  const after = await prisma.user.findUnique({ where: { id: testUserId } });
  expect(after.passwordHash).toBe(before.passwordHash);
  expect(after.email).toBe(before.email);
  expect(after.role).toBe(before.role);
  expect(after.isActive).toBe(before.isActive);
  expect(after.tokenVersion).toBe(before.tokenVersion);
  expect((await request(app).get('/api/auth/me').set(bearer).expect(200)).body.user.firstName)
    .toBe('Nombre actualizado');
});
