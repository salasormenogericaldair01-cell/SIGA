jest.mock('../../src/models', () => ({
  sequelize: { transaction: jest.fn() },
  User: { findByPk: jest.fn() },
  Teacher: { findOne: jest.fn(), findByPk: jest.fn() },
  Student: { findOne: jest.fn() },
  Course: { findAndCountAll: jest.fn(), findByPk: jest.fn(), create: jest.fn() },
  TeachingAssignment: { findAndCountAll: jest.fn(), findByPk: jest.fn(), create: jest.fn() },
  Enrollment: { findAndCountAll: jest.fn(), findByPk: jest.fn() },
  GradeRecord: { findAndCountAll: jest.fn(), findByPk: jest.fn(), create: jest.fn() },
  AttendanceRecord: { findAndCountAll: jest.fn(), findByPk: jest.fn(), create: jest.fn() },
  Section: { findByPk: jest.fn() },
  Grade: {},
  EducationLevel: {},
  AcademicPeriod: {},
}));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('node:crypto');
const {
  sequelize,
  User,
  Teacher,
  Student,
  Course,
  TeachingAssignment,
  Enrollment,
  GradeRecord,
  AttendanceRecord,
  Section,
} = require('../../src/models');
const { createApp } = require('../../src/app');
const { todayLimaISO } = require('../../src/shared/pagination');
const { respondError } = require('../../src/shared/errors');

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
  User.findByPk.mockImplementation(async (id) => Object.values(users).find((u) => u.id === id) || null);
  Teacher.findOne.mockResolvedValue({ id: teacherId });
  Teacher.findByPk.mockResolvedValue({ id: teacherId, isActive: true, user: { id: users.DOCENTE.id, role: 'DOCENTE', isActive: true } });
  Student.findOne.mockResolvedValue({ id: studentId });
  for (const model of [Course, TeachingAssignment, GradeRecord, AttendanceRecord, Enrollment]) {
    model.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });
  }
  sequelize.transaction.mockImplementation(async (arg1, arg2) => (typeof arg1 === 'function' ? arg1({}) : arg2({})));
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
  Teacher.findOne.mockResolvedValue(null);
  await call('get', '/api/teaching-assignments', 'DOCENTE').expect(403);
  await call('get', '/api/grade-records', 'DOCENTE').expect(403);
  Student.findOne.mockResolvedValue(null);
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
  expect(TeachingAssignment.findAndCountAll.mock.calls[0][0].where.teacherId).toBe(teacherId);
  await call('get', `/api/grade-records?enrollmentId=${enrollmentId}`, 'DOCENTE').expect(200);
  const teacherInclude = GradeRecord.findAndCountAll.mock.calls[0][0].include.find((item) => item.as === 'teachingAssignment');
  expect(teacherInclude.where.teacherId).toBe(teacherId);
  await call('get', `/api/attendance-records?teachingAssignmentId=${assignmentId}`, 'ESTUDIANTE').expect(200);
  const studentInclude = AttendanceRecord.findAndCountAll.mock.calls[0][0].include.find((item) => item.as === 'enrollment');
  expect(studentInclude.where.studentId).toBe(studentId);
});

test('IDs manipulados en detalle y PATCH se rechazan por recurso', async () => {
  TeachingAssignment.findByPk.mockResolvedValue({ id: assignmentId, teacherId: otherTeacherId, sectionId: randomUUID() });
  await call('get', `/api/teaching-assignments/${assignmentId}`, 'DOCENTE').expect(403);
  await call('get', `/api/teaching-assignments/${assignmentId}/enrollments`, 'DOCENTE').expect(403);
  const record = { id: randomUUID(), teachingAssignmentId: assignmentId, enrollmentId,
    teachingAssignment: { teacherId: otherTeacherId }, enrollment: { studentId: otherStudentId } };
  GradeRecord.findByPk.mockResolvedValue(record);
  await call('get', `/api/grade-records/${record.id}`, 'DOCENTE').expect(403);
  await call('get', `/api/grade-records/${record.id}`, 'ESTUDIANTE').expect(403);
  await call('patch', `/api/grade-records/${record.id}`, 'DOCENTE', { value: 'A' }).expect(403);
  AttendanceRecord.findByPk.mockResolvedValue(record);
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
  respondError({ message: 'violates GradeRecord_enrollmentId_sectionId_fkey; SQL interno' }, res);
  expect(res.status).toHaveBeenCalledWith(409);
  expect(res.json).toHaveBeenCalledWith({ message: 'La matrícula tiene registros académicos asociados' });
});

test('DELETE de notas y asistencia respeta permisos, alcance y estado activo; filtro por fecha en asistencia', async () => {
  const sectionId = randomUUID();
  const recordId = randomUUID();
  await call('delete', `/api/grade-records/${recordId}`, 'SECRETARIA').expect(403);
  await call('delete', `/api/grade-records/${recordId}`, 'ESTUDIANTE').expect(403);
  await call('delete', '/api/grade-records/no-uuid', 'ADMIN').expect(400);

  GradeRecord.findByPk.mockResolvedValue(null);
  await call('delete', `/api/grade-records/${recordId}`, 'ADMIN').expect(404);

  const destroyMock = jest.fn().mockResolvedValue(undefined);
  GradeRecord.findByPk.mockResolvedValue({ id: recordId, teachingAssignmentId: assignmentId, enrollmentId, term: 1, value: 'A', destroy: destroyMock });
  TeachingAssignment.findByPk.mockResolvedValue({ id: assignmentId, teacherId: otherTeacherId, sectionId, isActive: true });
  await call('delete', `/api/grade-records/${recordId}`, 'DOCENTE').expect(403);

  TeachingAssignment.findByPk.mockResolvedValue({ id: assignmentId, teacherId, sectionId, isActive: true, courseId: randomUUID() });
  Enrollment.findByPk.mockResolvedValue({ id: enrollmentId, sectionId, status: 'ACTIVE', student: { id: studentId, isActive: true } });
  Course.findByPk.mockResolvedValue({ id: randomUUID(), isActive: true });
  Section.findByPk.mockResolvedValue({
    id: sectionId, isActive: true,
    grade: { isActive: true, educationLevel: { isActive: true } },
    academicPeriod: { isActive: true, startDate: '2026-01-01', endDate: '2026-12-31' },
  });
  Teacher.findByPk.mockResolvedValue({ id: teacherId, isActive: true, user: { id: users.DOCENTE.id, role: 'DOCENTE', isActive: true } });
  await call('delete', `/api/grade-records/${recordId}`, 'DOCENTE').expect(200);
  expect(destroyMock).toHaveBeenCalledWith({ transaction: expect.any(Object) });

  const filterDay = todayLimaISO();
  await call('get', `/api/attendance-records?date=${filterDay}`, 'ADMIN').expect(200);
  expect(AttendanceRecord.findAndCountAll.mock.calls[0][0].where.date).toBe(filterDay);
});
