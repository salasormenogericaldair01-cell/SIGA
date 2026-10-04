const request = require('supertest');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('node:crypto');
const prisma = require('../../src/config/prisma');
const { createApp } = require('../../src/app');

const app = createApp();
const ids = { users: [], courses: [] };
const users = {};
const injection = "' OR 1=1 --";
let verified = false;

function bearer(user, options = {}) {
  const token = jwt.sign({ tokenVersion: options.version ?? user.tokenVersion }, process.env.JWT_SECRET, {
    algorithm: 'HS256', subject: user.id, expiresIn: options.expiresIn || '1h',
  });
  return `Bearer ${token}`;
}

function call(method, path, user, body) {
  const result = request(app)[method](path).set('Authorization', bearer(user));
  return body === undefined ? result : result.send(body);
}

async function safe(pending, status) {
  const response = await pending.expect(status);
  expect(JSON.stringify(response.body)).not.toMatch(/passwordHash|tokenVersion|"token"\s*:|PrismaClient|"stack"\s*:|postgresql:\/\/|SELECT\s+.+FROM/i);
  return response;
}

beforeAll(async () => {
  const url = new URL(process.env.DATABASE_URL);
  const [target] = await prisma.$queryRaw`SELECT current_database() AS name, inet_server_port() AS port`;
  if (!['127.0.0.1', 'localhost'].includes(url.hostname) || url.port !== '5433'
      || url.pathname !== '/siga_test' || target.name !== 'siga_test' || target.port !== 5433) {
    throw new Error('Estas pruebas requieren exclusivamente siga_test en localhost:5433');
  }
  verified = true;
  for (const role of ['ADMIN', 'SECRETARIA', 'DOCENTE', 'ESTUDIANTE']) {
    const user = await prisma.user.create({ data: {
      email: `contract-${randomUUID()}@test.invalid`, passwordHash: 'not-used-for-login',
      firstName: 'Contrato', lastName: role, role,
    } });
    users[role] = user;
    ids.users.push(user.id);
  }
});

afterAll(async () => {
  if (verified) {
    await prisma.course.deleteMany({ where: { id: { in: ids.courses } } });
    await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
  }
  await prisma.$disconnect();
});

test('contrato: rutas, envoltorios y permisos de los cuatro roles', async () => {
  const matrix = [
    ['/users', ['ADMIN'], 'users'],
    ['/education-levels', ['ADMIN', 'SECRETARIA'], 'items'],
    ['/grades', ['ADMIN', 'SECRETARIA'], 'items'],
    ['/academic-periods', ['ADMIN', 'SECRETARIA'], 'items'],
    ['/sections', ['ADMIN', 'SECRETARIA'], 'items'],
    ['/students', ['ADMIN', 'SECRETARIA'], 'data'],
    ['/teachers', ['ADMIN', 'SECRETARIA'], 'data'],
    ['/enrollments', ['ADMIN', 'SECRETARIA'], 'data'],
    ['/courses', ['ADMIN', 'SECRETARIA', 'DOCENTE'], 'data'],
    ['/teaching-assignments', ['ADMIN', 'SECRETARIA', 'DOCENTE'], 'data'],
    ['/grade-records', ['ADMIN', 'SECRETARIA', 'DOCENTE', 'ESTUDIANTE'], 'data'],
    ['/attendance-records', ['ADMIN', 'SECRETARIA', 'DOCENTE', 'ESTUDIANTE'], 'data'],
  ];
  for (const [path, roles, key] of matrix) {
    await request(app).get(`/api${path}`).expect(401);
    for (const [role, user] of Object.entries(users)) {
      const result = await call('get', `/api${path}`, user);
      // Los perfiles son obligatorios para acceder a registros personales.
      const expected = roles.includes(role)
        ? (['DOCENTE', 'ESTUDIANTE'].includes(role) && ['/teaching-assignments', '/grade-records', '/attendance-records'].includes(path) ? 403 : 200)
        : 403;
      expect(result.status).toBe(expected);
      expect(JSON.stringify(result.body)).not.toMatch(/passwordHash|tokenVersion|"token"\s*:|PrismaClient|"stack"\s*:|postgresql:\/\/|SELECT\s+.+FROM/i);
      if (expected === 200) {
        expect(Array.isArray(result.body[key])).toBe(true);
        if (key === 'data') expect(result.body.pagination).toEqual(expect.objectContaining({ page: 1, limit: 20, total: expect.any(Number) }));
        expect(JSON.stringify(result.body)).not.toMatch(/passwordHash|tokenVersion/);
      }
    }
  }
  expect((await request(app).get('/api/health').expect(200)).body).toMatchObject({ status: 'ok' });
});

test('inyección y elevación rechazadas sin escritura inesperada', async () => {
  const before = await prisma.course.count();
  const beforeUser = await prisma.user.findUnique({ where: { id: users.ESTUDIANTE.id }, select: { role: true, isActive: true, tokenVersion: true, passwordHash: true, firstName: true, lastName: true } });
  await safe(request(app).post('/api/auth/login').send({ email: injection, password: 'anything' }), 400);
  await call('get', `/api/courses?search=${encodeURIComponent(injection)}`, users.ADMIN).expect(200);
  await call('get', `/api/students?search=${encodeURIComponent(injection)}`, users.ADMIN).expect(200);
  await safe(call('get', `/api/courses?isActive=${encodeURIComponent(injection)}`, users.ADMIN), 400);
  await safe(call('get', `/api/courses/${encodeURIComponent(injection)}`, users.ADMIN), 400);
  await safe(call('post', '/api/courses', users.ADMIN, { code: injection, name: 'Curso' }), 400);
  await safe(call('post', '/api/courses', users.ADMIN, { code: 'INJ', name: injection, role: 'ADMIN' }), 400);
  await safe(call('patch', '/api/auth/me', users.ESTUDIANTE, { role: 'ADMIN' }), 400);
  await safe(call('patch', '/api/auth/me', users.ESTUDIANTE, { tokenVersion: 0 }), 400);
  await safe(call('patch', '/api/auth/me', users.ESTUDIANTE, { passwordHash: 'tampered' }), 400);
  await safe(call('patch', '/api/auth/me', users.ESTUDIANTE, { isActive: true }), 400);
  await safe(call('post', '/api/users', users.SECRETARIA, { role: 'ADMIN' }), 403);
  await safe(call('get', `/api/grade-records/${randomUUID()}`, users.ADMIN), 404);
  expect(await prisma.course.count()).toBe(before);
  expect(await prisma.user.findUnique({ where: { id: users.ESTUDIANTE.id }, select: { role: true, isActive: true, tokenVersion: true, passwordHash: true, firstName: true, lastName: true } })).toEqual(beforeUser);
});

test('contrato de creación, duplicado, detalle y restricción de escritura', async () => {
  const code = `CONTRACT-${randomUUID().slice(0, 8).toUpperCase()}`;
  const created = await call('post', '/api/courses', users.ADMIN, { code, name: 'Contrato' }).expect(201);
  ids.courses.push(created.body.data.id);
  expect(created.body.data).toMatchObject({ code, name: 'Contrato' });
  await safe(call('post', '/api/courses', users.ADMIN, { code, name: 'Duplicado' }), 409);
  await call('get', `/api/courses/${created.body.data.id}`, users.DOCENTE).expect(200);
  await safe(call('patch', `/api/courses/${created.body.data.id}`, users.DOCENTE, { name: 'No autorizado' }), 403);
  await safe(call('get', `/api/courses/${randomUUID()}`, users.ADMIN), 404);
  await safe(call('get', '/api/courses?page=0', users.ADMIN), 400);
  expect((await prisma.course.findUnique({ where: { id: created.body.data.id } })).name).toBe('Contrato');
});

test('JWT alterado, expirado, revocado e inactivo; cabeceras, CORS y límite de body', async () => {
  const user = users.SECRETARIA;
  const beforeCount = await prisma.user.count();
  const beforeHash = (await prisma.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } })).passwordHash;
  const valid = bearer(user);
  await request(app).get('/api/auth/me').set('Authorization', valid).expect(200);
  await safe(request(app).get('/api/auth/me').set('Authorization', `${valid}x`), 401);
  await safe(request(app).get('/api/auth/me').set('Authorization', bearer(user, { expiresIn: '-1s' })), 401);
  const wrongKey = jwt.sign({ tokenVersion: 0 }, 'an-unrelated-signing-key', { algorithm: 'HS256', subject: user.id, expiresIn: '1h' });
  await safe(request(app).get('/api/auth/me').set('Authorization', `Bearer ${wrongKey}`), 401);
  await prisma.user.update({ where: { id: user.id }, data: { tokenVersion: { increment: 1 } } });
  await safe(request(app).get('/api/auth/me').set('Authorization', valid), 401);
  const current = await prisma.user.findUnique({ where: { id: user.id } });
  await request(app).get('/api/auth/me').set('Authorization', bearer(current)).expect(200);
  await prisma.user.update({ where: { id: user.id }, data: { isActive: false } });
  await safe(request(app).get('/api/auth/me').set('Authorization', bearer(current)), 401);

  const allowedOrigin = process.env.CORS_ORIGIN;
  const allowed = await request(app).get('/api/health').set('Origin', allowedOrigin).expect(200);
  expect(allowed.headers['access-control-allow-origin']).toBe(allowedOrigin);
  const denied = await safe(request(app).get('/api/health').set('Origin', 'https://unauthorized.invalid'), 403);
  expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  expect(allowed.headers['x-content-type-options']).toBe('nosniff');
  expect(allowed.headers['x-powered-by']).toBeUndefined();
  await safe(request(app).post('/api/auth/login').send({ filler: 'x'.repeat(101 * 1024) }), 413);
  expect(await prisma.user.count()).toBe(beforeCount);
  expect((await prisma.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } })).passwordHash).toBe(beforeHash);
});

test('login tiene límite local de intentos', async () => {
  const limitedApp = createApp();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await safe(request(limitedApp).post('/api/auth/login').send({ email: 'nadie@invalid.example', password: 'incorrecta' }), 401);
  }
  await safe(request(limitedApp).post('/api/auth/login').send({ email: 'nadie@invalid.example', password: 'incorrecta' }), 429);
});
