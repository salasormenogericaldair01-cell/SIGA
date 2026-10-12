const request = require('supertest');
const bcrypt = require('bcrypt');
const { randomBytes, randomUUID } = require('node:crypto');
const prisma = require('../../src/config/prisma');
const { createApp } = require('../../src/app');

const app = createApp();
const password = randomBytes(24).toString('base64url');
const wrongPassword = randomBytes(24).toString('base64url');
const ids = [];
let verified = false;
let first;
let second;

beforeAll(async () => {
  const url = new URL(process.env.DATABASE_URL);
  const [target] = await prisma.$queryRaw`SELECT current_database() AS name, inet_server_port() AS port`;
  if (url.hostname !== '127.0.0.1' || url.port !== '5433' || url.pathname !== '/siga_test'
      || target.name !== 'siga_test' || target.port !== 5433 || app.get('trust proxy') !== 0) {
    throw new Error('Esta prueba exige siga_test en 127.0.0.1:5433 y cero saltos de proxy');
  }
  verified = true;
  const passwordHash = await bcrypt.hash(password, 10);
  for (let n = 0; n < 2; n += 1) {
    const user = await prisma.user.create({ data: {
      email: `lockout-${randomUUID()}@example.invalid`, passwordHash,
      firstName: 'Cuenta', lastName: 'Local', role: 'DOCENTE',
    } });
    ids.push(user.id);
    if (n === 0) first = user; else second = user;
  }
});

afterAll(async () => {
  if (verified && ids.length) await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await prisma.$disconnect();
});

test('PostgreSQL: el bloqueo impide credenciales correctas y no afecta a otra cuenta', async () => {
  for (let n = 0; n < 5; n += 1) {
    const response = await request(app).post('/api/auth/login')
      .send({ email: n % 2 ? ` ${first.email.toUpperCase()} ` : first.email, password: wrongPassword }).expect(401);
    expect(response.body).toEqual({ message: 'Credenciales inválidas' });
  }
  const blocked = await request(app).post('/api/auth/login')
    .set('X-Forwarded-For', '203.0.113.8').send({ email: first.email, password }).expect(429);
  expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
  expect(JSON.stringify(blocked.body)).not.toMatch(/passwordHash|tokenVersion|"token"|stack|SELECT|PrismaClient/i);
  const other = await request(app).post('/api/auth/login')
    .send({ email: second.email, password }).expect(200);
  expect(other.body.user.id).toBe(second.id);
  const [savedFirst, savedSecond] = await Promise.all(ids.map((id) => prisma.user.findUnique({ where: { id } })));
  expect(savedFirst.isActive).toBe(true);
  expect(savedSecond.isActive).toBe(true);
  expect(savedFirst.passwordHash).toBe(savedSecond.passwordHash);
});

test('PostgreSQL: 30 correos distintos activan el límite general para la solicitud siguiente', async () => {
  const sprayingApp = createApp();
  for (let n = 0; n < 30; n += 1) {
    const response = await request(sprayingApp).post('/api/auth/login')
      .set('X-Forwarded-For', `203.0.113.${n + 1}`)
      .send({ email: `spray-${n}-${randomUUID()}@example.invalid`, password: wrongPassword }).expect(401);
    expect(response.body).toEqual({ message: 'Credenciales inválidas' });
  }
  const blocked = await request(sprayingApp).post('/api/auth/login')
    .set('X-Forwarded-For', '192.0.2.200')
    .send({ email: second.email, password }).expect(429);
  expect(blocked.body).toEqual({ message: 'Demasiados intentos. Inténtalo más tarde' });
  expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
  expect(JSON.stringify({ body: blocked.body, headers: blocked.headers }))
    .not.toMatch(/passwordHash|tokenVersion|"token"|stack|SELECT|PrismaClient|account:/i);
});
