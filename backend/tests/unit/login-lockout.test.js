const request = require('supertest');
const bcrypt = require('bcrypt');
const { createHash, randomBytes, randomUUID } = require('node:crypto');
const { MemoryStore } = require('express-rate-limit');

jest.mock('../../src/config/prisma', () => ({ user: { findUnique: jest.fn() } }));

const prisma = require('../../src/config/prisma');
const env = require('../../src/config/env');
const { createApp } = require('../../src/app');

const validPassword = randomBytes(24).toString('base64url');
const badPassword = randomBytes(24).toString('base64url');
const firstEmail = 'cuenta-uno@example.invalid';
const secondEmail = 'cuenta-dos@example.invalid';
const blockedMessage = { message: 'Demasiados intentos. Inténtalo más tarde' };
let users;
let app;
let now;
let dateSpy;

function target(hops = 0) {
  const previous = env.TRUST_PROXY_HOPS;
  env.TRUST_PROXY_HOPS = hops;
  try { return createApp(); } finally { env.TRUST_PROXY_HOPS = previous; }
}
function attempt(email, password, forwardedFor = '192.0.2.10', server = app) {
  return request(server).post('/api/auth/login')
    .set('X-Forwarded-For', forwardedFor).send({ email, password });
}
function safeError(response) {
  expect(response.status).not.toBe(500);
  expect(JSON.stringify(response.body)).not.toMatch(/passwordHash|tokenVersion|stack|SELECT|INSERT|eyJ[A-Za-z0-9_-]+/i);
  expect(response.body).not.toHaveProperty('token');
  expect(JSON.stringify({ body: response.body, headers: response.headers })).not.toContain(firstEmail);
  expect(JSON.stringify(response.headers)).not.toContain(createHash('sha256').update(firstEmail).digest('hex'));
  expect(response.headers).not.toHaveProperty('ratelimit-policy');
}

beforeAll(async () => {
  const passwordHash = await bcrypt.hash(validPassword, 10);
  users = new Map([firstEmail, secondEmail].map((email) => [email, {
    id: randomUUID(), email, passwordHash, firstName: 'Cuenta', lastName: 'Local',
    role: 'ADMIN', isActive: true, tokenVersion: 0,
  }]));
});
beforeEach(() => {
  now = new Date('2026-10-12T12:00:00.000Z').getTime();
  dateSpy = jest.spyOn(Date, 'now').mockImplementation(() => now);
  prisma.user.findUnique.mockImplementation(async ({ where }) => users.get(where.email) || null);
  app = target(0);
});
afterEach(() => dateSpy.mockRestore());

test('bloqueo exacto, contraseña correcta rechazada durante toda la ventana y acceso posterior', async () => {
  for (let n = 0; n < 5; n += 1) {
    const response = await attempt(firstEmail, badPassword).expect(401);
    safeError(response);
  }
  const atLimit = await attempt(firstEmail, validPassword).expect(429);
  expect(atLimit.body).toEqual(blockedMessage);
  expect(Number(atLimit.headers['retry-after'])).toBe(900);
  expect(prisma.user.findUnique).toHaveBeenCalledTimes(5);
  safeError(atLimit);
  now += 15 * 60 * 1000 - 1000;
  const beforeExpiry = await attempt(firstEmail, validPassword).expect(429);
  expect(Number(beforeExpiry.headers['retry-after'])).toBe(1);
  expect(prisma.user.findUnique).toHaveBeenCalledTimes(5);
  safeError(beforeExpiry);
  now += 1001;
  const afterExpiry = await attempt(firstEmail, validPassword).expect(200);
  expect(afterExpiry.body.user.email).toBe(firstEmail);
  expect(prisma.user.findUnique).toHaveBeenCalledTimes(6);
});

test('un login correcto ordinario no consume intentos fallidos', async () => {
  await attempt(firstEmail, badPassword).expect(401);
  await attempt(firstEmail, validPassword).expect(200);
  for (let n = 0; n < 4; n += 1) await attempt(firstEmail, badPassword).expect(401);
  await attempt(firstEmail, validPassword).expect(429);
});

test('29 fallos por IP aún pasan, el 30.º establece el bloqueo y el 31.º responde 429', async () => {
  const proxyApp = target(1);
  const ip = '198.51.100.25';
  for (let n = 0; n < 29; n += 1) {
    await attempt(`spray-${n}@example.invalid`, badPassword, `192.0.2.${n + 1}, ${ip}`, proxyApp).expect(401);
  }
  await attempt('spray-29@example.invalid', badPassword, `203.0.113.1, ${ip}`, proxyApp).expect(401);
  const blocked = await attempt(secondEmail, validPassword, `192.0.2.200, ${ip}`, proxyApp).expect(429);
  expect(blocked.body).toEqual(blockedMessage);
  expect(Number(blocked.headers['retry-after'])).toBe(900);
  expect(prisma.user.findUnique).toHaveBeenCalledTimes(30);
  safeError(blocked);
  await attempt(secondEmail, validPassword, '192.0.2.200, 198.51.100.26', proxyApp).expect(200);
  now += 15 * 60 * 1000 - 1000;
  const beforeExpiry = await attempt(secondEmail, validPassword, `192.0.2.200, ${ip}`, proxyApp).expect(429);
  expect(Number(beforeExpiry.headers['retry-after'])).toBe(1);
  now += 1001;
  await attempt(secondEmail, validPassword, `192.0.2.200, ${ip}`, proxyApp).expect(200);
});

test('un acceso correcto no consume tampoco el contador general por IP', async () => {
  for (let n = 0; n < 3; n += 1) await attempt(secondEmail, validPassword).expect(200);
  for (let n = 0; n < 30; n += 1) {
    await attempt(`spray-${n}@example.invalid`, badPassword, `203.0.113.${n + 1}`).expect(401);
  }
  await attempt(secondEmail, validPassword, '192.0.2.200').expect(429);
});

test('Retry-After corresponde al límite que rechaza cuando ambas ventanas difieren', async () => {
  const proxyApp = target(1);
  const accountIp = '198.51.100.25';
  const sprayingIp = '198.51.100.26';
  for (let n = 0; n < 5; n += 1) {
    await attempt(firstEmail, badPassword, `192.0.2.${n + 1}, ${accountIp}`, proxyApp).expect(401);
  }
  now += 5 * 60 * 1000;
  for (let n = 0; n < 30; n += 1) {
    await attempt(`spray-${n}@example.invalid`, badPassword, `192.0.2.${n + 1}, ${sprayingIp}`, proxyApp).expect(401);
  }
  const ipBlocked = await attempt(firstEmail, validPassword, `192.0.2.100, ${sprayingIp}`, proxyApp).expect(429);
  expect(ipBlocked.body).toEqual(blockedMessage);
  expect(Number(ipBlocked.headers['retry-after'])).toBe(900);
  const accountBlocked = await attempt(firstEmail, validPassword, `192.0.2.100, ${accountIp}`, proxyApp).expect(429);
  expect(accountBlocked.body).toEqual(ipBlocked.body);
  expect(Number(accountBlocked.headers['retry-after'])).toBe(600);
  safeError(ipBlocked); safeError(accountBlocked);
});

test('si ambos límites están bloqueados hay un solo 429 genérico', async () => {
  for (let n = 0; n < 5; n += 1) await attempt(firstEmail, badPassword).expect(401);
  for (let n = 0; n < 25; n += 1) await attempt(`spray-${n}@example.invalid`, badPassword).expect(401);
  const blocked = await attempt(firstEmail, validPassword).expect(429);
  expect(blocked.body).toEqual(blockedMessage);
  expect(Number(blocked.headers['retry-after'])).toBe(900);
  safeError(blocked);
});

test('solicitudes simultáneas no superan los máximos por cuenta ni por IP', async () => {
  const accountResults = await Promise.all(Array.from({ length: 12 }, () => attempt(firstEmail, badPassword)));
  expect(accountResults.filter((result) => result.status === 401)).toHaveLength(5);
  expect(accountResults.filter((result) => result.status === 429)).toHaveLength(7);
  accountResults.forEach(safeError);

  const otherApp = target(0);
  const ipResults = await Promise.all(Array.from({ length: 40 }, (_, n) =>
    attempt(`parallel-${n}@example.invalid`, badPassword, '203.0.113.8', otherApp)));
  expect(ipResults.filter((result) => result.status === 401)).toHaveLength(30);
  expect(ipResults.filter((result) => result.status === 429)).toHaveLength(10);
  ipResults.forEach(safeError);
});

test('MemoryStore retira las claves antiguas tras dos rotaciones de ventana', async () => {
  const store = new MemoryStore();
  store.init({ windowMs: 15 * 60 * 1000 });
  try {
    await store.increment('clave-temporal');
    expect(await store.get('clave-temporal')).toBeDefined();
    store.clearExpired();
    expect(await store.get('clave-temporal')).toBeDefined();
    store.clearExpired();
    expect(await store.get('clave-temporal')).toBeUndefined();
  } finally { store.shutdown(); }
});

test('mayúsculas y espacios no cambian el contador; otra cuenta no comparte bloqueo', async () => {
  for (let n = 0; n < 5; n += 1) {
    await attempt(n % 2 ? ` ${firstEmail.toUpperCase()} ` : firstEmail, badPassword).expect(401);
  }
  await attempt(` ${firstEmail.toUpperCase()} `, validPassword).expect(429);
  await attempt(secondEmail, validPassword).expect(200);
});

test('X-Forwarded-For falso no evade bloqueo local ni el de una cuenta con proxy de un salto', async () => {
  const proxyApp = target(1);
  for (let n = 0; n < 5; n += 1) {
    await attempt(firstEmail, badPassword, `192.0.2.${10 + n}, 198.51.100.25`, proxyApp).expect(401);
  }
  await attempt(firstEmail, validPassword, '203.0.113.20, 198.51.100.26', proxyApp).expect(429);
  for (let n = 0; n < 5; n += 1) await attempt(secondEmail, badPassword, `203.0.113.${10 + n}`).expect(401);
  await attempt(secondEmail, validPassword, '192.0.2.30').expect(429);
});

test('cuenta inexistente y contraseña incorrecta responden igual, sin secretos', async () => {
  const unknown = await attempt('inexistente@example.invalid', badPassword).expect(401);
  const wrong = await attempt(firstEmail, badPassword).expect(401);
  expect(unknown.body).toEqual(wrong.body);
  safeError(unknown); safeError(wrong);
});

test('los intentos rechazados no registran correos, claves ni hashes', async () => {
  const messages = [];
  const log = jest.spyOn(console, 'log').mockImplementation((...args) => messages.push(args));
  const warn = jest.spyOn(console, 'warn').mockImplementation((...args) => messages.push(args));
  const error = jest.spyOn(console, 'error').mockImplementation((...args) => messages.push(args));
  try {
    for (let n = 0; n < 5; n += 1) await attempt(firstEmail, badPassword).expect(401);
    const blocked = await attempt(firstEmail, validPassword).expect(429);
    safeError(blocked);
    const output = JSON.stringify(messages);
    expect(output).not.toContain(firstEmail);
    expect(output).not.toContain(createHash('sha256').update(firstEmail).digest('hex'));
    expect(output).not.toContain(validPassword);
    expect(output).not.toContain(badPassword);
  } finally { log.mockRestore(); warn.mockRestore(); error.mockRestore(); }
});
