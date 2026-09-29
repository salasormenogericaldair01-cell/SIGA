jest.mock('../src/config/prisma', () => ({
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
}));

const request = require('supertest');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('node:crypto');
const prisma = require('../src/config/prisma');
const { createApp } = require('../src/app');

const secret = process.env.JWT_SECRET;
const validPassword = 'UnaFraseSegura123';
let app;
let users;
let admin;
let docente;
let estudiante;

function selected(user, select) {
  if (!user) return null;
  if (!select) return { ...user };
  return Object.fromEntries(Object.keys(select).filter((key) => select[key]).map((key) => [key, user[key]]));
}

function tokenFor(user, payload = {}) {
  return jwt.sign(payload, secret, { algorithm: 'HS256', subject: user.id, expiresIn: '1h' });
}

function auth(user, payload = {}) {
  return { Authorization: `Bearer ${tokenFor(user, payload)}` };
}

async function makeUser(role, email, isActive = true) {
  return {
    id: randomUUID(),
    email,
    passwordHash: await bcrypt.hash(validPassword, 10),
    firstName: 'Nombre',
    lastName: 'Apellido',
    role,
    isActive,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

beforeEach(async () => {
  jest.clearAllMocks();
  users = new Map();
  admin = await makeUser('ADMIN', 'admin@colegio.edu.pe');
  docente = await makeUser('DOCENTE', 'docente@colegio.edu.pe');
  estudiante = await makeUser('ESTUDIANTE', 'estudiante@colegio.edu.pe');
  for (const user of [admin, docente, estudiante]) users.set(user.id, user);

  prisma.user.findUnique.mockImplementation(async ({ where, select }) => {
    const user = where.id ? users.get(where.id) : [...users.values()].find((item) => item.email === where.email);
    return selected(user, select);
  });
  prisma.user.findMany.mockImplementation(async ({ select }) => [...users.values()].map((user) => selected(user, select)));
  prisma.user.create.mockImplementation(async ({ data, select }) => {
    if ([...users.values()].some((user) => user.email === data.email)) {
      throw Object.assign(new Error('unique constraint'), { code: 'P2002' });
    }
    const user = { id: randomUUID(), ...data, isActive: true, createdAt: new Date(), updatedAt: new Date() };
    users.set(user.id, user);
    return selected(user, select);
  });
  prisma.user.update.mockImplementation(async ({ where, data, select }) => {
    const user = users.get(where.id);
    if (!user) throw Object.assign(new Error('missing'), { code: 'P2025' });
    Object.assign(user, data);
    return selected(user, select);
  });
  app = createApp();
});

describe('Autenticación (Prisma simulado)', () => {
  test('login correcto normaliza email y no devuelve passwordHash', async () => {
    const response = await request(app).post('/api/auth/login').send({ email: ' ADMIN@COLEGIO.EDU.PE ', password: validPassword }).expect(200);
    expect(response.body.user).toMatchObject({ id: admin.id, email: admin.email, role: 'ADMIN' });
    expect(response.body.user).not.toHaveProperty('passwordHash');
    expect(response.body.user).not.toHaveProperty('password');
    expect(jwt.verify(response.body.token, secret, { algorithms: ['HS256'] }).sub).toBe(admin.id);
  });

  test.each([
    ['contraseña incorrecta', 'admin@colegio.edu.pe', 'OtraFraseSegura123'],
    ['usuario inexistente', 'noexiste@colegio.edu.pe', validPassword],
    ['usuario inactivo', 'docente@colegio.edu.pe', validPassword],
  ])('%s: 401 con mensaje uniforme', async (label, email, password) => {
    if (label === 'usuario inactivo') docente.isActive = false;
    const response = await request(app).post('/api/auth/login').send({ email, password }).expect(401);
    expect(response.body).toEqual({ message: 'Credenciales inválidas' });
  });

  test('me sin token devuelve 401', async () => {
    await request(app).get('/api/auth/me').expect(401);
  });

  test('me con token válido devuelve datos seguros', async () => {
    const response = await request(app).get('/api/auth/me').set(auth(docente)).expect(200);
    expect(response.body.user).toMatchObject({ id: docente.id, role: 'DOCENTE' });
    expect(response.body.user).not.toHaveProperty('passwordHash');
  });

  test('JWT inválido, vencido, sin expiración o con algoritmo distinto devuelve 401', async () => {
    const expired = jwt.sign({ sub: admin.id, exp: Math.floor(Date.now() / 1000) - 10 }, secret, { algorithm: 'HS256' });
    const withoutExpiration = jwt.sign({ sub: admin.id }, secret, { algorithm: 'HS256' });
    const wrongAlgorithm = jwt.sign({ sub: admin.id }, secret, { algorithm: 'HS384' });
    for (const token of ['incorrecto', expired, withoutExpiration, wrongAlgorithm]) {
      await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`).expect(401);
    }
  });

  test('fallos de PostgreSQL no se confunden con credenciales inválidas', async () => {
    prisma.user.findUnique.mockRejectedValueOnce(new Error('fallo de conexión'));
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const response = await request(app).get('/api/auth/me').set(auth(admin)).expect(500);
      expect(response.body).toEqual({ message: 'Error interno del servidor' });
    } finally {
      log.mockRestore();
    }
  });
});

describe('Usuarios y autorización (Prisma simulado)', () => {
  const newUser = {
    email: ' NUEVO@COLEGIO.EDU.PE ',
    password: validPassword,
    firstName: 'Juan',
    lastName: 'Perez',
    role: 'DOCENTE',
  };

  test('ADMIN crea y lista usuarios con datos seguros', async () => {
    const created = await request(app).post('/api/users').set(auth(admin)).send(newUser).expect(201);
    expect(created.body.user.email).toBe('nuevo@colegio.edu.pe');
    expect(created.body.user).not.toHaveProperty('passwordHash');
    expect(created.body.user).not.toHaveProperty('password');
    const listed = await request(app).get('/api/users').set(auth(admin)).expect(200);
    expect(listed.body.users).toHaveLength(4);
    expect(listed.body.users.every((user) => !('passwordHash' in user))).toBe(true);
    expect([...users.values()].find((user) => user.email === 'nuevo@colegio.edu.pe').passwordHash).not.toBe(validPassword);
  });

  test('DOCENTE no crea usuarios y ESTUDIANTE no lista', async () => {
    await request(app).post('/api/users').set(auth(docente)).send(newUser).expect(403);
    await request(app).get('/api/users').set(auth(estudiante)).expect(403);
  });

  test('email duplicado devuelve 409, incluso con mayúsculas y espacios', async () => {
    const response = await request(app).post('/api/users').set(auth(admin)).send({ ...newUser, email: ' DOCENTE@COLEGIO.EDU.PE ' }).expect(409);
    expect(response.body).toEqual({ message: 'El email ya está registrado' });
  });

  test('datos inválidos y campos inesperados devuelven 400', async () => {
    await request(app).post('/api/users').set(auth(admin)).send({ ...newUser, password: 'corta' }).expect(400);
    await request(app).post('/api/users').set(auth(admin)).send({ ...newUser, isActive: true }).expect(400);
    await request(app).patch(`/api/users/${docente.id}/status`).set(auth(admin)).send({ isActive: false, role: 'ADMIN' }).expect(400);
    await request(app).patch('/api/users/no-es-uuid/status').set(auth(admin)).send({ isActive: false }).expect(400);
  });

  test('rechaza contraseña mayor de 72 bytes UTF-8 sin truncarla', async () => {
    const response = await request(app).post('/api/users').set(auth(admin)).send({ ...newUser, password: '🔒'.repeat(19) }).expect(400);
    expect(response.body).toEqual({ message: 'Datos inválidos' });
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  test('acepta 72 bytes exactos y conserva los espacios de la contraseña', async () => {
    const password = `  ${'a'.repeat(68)}  `;
    await request(app).post('/api/users').set(auth(admin)).send({ ...newUser, password }).expect(201);
    const saved = [...users.values()].find((user) => user.email === 'nuevo@colegio.edu.pe');
    expect(await bcrypt.compare(password, saved.passwordHash)).toBe(true);
    expect(await bcrypt.compare(password.trim(), saved.passwordHash)).toBe(false);
  });

  test('ADMIN desactiva otro usuario y su token previo deja de funcionar', async () => {
    const oldToken = tokenFor(docente);
    await request(app).get('/api/auth/me').set('Authorization', `Bearer ${oldToken}`).expect(200);
    const response = await request(app).patch(`/api/users/${docente.id}/status`).set(auth(admin)).send({ isActive: false }).expect(200);
    expect(response.body.user.isActive).toBe(false);
    expect(response.body.user).not.toHaveProperty('passwordHash');
    await request(app).get('/api/auth/me').set('Authorization', `Bearer ${oldToken}`).expect(401);
  });

  test('ADMIN no puede desactivarse a sí mismo', async () => {
    await request(app).patch(`/api/users/${admin.id}/status`).set(auth(admin)).send({ isActive: false }).expect(400);
    await request(app).patch(`/api/users/${admin.id.toUpperCase()}/status`).set(auth(admin)).send({ isActive: false }).expect(400);
    expect(admin.isActive).toBe(true);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  test('usuario inexistente devuelve 404', async () => {
    await request(app).patch(`/api/users/${randomUUID()}/status`).set(auth(admin)).send({ isActive: false }).expect(404);
  });

  test('la autorización usa el rol actual de la base, no el claim del JWT', async () => {
    await request(app).get('/api/users').set(auth(docente, { role: 'ADMIN' })).expect(403);
    docente.role = 'ADMIN';
    await request(app).get('/api/users').set(auth(docente, { role: 'DOCENTE' })).expect(200);
  });
});

test('rate limiting bloquea el sexto intento de login y conserva health', async () => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await request(app).post('/api/auth/login').send({ email: admin.email, password: 'OtraFraseSegura123' }).expect(401);
  }
  await request(app).post('/api/auth/login').send({ email: admin.email, password: 'OtraFraseSegura123' }).expect(429);
  await request(app).get('/api/health').expect(200);
});
