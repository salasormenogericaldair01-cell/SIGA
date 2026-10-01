const request = require('supertest');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('node:crypto');
const prisma = require('../../src/config/prisma');
const { createApp } = require('../../src/app');
const { todayLimaISO } = require('../../src/validators/course-record.validator');

const app = createApp();
const ids = { users: [], teachers: [], students: [], levels: [], grades: [], periods: [], sections: [], enrollments: [], courses: [], assignments: [], gradeRecords: [], attendanceRecords: [] };
let verified = false;
let admin;
let secretary;
let teacherA;
let teacherB;
let studentA;
let studentB;
let sectionA;
let sectionB;
let enrollmentA;
let enrollmentB;

function token(user) {
  return `Bearer ${jwt.sign({ tokenVersion: user.tokenVersion }, process.env.JWT_SECRET, { algorithm: 'HS256', subject: user.id, expiresIn: '1h' })}`;
}
function call(method, path, user, body) {
  const req = request(app)[method](path).set('Authorization', token(user));
  return body === undefined ? req : req.send(body);
}
async function user(role) {
  const created = await prisma.user.create({ data: {
    email: `sprint4-${randomUUID()}@test.edu`, passwordHash: 'integration-test-only',
    firstName: role, lastName: 'Prueba', role,
  } });
  ids.users.push(created.id);
  return created;
}

beforeAll(async () => {
  const url = new URL(process.env.DATABASE_URL);
  const target = await prisma.$queryRaw`SELECT current_database() AS name, inet_server_port() AS port`;
  if (target[0].name !== 'siga_test' || target[0].port !== 5433 ||
      !['127.0.0.1', 'localhost'].includes(url.hostname) || url.pathname !== '/siga_test') {
    throw new Error('Integración Sprint 4 requiere siga_test en localhost:5433');
  }
  verified = true;
  admin = await user('ADMIN');
  secretary = await user('SECRETARIA');
  teacherA = await user('DOCENTE');
  teacherB = await user('DOCENTE');
  studentA = await user('ESTUDIANTE');
  studentB = await user('ESTUDIANTE');
  for (const u of [teacherA, teacherB]) {
    const t = await prisma.teacher.create({ data: { userId: u.id } });
    ids.teachers.push(t.id);
    u.profileId = t.id;
  }
  for (const u of [studentA, studentB]) {
    const s = await prisma.student.create({ data: { userId: u.id, studentCode: `E-${randomUUID()}`, firstName: 'Alumno', lastName: 'Prueba', birthDate: new Date('2012-01-01') } });
    ids.students.push(s.id);
    u.profileId = s.id;
  }
  const level = await prisma.educationLevel.create({ data: { code: 'PRIMARIA', name: 'Primaria' } });
  ids.levels.push(level.id);
  const grade = await prisma.grade.create({ data: { educationLevelId: level.id, name: 'Primero', order: 1 } });
  ids.grades.push(grade.id);
  const period = await prisma.academicPeriod.create({ data: { name: `P-${randomUUID()}`, startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31') } });
  ids.periods.push(period.id);
  sectionA = await prisma.section.create({ data: { gradeId: grade.id, academicPeriodId: period.id, name: 'A' } });
  sectionB = await prisma.section.create({ data: { gradeId: grade.id, academicPeriodId: period.id, name: 'B' } });
  ids.sections.push(sectionA.id, sectionB.id);
  enrollmentA = await prisma.enrollment.create({ data: { studentId: studentA.profileId, sectionId: sectionA.id, academicPeriodId: period.id } });
  enrollmentB = await prisma.enrollment.create({ data: { studentId: studentB.profileId, sectionId: sectionB.id, academicPeriodId: period.id } });
  ids.enrollments.push(enrollmentA.id, enrollmentB.id);
});

afterAll(async () => {
  if (verified) {
    await prisma.gradeRecord.deleteMany({ where: { id: { in: ids.gradeRecords } } });
    await prisma.attendanceRecord.deleteMany({ where: { id: { in: ids.attendanceRecords } } });
    await prisma.teachingAssignment.deleteMany({ where: { id: { in: ids.assignments } } });
    await prisma.enrollment.deleteMany({ where: { id: { in: ids.enrollments } } });
    await prisma.student.deleteMany({ where: { id: { in: ids.students } } });
    await prisma.teacher.deleteMany({ where: { id: { in: ids.teachers } } });
    await prisma.section.deleteMany({ where: { id: { in: ids.sections } } });
    await prisma.grade.deleteMany({ where: { id: { in: ids.grades } } });
    await prisma.academicPeriod.deleteMany({ where: { id: { in: ids.periods } } });
    await prisma.educationLevel.deleteMany({ where: { id: { in: ids.levels } } });
    await prisma.course.deleteMany({ where: { id: { in: ids.courses } } });
    await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
  }
  await prisma.$disconnect();
});

test('PostgreSQL real: cursos, asignaciones, notas, asistencia y alcance por recurso', async () => {
  for (const route of ['courses', 'teaching-assignments', 'grade-records', 'attendance-records']) {
    await request(app).get(`/api/${route}`).expect(401);
  }
  await call('get', '/api/courses', studentA).expect(403);
  await call('get', '/api/teaching-assignments', studentA).expect(403);

  const code = `MAT-${randomUUID().slice(0, 8)}`.toUpperCase();
  const courseA = await call('post', '/api/courses', admin, { code: ` ${code.toLowerCase()} `, name: ' Matemática ' }).expect(201);
  ids.courses.push(courseA.body.data.id);
  expect(courseA.body.data).toMatchObject({ code, name: 'Matemática' });
  await call('post', '/api/courses', admin, { code, name: 'Otra' }).expect(409);
  const courseB = await call('post', '/api/courses', secretary, { code: `LEN-${randomUUID().slice(0, 8)}`, name: 'Lengua' }).expect(201);
  ids.courses.push(courseB.body.data.id);
  await call('patch', `/api/courses/${courseA.body.data.id}`, teacherA, { name: 'Cambio' }).expect(403);
  await call('get', '/api/courses?search=mate&page=1&limit=1', teacherA).expect(200);

  await call('patch', `/api/courses/${courseA.body.data.id}`, admin, { isActive: false }).expect(200);
  await call('post', '/api/teaching-assignments', admin, { courseId: courseA.body.data.id, sectionId: sectionA.id, teacherId: teacherA.profileId }).expect(409);
  await call('patch', `/api/courses/${courseA.body.data.id}`, admin, { isActive: true }).expect(200);
  await prisma.section.update({ where: { id: sectionA.id }, data: { isActive: false } });
  await call('post', '/api/teaching-assignments', admin, { courseId: courseA.body.data.id, sectionId: sectionA.id, teacherId: teacherA.profileId }).expect(409);
  await prisma.section.update({ where: { id: sectionA.id }, data: { isActive: true } });
  const a = await call('post', '/api/teaching-assignments', secretary, { courseId: courseA.body.data.id, sectionId: sectionA.id, teacherId: teacherA.profileId }).expect(201);
  ids.assignments.push(a.body.data.id);
  await prisma.teacher.update({ where: { id: teacherB.profileId }, data: { isActive: false } });
  await call('post', '/api/teaching-assignments', admin, { courseId: courseB.body.data.id, sectionId: sectionB.id, teacherId: teacherB.profileId }).expect(409);
  await prisma.teacher.update({ where: { id: teacherB.profileId }, data: { isActive: true } });
  const b = await call('post', '/api/teaching-assignments', admin, { courseId: courseB.body.data.id, sectionId: sectionB.id, teacherId: teacherB.profileId }).expect(201);
  ids.assignments.push(b.body.data.id);
  await call('post', '/api/teaching-assignments', admin, { courseId: courseA.body.data.id, sectionId: sectionA.id, teacherId: teacherA.profileId }).expect(409);
  await call('get', `/api/teaching-assignments/${b.body.data.id}`, teacherA).expect(403);
  await call('get', `/api/teaching-assignments/${b.body.data.id}/enrollments`, teacherA).expect(403);
  const ownAssignments = await call('get', `/api/teaching-assignments?teacherId=${teacherB.profileId}`, teacherA).expect(200);
  expect(ownAssignments.body.pagination.total).toBeLessThanOrEqual(1);
  expect(ownAssignments.body.data.every((item) => item.teacherId === teacherA.profileId)).toBe(true);
  const roster = await call('get', `/api/teaching-assignments/${a.body.data.id}/enrollments?status=ACTIVE`, teacherA).expect(200);
  expect(roster.body.data.map((item) => item.id)).toEqual([enrollmentA.id]);
  expect(JSON.stringify(roster.body)).not.toContain('passwordHash');

  const gradeA = await call('post', '/api/grade-records', teacherA, { teachingAssignmentId: a.body.data.id, enrollmentId: enrollmentA.id, term: 1, value: 'A' }).expect(201);
  ids.gradeRecords.push(gradeA.body.data.id);
  const gradeB = await call('post', '/api/grade-records', teacherB, { teachingAssignmentId: b.body.data.id, enrollmentId: enrollmentB.id, term: 1, value: 'AD' }).expect(201);
  ids.gradeRecords.push(gradeB.body.data.id);
  const lastTerm = await call('post', '/api/grade-records', teacherB, { teachingAssignmentId: b.body.data.id, enrollmentId: enrollmentB.id, term: 4, value: 'C' }).expect(201);
  ids.gradeRecords.push(lastTerm.body.data.id);
  await call('post', '/api/grade-records', teacherA, { teachingAssignmentId: a.body.data.id, enrollmentId: enrollmentA.id, term: 1, value: 'B' }).expect(409);
  await call('post', '/api/grade-records', teacherA, { teachingAssignmentId: a.body.data.id, enrollmentId: enrollmentB.id, term: 2, value: 'B' }).expect(409);
  await call('post', '/api/grade-records', secretary, { teachingAssignmentId: a.body.data.id, enrollmentId: enrollmentA.id, term: 2, value: 'B' }).expect(403);
  await call('post', '/api/grade-records', teacherA, { teachingAssignmentId: b.body.data.id, enrollmentId: enrollmentB.id, term: 2, value: 'B' }).expect(403);
  await call('get', `/api/grade-records/${gradeB.body.data.id}`, teacherA).expect(403);
  await call('patch', `/api/grade-records/${gradeB.body.data.id}`, teacherA, { value: 'C' }).expect(403);
  await call('get', `/api/grade-records/${gradeB.body.data.id}`, studentA).expect(403);
  const studentGrades = await call('get', `/api/grade-records?enrollmentId=${enrollmentB.id}`, studentA).expect(200);
  expect(studentGrades.body.pagination.total).toBe(0);
  expect((await call('get', '/api/grade-records', studentA).expect(200)).body.pagination.total).toBe(1);
  expect((await call('get', '/api/grade-records', teacherA).expect(200)).body.pagination.total).toBe(1);
  expect(JSON.stringify(gradeA.body)).not.toContain('passwordHash');
  await call('patch', `/api/enrollments/${enrollmentA.id}`, admin, { status: 'CANCELLED' }).expect(200);
  await call('post', '/api/grade-records', teacherA, { teachingAssignmentId: a.body.data.id, enrollmentId: enrollmentA.id, term: 2, value: 'B' }).expect(409);
  await call('patch', `/api/enrollments/${enrollmentA.id}`, admin, { status: 'ACTIVE' }).expect(200);

  const date = todayLimaISO();
  const attA = await call('post', '/api/attendance-records', teacherA, { teachingAssignmentId: a.body.data.id, enrollmentId: enrollmentA.id, date, status: 'PRESENT' }).expect(201);
  ids.attendanceRecords.push(attA.body.data.id);
  const attB = await call('post', '/api/attendance-records', teacherB, { teachingAssignmentId: b.body.data.id, enrollmentId: enrollmentB.id, date, status: 'LATE' }).expect(201);
  ids.attendanceRecords.push(attB.body.data.id);
  const boundary = await call('post', '/api/attendance-records', teacherB, { teachingAssignmentId: b.body.data.id, enrollmentId: enrollmentB.id, date: '2026-01-01', status: 'ABSENT' }).expect(201);
  ids.attendanceRecords.push(boundary.body.data.id);
  await call('post', '/api/attendance-records', teacherA, { teachingAssignmentId: a.body.data.id, enrollmentId: enrollmentA.id, date, status: 'ABSENT' }).expect(409);
  await call('post', '/api/attendance-records', teacherA, { teachingAssignmentId: a.body.data.id, enrollmentId: enrollmentA.id, date: '2025-12-31', status: 'PRESENT' }).expect(400);
  await call('post', '/api/attendance-records', teacherA, { teachingAssignmentId: a.body.data.id, enrollmentId: enrollmentA.id, date: '2099-01-01', status: 'PRESENT' }).expect(400);
  await call('get', `/api/attendance-records/${attB.body.data.id}`, teacherA).expect(403);
  await call('patch', `/api/attendance-records/${attB.body.data.id}`, teacherA, { status: 'ABSENT' }).expect(403);
  await call('get', `/api/attendance-records/${attB.body.data.id}`, studentA).expect(403);
  expect((await call('get', '/api/attendance-records', studentA).expect(200)).body.pagination.total).toBe(1);
  await expect(prisma.gradeRecord.create({ data: { teachingAssignmentId: a.body.data.id, enrollmentId: enrollmentB.id, sectionId: sectionA.id, term: 2, value: 'B' } })).rejects.toMatchObject({ code: 'P2003' });
  await expect(prisma.attendanceRecord.create({ data: { teachingAssignmentId: a.body.data.id, enrollmentId: enrollmentB.id, sectionId: sectionA.id, date: new Date('2026-03-01'), status: 'PRESENT' } })).rejects.toMatchObject({ code: 'P2003' });
  await call('patch', `/api/enrollments/${enrollmentA.id}`, admin, { sectionId: sectionB.id }).expect(409);
  await expect(prisma.enrollment.update({ where: { id: enrollmentA.id }, data: { sectionId: sectionB.id } })).rejects.toThrow();
  expect(await prisma.gradeRecord.count({ where: { id: gradeA.body.data.id } })).toBe(1);
  expect(await prisma.attendanceRecord.count({ where: { id: attA.body.data.id } })).toBe(1);

  await call('patch', `/api/teaching-assignments/${a.body.data.id}`, admin, { teacherId: teacherB.profileId }).expect(200);
  await call('get', `/api/teaching-assignments/${a.body.data.id}`, teacherA).expect(403);
  await call('get', `/api/grade-records/${gradeA.body.data.id}`, teacherA).expect(403);
  await call('patch', `/api/grade-records/${gradeA.body.data.id}`, teacherA, { value: 'B' }).expect(403);
  await call('get', `/api/grade-records/${gradeA.body.data.id}`, teacherB).expect(200);
  await call('patch', `/api/grade-records/${gradeA.body.data.id}`, teacherB, { value: 'B' }).expect(200);
  await call('patch', `/api/grade-records/${gradeA.body.data.id}`, teacherB, { value: 'C' }).expect(200);
  await call('patch', `/api/attendance-records/${attA.body.data.id}`, teacherB, { status: 'JUSTIFIED' }).expect(200);
  expect((await call('get', '/api/grade-records', teacherA).expect(200)).body.pagination.total).toBe(0);
  await call('patch', `/api/teaching-assignments/${a.body.data.id}`, admin, { isActive: false }).expect(200);
  await call('get', `/api/grade-records/${gradeA.body.data.id}`, teacherB).expect(200);
  await call('patch', `/api/grade-records/${gradeA.body.data.id}`, teacherB, { value: 'A' }).expect(409);
  await call('patch', `/api/courses/${courseA.body.data.id}`, admin, { isActive: false }).expect(200);
  await call('patch', `/api/teaching-assignments/${a.body.data.id}`, admin, { isActive: true }).expect(409);
  await call('patch', `/api/courses/${courseA.body.data.id}`, admin, { isActive: true }).expect(200);
  await call('patch', `/api/teaching-assignments/${a.body.data.id}`, admin, { isActive: true }).expect(200);
});
