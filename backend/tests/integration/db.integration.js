const request = require('supertest');
const bcrypt = require('bcrypt');
const { randomUUID } = require('node:crypto');
const prisma = require('../../src/config/prisma');
const { createApp } = require('../../src/app');

const app = createApp();
const createdIds = [];
let admin;

beforeAll(async () => {
  // Defensa adicional: jamás escribir en la base de desarrollo.
  const rows = await prisma.$queryRaw`SELECT current_database() AS name, inet_server_port() AS port`;
  if (rows[0].name !== 'siga_test' || rows[0].port !== 5433) {
    throw new Error('Las pruebas de integración requieren siga_test en el puerto 5433');
  }

  admin = await prisma.user.create({
    data: {
      email: `admin-${randomUUID()}@colegio.edu.pe`,
      passwordHash: await bcrypt.hash('UnaFraseSegura123', 10),
      firstName: 'Admin',
      lastName: 'Prueba',
      role: 'ADMIN',
    },
  });
  createdIds.push(admin.id);
});

afterAll(async () => {
  if (createdIds.length) {
    await prisma.user.deleteMany({ where: { id: { in: createdIds } } });
  }
  await prisma.$disconnect();
});

test('login, creación, restricción única y revocación con PostgreSQL real', async () => {
  const login = await request(app).post('/api/auth/login').send({
    email: admin.email.toUpperCase(),
    password: 'UnaFraseSegura123',
  }).expect(200);
  const adminToken = login.body.token;
  expect(login.body.user).not.toHaveProperty('passwordHash');

  const email = `docente-${randomUUID()}@colegio.edu.pe`;
  const created = await request(app).post('/api/users')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ email, password: 'OtraFraseSegura123', firstName: 'Juan', lastName: 'Perez', role: 'DOCENTE' })
    .expect(201);
  createdIds.push(created.body.user.id);
  expect(created.body.user).not.toHaveProperty('passwordHash');

  await request(app).post('/api/users')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ email: email.toUpperCase(), password: 'OtraFraseSegura123', firstName: 'Juan', lastName: 'Perez', role: 'DOCENTE' })
    .expect(409);

  const docenteLogin = await request(app).post('/api/auth/login')
    .send({ email, password: 'OtraFraseSegura123' }).expect(200);
  const docenteToken = docenteLogin.body.token;
  await request(app).get('/api/auth/me').set('Authorization', `Bearer ${docenteToken}`).expect(200);
  await request(app).get('/api/users').set('Authorization', `Bearer ${docenteToken}`).expect(403);

  await request(app).patch(`/api/users/${created.body.user.id}/status`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ isActive: false }).expect(200);
  await request(app).get('/api/auth/me').set('Authorization', `Bearer ${docenteToken}`).expect(401);
});
