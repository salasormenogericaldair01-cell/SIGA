jest.mock('../../src/config/prisma', () => ({
  user: { findUnique: jest.fn() },
  teacher: { findUnique: jest.fn() }, student: { findUnique: jest.fn() },
  course: { count: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  teachingAssignment: { count: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  enrollment: { count: jest.fn(), findMany: jest.fn(), findUnique: jest.fn() },
  gradeRecord: { count: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  attendanceRecord: { count: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  $transaction: jest.fn(),
}));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('node:crypto');
const prisma = require('../../src/config/prisma');
const { createApp } = require('../../src/app');
const { todayLimaISO } = require('../../src/validators/course-record.validator');
const { respond } = require('../../src/utils/module-error');

const app = createApp();
const users = Object.fromEntries(['ADMIN', 'SECRETARIA', 'DOCENTE', 'ESTUDIANTE'].map((role) => [role, {
  id: randomUUID(), role, email: `${role.toLowerCase()}@test.edu`, firstName: role, lastName: 'Test', isActive: true, tokenVersion: 0,
}]));
const teacherId = randomUUID();
const otherTeacherId = randomUUID();
const studentId = randomUUID();
const otherStudentId = randomUUID();
const assignmentId = randomUUID();
const enrollmentId = randomUUID();
const auth = (role) => `Bearer ${jwt.sign({ tokenVersion: 0 }, process.env.JWT_SECRET, { subject: users[role].id, algorithm: 'HS256', expiresIn: '1h' })}`;
const call = (method, path, role, body) => {
  const req = request(app)[method](path).set('Authorization', auth(role));
  return body === undefined ? req : req.send(body);
};

beforeEach(() => {
  jest.clearAllMocks();
  prisma.user.findUnique.mockImplementation(async ({ where }) => Object.values(users).find((u) => u.id === where.id) || null);
  prisma.teacher.findUnique.mockResolvedValue({ id: teacherId });
  prisma.student.findUnique.mockResolvedValue({ id: studentId });
  for (const model of [prisma.course, prisma.teachingAssignment, prisma.gradeRecord, prisma.attendanceRecord, prisma.enrollment]) {
    model.count.mockResolvedValue(0);
    model.findMany.mockResolvedValue([]);
  }
  prisma.$transaction.mockImplementation(async (fn) => fn(prisma));
});

test('permisos de catálogo, asignaciones y registros', async () => {
  for (const route of ['courses', 'teaching-assignments', 'grade-records', 'attendance-records']) {
    await request(app).get(`/api/${route}`).expect(401);
  }
  await call('get', '/api/courses', 'DOCENTE').expect(200);
  await call('get', '/api/courses', 'ESTUDIANTE').expect(403);
  await call('get', '/api/teaching-assignments', 'ESTUDIANTE').expect(403);
  await call('post', '/api/courses', 'DOCENTE', {}).expect(403);
  await call('post', '/api/teaching-assignments', 'DOCENTE', {}).expect(403);
  for (const route of ['grade-records', 'attendance-records']) {
    await call('get', `/api/${route}`, 'SECRETARIA').expect(200);
    await call('get', `/api/${route}`, 'ESTUDIANTE').expect(200);
    await call('post', `/api/${route}`, 'SECRETARIA', {}).expect(403);
    await call('patch', `/api/${route}/${randomUUID()}`, 'ESTUDIANTE', {}).expect(403);
  }
});

test('DOCENTE sin perfil y ESTUDIANTE sin perfil reciben 403', async () => {
  prisma.teacher.findUnique.mockResolvedValue(null);
  await call('get', '/api/teaching-assignments', 'DOCENTE').expect(403);
  await call('get', '/api/grade-records', 'DOCENTE').expect(403);
  prisma.student.findUnique.mockResolvedValue(null);
  await call('get', '/api/grade-records', 'ESTUDIANTE').expect(403);
});

test('filtros estrictos y paginación', async () => {
  for (const route of ['courses', 'teaching-assignments', 'grade-records', 'attendance-records']) {
    for (const query of ['page=0', 'limit=101', 'unexpected=x']) {
      await call('get', `/api/${route}?${query}`, 'ADMIN').expect(400);
    }
    const result = await call('get', `/api/${route}?page=2&limit=3`, 'ADMIN').expect(200);
    expect(result.body.pagination).toEqual({ page: 2, limit: 3, total: 0, totalPages: 0 });
  }
  await call('get', '/api/teaching-assignments?academicPeriodId=bad', 'ADMIN').expect(400);
  await call('get', '/api/grade-records?term=5', 'ADMIN').expect(400);
  await call('get', `/api/teaching-assignments/${randomUUID()}/enrollments?status=OTHER`, 'ADMIN').expect(400);
});

test('DOCENTE y ESTUDIANTE tienen alcance aplicado en el conteo y la consulta', async () => {
  await call('get', `/api/teaching-assignments?teacherId=${otherTeacherId}`, 'DOCENTE').expect(200);
  expect(prisma.teachingAssignment.count.mock.calls[0][0].where.AND).toEqual([{ teacherId: otherTeacherId }, { teacherId }]);
  expect(prisma.teachingAssignment.findMany.mock.calls[0][0].where.AND[1].teacherId).toBe(teacherId);
  await call('get', `/api/grade-records?enrollmentId=${enrollmentId}`, 'DOCENTE').expect(200);
  const teacherWhere = prisma.gradeRecord.count.mock.calls[0][0].where;
  expect(teacherWhere.AND[1].teachingAssignment.is.teacherId).toBe(teacherId);
  await call('get', `/api/attendance-records?teachingAssignmentId=${assignmentId}`, 'ESTUDIANTE').expect(200);
  const studentWhere = prisma.attendanceRecord.count.mock.calls[0][0].where;
  expect(studentWhere.AND[1].enrollment.is.studentId).toBe(studentId);
});

test('IDs manipulados en detalle y PATCH se rechazan por recurso', async () => {
  prisma.teachingAssignment.findUnique.mockResolvedValue({ id: assignmentId, teacherId: otherTeacherId, sectionId: randomUUID() });
  await call('get', `/api/teaching-assignments/${assignmentId}`, 'DOCENTE').expect(403);
  await call('get', `/api/teaching-assignments/${assignmentId}/enrollments`, 'DOCENTE').expect(403);
  const record = { id: randomUUID(), teachingAssignmentId: assignmentId, enrollmentId,
    teachingAssignment: { teacherId: otherTeacherId }, enrollment: { studentId: otherStudentId } };
  prisma.gradeRecord.findUnique.mockResolvedValue(record);
  await call('get', `/api/grade-records/${record.id}`, 'DOCENTE').expect(403);
  await call('get', `/api/grade-records/${record.id}`, 'ESTUDIANTE').expect(403);
  await call('patch', `/api/grade-records/${record.id}`, 'DOCENTE', { value: 'A' }).expect(403);
  prisma.attendanceRecord.findUnique.mockResolvedValue(record);
  await call('get', `/api/attendance-records/${record.id}`, 'ESTUDIANTE').expect(403);
});

test('cuerpos estrictos, valores, bimestres y fechas', async () => {
  const ids = { teachingAssignmentId: randomUUID(), enrollmentId: randomUUID() };
  await call('post', '/api/courses', 'ADMIN', { code: ' ', name: 'Matemática' }).expect(400);
  await call('patch', `/api/courses/${randomUUID()}`, 'ADMIN', { code: 'OTRO' }).expect(400);
  await call('patch', `/api/teaching-assignments/${randomUUID()}`, 'ADMIN', {}).expect(400);
  await call('post', '/api/teaching-assignments', 'ADMIN', { courseId: randomUUID(), sectionId: randomUUID(), teacherId: randomUUID(), extra: true }).expect(400);
  for (const term of [0, 5]) await call('post', '/api/grade-records', 'ADMIN', { ...ids, term, value: 'A' }).expect(400);
  await call('post', '/api/grade-records', 'ADMIN', { ...ids, term: 1, value: 'F' }).expect(400);
  await call('patch', `/api/grade-records/${randomUUID()}`, 'ADMIN', { term: 2 }).expect(400);
  for (const date of ['2026-02-30', '2099-01-01']) {
    await call('post', '/api/attendance-records', 'ADMIN', { ...ids, date, status: 'PRESENT' }).expect(400);
  }
  await call('post', '/api/attendance-records', 'ADMIN', { ...ids, date: todayLimaISO(), status: 'UNKNOWN' }).expect(400);
  await call('patch', `/api/attendance-records/${randomUUID()}`, 'ADMIN', { date: todayLimaISO() }).expect(400);
});

test('la restricción RESTRICT de PostgreSQL produce un 409 seguro', () => {
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
  respond({ message: 'violates GradeRecord_enrollmentId_sectionId_fkey; SQL interno' }, res);
  expect(res.status).toHaveBeenCalledWith(409);
  expect(res.json).toHaveBeenCalledWith({ message: 'La matrícula tiene registros académicos asociados' });
});
