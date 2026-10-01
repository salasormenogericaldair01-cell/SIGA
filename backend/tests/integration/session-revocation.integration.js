const request = require('supertest');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('node:crypto');
const prisma = require('../../src/config/prisma');
const { createApp } = require('../../src/app');

const app = createApp();
const firstPassword = 'FraseInicialSegura123';
const secondPassword = 'FraseRenovadaSegura123';
let testUserId;
let targetVerified = false;

beforeAll(async () => {
  const url = new URL(process.env.DATABASE_URL);
  const target = await prisma.$queryRaw`SELECT current_database() AS name, inet_server_port() AS port`;
  if (target[0].name !== 'siga_test' || target[0].port !== 5433 ||
      !['127.0.0.1', 'localhost'].includes(url.hostname) || url.port !== '5433' || url.pathname !== '/siga_test') {
    throw new Error('La integración de sesiones exige siga_test en localhost:5433');
  }
  targetVerified = true;
  const user = await prisma.user.create({ data: {
    email: `session-${randomUUID()}@test.invalid`,
    passwordHash: await bcrypt.hash(firstPassword, 10),
    firstName: 'Sesión', lastName: 'Prueba', role: 'DOCENTE',
  } });
  testUserId = user.id;
});

afterAll(async () => {
  if (targetVerified && testUserId) await prisma.user.delete({ where: { id: testUserId } });
  await prisma.$disconnect();
});

test('PostgreSQL: cambio atómico, revocación y concurrencia', async () => {
  const user = await prisma.user.findUnique({ where: { id: testUserId } });
  const initialLogin = await request(app).post('/api/auth/login').send({ email: user.email, password: firstPassword }).expect(200);
  const oldToken = initialLogin.body.token;
  const bearer = (token) => ({ Authorization: `Bearer ${token}` });
  const oldHash = user.passwordHash;

  await request(app).post('/api/auth/change-password').set(bearer(oldToken))
    .send({ currentPassword: 'ContraseñaIncorrecta123', newPassword: secondPassword }).expect(400);
  await request(app).post('/api/auth/change-password').set(bearer(oldToken))
    .send({ currentPassword: firstPassword, newPassword: 'corta' }).expect(400);
  let saved = await prisma.user.findUnique({ where: { id: testUserId } });
  expect(saved.passwordHash).toBe(oldHash);
  expect(saved.tokenVersion).toBe(0);

  const legacyToken = jwt.sign({}, process.env.JWT_SECRET, { algorithm: 'HS256', subject: user.id, expiresIn: '1h' });
  await request(app).get('/api/auth/me').set(bearer(legacyToken)).expect(401);

  const changed = await request(app).post('/api/auth/change-password').set(bearer(oldToken))
    .send({ currentPassword: firstPassword, newPassword: secondPassword }).expect(200);
  expect(changed.body).not.toHaveProperty('token');
  saved = await prisma.user.findUnique({ where: { id: testUserId } });
  expect(saved.tokenVersion).toBe(1);
  expect(await bcrypt.compare(secondPassword, saved.passwordHash)).toBe(true);
  await request(app).get('/api/auth/me').set(bearer(oldToken)).expect(401);
  await request(app).post('/api/auth/login').send({ email: user.email, password: firstPassword }).expect(401);
  const nextLogin = await request(app).post('/api/auth/login').send({ email: user.email, password: secondPassword }).expect(200);
  const nextToken = nextLogin.body.token;
  await request(app).get('/api/auth/me').set(bearer(nextToken)).expect(200);

  const changes = await Promise.all([
    request(app).post('/api/auth/change-password').set(bearer(nextToken))
      .send({ currentPassword: secondPassword, newPassword: 'TerceraFraseSeguraA123' }),
    request(app).post('/api/auth/change-password').set(bearer(nextToken))
      .send({ currentPassword: secondPassword, newPassword: 'TerceraFraseSeguraB123' }),
  ]);
  expect(changes.map((response) => response.status).sort()).toEqual([200, 401]);
  saved = await prisma.user.findUnique({ where: { id: testUserId } });
  expect(saved.tokenVersion).toBe(2);
  await request(app).get('/api/auth/me').set(bearer(nextToken)).expect(401);
});
