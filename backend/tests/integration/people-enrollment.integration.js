const request = require('supertest');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('node:crypto');
const prisma = require('../../src/config/prisma');
const { createApp } = require('../../src/app');

const app = createApp();
const ids = { users: [], levels: [], grades: [], periods: [], sections: [], students: [], teachers: [], enrollments: [] };
let verified = false;
let admin;
let secretary;
let teacherUser;
let studentUser;
let inactiveUser;
let inactiveTeacherUser;
let sections;

function bearer(user) {
  return `Bearer ${jwt.sign({ tokenVersion: user.tokenVersion }, process.env.JWT_SECRET, { algorithm: 'HS256', subject: user.id, expiresIn: '1h' })}`;
}
function call(method, path, user, body) {
  const req = request(app)[method](path).set('Authorization', bearer(user));
  return body === undefined ? req : req.send(body);
}
async function makeUser(role, isActive = true) {
  const user = await prisma.user.create({ data: {
    email: `sprint3-${randomUUID()}@test.edu`, passwordHash: 'integration-test-only',
    firstName: role, lastName: 'Prueba', role, isActive,
  } });
  ids.users.push(user.id);
  return user;
}

beforeAll(async () => {
  const url = new URL(process.env.DATABASE_URL);
  const target = await prisma.$queryRaw`SELECT current_database() AS name, inet_server_port() AS port`;
  if (target[0].name !== 'siga_test' || target[0].port !== 5433 ||
      !['127.0.0.1', 'localhost'].includes(url.hostname) || url.pathname !== '/siga_test') {
    throw new Error('Integración Sprint 3 requiere siga_test en localhost:5433');
  }
  verified = true;
  admin = await makeUser('ADMIN');
  secretary = await makeUser('SECRETARIA');
  teacherUser = await makeUser('DOCENTE');
  studentUser = await makeUser('ESTUDIANTE');
  inactiveUser = await makeUser('ESTUDIANTE', false);
  inactiveTeacherUser = await makeUser('DOCENTE', false);
  const level = await prisma.educationLevel.create({ data: { code: 'SECUNDARIA', name: 'Secundaria' } });
  ids.levels.push(level.id);
  const grade = await prisma.grade.create({ data: { educationLevelId: level.id, name: 'Primero', order: 1 } });
  ids.grades.push(grade.id);
  const p1 = await prisma.academicPeriod.create({ data: { name: `P-${randomUUID()}`, startDate: new Date('2026-03-01'), endDate: new Date('2026-12-01') } });
  ids.periods.push(p1.id);
  const p2 = await prisma.academicPeriod.create({ data: { name: `P-${randomUUID()}`, startDate: new Date('2027-03-01'), endDate: new Date('2027-12-01') } });
  ids.periods.push(p2.id);
  sections = {};
  for (const [key, periodId, name, isActive] of [
    ['first', p1.id, 'A', true], ['transfer', p1.id, 'B', true],
    ['inactive', p1.id, 'C', false], ['next', p2.id, 'A', true],
  ]) {
    sections[key] = await prisma.section.create({ data: { gradeId: grade.id, academicPeriodId: periodId, name, isActive } });
    ids.sections.push(sections[key].id);
  }
});

afterAll(async () => {
  if (verified) {
    await prisma.enrollment.deleteMany({ where: { id: { in: ids.enrollments } } });
    await prisma.teacher.deleteMany({ where: { id: { in: ids.teachers } } });
    await prisma.student.deleteMany({ where: { id: { in: ids.students } } });
    await prisma.section.deleteMany({ where: { id: { in: ids.sections } } });
    await prisma.grade.deleteMany({ where: { id: { in: ids.grades } } });
    await prisma.academicPeriod.deleteMany({ where: { id: { in: ids.periods } } });
    await prisma.educationLevel.deleteMany({ where: { id: { in: ids.levels } } });
    await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
  }
  await prisma.$disconnect();
});

test('PostgreSQL real: perfiles, matrícula, permisos, filtros, conflictos y FK compuesta', async () => {
  for (const route of ['students', 'teachers', 'enrollments']) {
    await request(app).get(`/api/${route}`).expect(401);
    await call('get', `/api/${route}`, teacherUser).expect(403);
    await call('get', `/api/${route}`, studentUser).expect(403);
  }
  await call('post', '/api/teachers', secretary, { userId: teacherUser.id }).expect(403);

  const code = `EST-${randomUUID().slice(0, 8)}`.toUpperCase();
  const created = await call('post', '/api/students', secretary, {
    studentCode: ` ${code.toLowerCase()} `, firstName: ' Ana ', lastName: ' Pérez ', birthDate: '2012-05-14',
  }).expect(201);
  const student = created.body.data;
  ids.students.push(student.id);
  expect(student).toMatchObject({ studentCode: code, firstName: 'Ana', lastName: 'Pérez', userId: null });
  await call('post', '/api/students', admin, { studentCode: code, firstName: 'Otra', lastName: 'Persona', birthDate: '2012-05-14' }).expect(409);
  await call('post', '/api/students', admin, { studentCode: 'X', firstName: 'A', lastName: 'B', birthDate: '2099-01-01' }).expect(400);
  await call('patch', `/api/students/${student.id}`, admin, { userId: admin.id }).expect(409);
  await call('patch', `/api/students/${student.id}`, admin, { userId: inactiveUser.id }).expect(409);
  await call('patch', `/api/students/${student.id}`, admin, { userId: randomUUID() }).expect(404);
  const linked = await call('patch', `/api/students/${student.id}`, secretary, { userId: studentUser.id }).expect(200);
  expect(JSON.stringify(linked.body)).not.toContain('passwordHash');

  const second = await call('post', '/api/students', admin, {
    studentCode: `EST-${randomUUID().slice(0, 8)}`, firstName: 'Luis', lastName: 'Prueba', birthDate: '2011-01-01',
  }).expect(201);
  ids.students.push(second.body.data.id);
  await call('patch', `/api/students/${second.body.data.id}`, admin, { userId: studentUser.id }).expect(409);
  const listedStudents = await call('get', `/api/students?search=${code}&page=1&limit=1`, secretary).expect(200);
  expect(listedStudents.body.pagination).toMatchObject({ page: 1, limit: 1, total: 1, totalPages: 1 });
  expect(listedStudents.body.data[0].id).toBe(student.id);
  await call('patch', `/api/students/${student.id}`, admin, { userId: null }).expect(200);
  await call('patch', `/api/students/${student.id}`, admin, { userId: studentUser.id }).expect(200);

  await call('post', '/api/teachers', admin, { userId: studentUser.id }).expect(409);
  await call('post', '/api/teachers', admin, { userId: inactiveTeacherUser.id }).expect(409);
  await call('post', '/api/teachers', admin, { userId: randomUUID() }).expect(404);
  const teacher = await call('post', '/api/teachers', admin, { userId: teacherUser.id }).expect(201);
  ids.teachers.push(teacher.body.data.id);
  expect(JSON.stringify(teacher.body)).not.toContain('passwordHash');
  await call('post', '/api/teachers', admin, { userId: teacherUser.id }).expect(409);
  await call('get', `/api/teachers?search=${teacherUser.email}&page=1&limit=20`, secretary).expect(200);
  await call('patch', `/api/teachers/${teacher.body.data.id}`, secretary, { isActive: false }).expect(403);
  await call('patch', `/api/teachers/${teacher.body.data.id}`, admin, { isActive: false }).expect(200);
  expect((await prisma.user.findUnique({ where: { id: teacherUser.id } })).isActive).toBe(true);

  await call('post', '/api/enrollments', secretary, { studentId: student.id, sectionId: sections.inactive.id }).expect(409);
  await prisma.grade.update({ where: { id: sections.first.gradeId }, data: { isActive: false } });
  await call('post', '/api/enrollments', secretary, { studentId: student.id, sectionId: sections.first.id }).expect(409);
  await prisma.grade.update({ where: { id: sections.first.gradeId }, data: { isActive: true } });
  const levelId = (await prisma.grade.findUnique({ where: { id: sections.first.gradeId } })).educationLevelId;
  await prisma.educationLevel.update({ where: { id: levelId }, data: { isActive: false } });
  await call('post', '/api/enrollments', secretary, { studentId: student.id, sectionId: sections.first.id }).expect(409);
  await prisma.educationLevel.update({ where: { id: levelId }, data: { isActive: true } });
  await prisma.academicPeriod.update({ where: { id: sections.first.academicPeriodId }, data: { isActive: false } });
  await call('post', '/api/enrollments', secretary, { studentId: student.id, sectionId: sections.first.id }).expect(409);
  await prisma.academicPeriod.update({ where: { id: sections.first.academicPeriodId }, data: { isActive: true } });
  const enrollment = await call('post', '/api/enrollments', secretary, { studentId: student.id, sectionId: sections.first.id }).expect(201);
  ids.enrollments.push(enrollment.body.data.id);
  expect(enrollment.body.data.academicPeriodId).toBe(sections.first.academicPeriodId);
  expect(JSON.stringify(enrollment.body)).not.toContain('passwordHash');
  await call('post', '/api/enrollments', admin, { studentId: student.id, sectionId: sections.transfer.id }).expect(409);
  const transfer = await call('patch', `/api/enrollments/${enrollment.body.data.id}`, admin, { sectionId: sections.transfer.id }).expect(200);
  expect(transfer.body.data.sectionId).toBe(sections.transfer.id);
  await call('patch', `/api/enrollments/${enrollment.body.data.id}`, admin, { sectionId: sections.inactive.id }).expect(409);
  await call('patch', `/api/enrollments/${enrollment.body.data.id}`, admin, { sectionId: sections.next.id }).expect(409);
  const cancelled = await call('patch', `/api/enrollments/${enrollment.body.data.id}`, secretary, { status: 'CANCELLED' }).expect(200);
  expect(cancelled.body.data.status).toBe('CANCELLED');
  await call('post', '/api/enrollments', admin, { studentId: student.id, sectionId: sections.first.id }).expect(409);
  await call('patch', `/api/enrollments/${enrollment.body.data.id}`, admin, { status: 'ACTIVE' }).expect(200);
  const nextEnrollment = await call('post', '/api/enrollments', admin, { studentId: student.id, sectionId: sections.next.id }).expect(201);
  ids.enrollments.push(nextEnrollment.body.data.id);
  const filtered = await call('get', `/api/enrollments?studentId=${student.id}&status=ACTIVE&page=1&limit=1`, secretary).expect(200);
  expect(filtered.body.pagination).toMatchObject({ total: 2, totalPages: 2 });
  await expect(prisma.enrollment.create({ data: {
    studentId: second.body.data.id,
    sectionId: sections.first.id,
    academicPeriodId: sections.next.academicPeriodId,
  } })).rejects.toMatchObject({ code: 'P2003' });

  await call('patch', `/api/students/${student.id}`, admin, { isActive: false }).expect(200);
  expect(await prisma.enrollment.count({ where: { studentId: student.id } })).toBe(2);
  await call('patch', `/api/enrollments/${enrollment.body.data.id}`, admin, { status: 'CANCELLED' }).expect(200);
  await call('patch', `/api/enrollments/${enrollment.body.data.id}`, admin, { status: 'ACTIVE' }).expect(409);
});
