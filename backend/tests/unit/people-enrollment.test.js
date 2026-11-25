jest.mock('../../src/models', () => ({
  sequelize: { transaction: jest.fn(), fn: jest.fn((name, col) => ({ fn: name, col })), col: jest.fn((name) => name) },
  User: { findByPk: jest.fn(), update: jest.fn() },
  Student: { findAndCountAll: jest.fn(), findByPk: jest.fn(), create: jest.fn() },
  Teacher: { findAndCountAll: jest.fn(), findByPk: jest.fn(), create: jest.fn() },
  Enrollment: { findAndCountAll: jest.fn(), findByPk: jest.fn(), findOne: jest.fn(), create: jest.fn() },
  Section: { findByPk: jest.fn() },
  Grade: {},
  EducationLevel: {},
  AcademicPeriod: {},
  GradeRecord: { findAll: jest.fn(), count: jest.fn() },
  AttendanceRecord: { findAll: jest.fn(), count: jest.fn() },
}));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('node:crypto');
const {
  sequelize,
  User,
  Student,
  Teacher,
  Enrollment,
  GradeRecord,
  AttendanceRecord,
} = require('../../src/models');
const { createApp } = require('../../src/app');

const app = createApp();
const users = Object.fromEntries(['ADMIN', 'SECRETARIA', 'DOCENTE', 'ESTUDIANTE'].map((role) => [role, {
  id: randomUUID(), role, email: `${role.toLowerCase()}@test.edu`, firstName: role, lastName: 'Test', isActive: true, tokenVersion: 0,
}]));
const auth = (role) => `Bearer ${jwt.sign({ tokenVersion: 0 }, process.env.JWT_SECRET, { subject: users[role].id, algorithm: 'HS256', expiresIn: '1h' })}`;
const call = (method, path, role, body) => {
  const req = request(app)[method](path).set('Authorization', auth(role));
  return body === undefined ? req : req.send(body);
};

beforeEach(() => {
  jest.clearAllMocks();
  User.findByPk.mockImplementation(async (id) => Object.values(users).find((u) => u.id === id) || null);
  for (const model of [Student, Teacher, Enrollment]) {
    model.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });
  }
  GradeRecord.findAll.mockResolvedValue([]);
  AttendanceRecord.findAll.mockResolvedValue([]);
  GradeRecord.count.mockResolvedValue(0);
  AttendanceRecord.count.mockResolvedValue(0);
  sequelize.transaction.mockImplementation(async (arg1, arg2) => (typeof arg1 === 'function' ? arg1({}) : arg2({})));
});

test('matriz de acceso: sin token 401; DOCENTE y ESTUDIANTE 403', async () => {
  for (const route of ['students', 'teachers', 'enrollments']) {
    await request(app).get(`/api/${route}`).expect(401);
    for (const role of ['DOCENTE', 'ESTUDIANTE']) {
      await call('get', `/api/${route}`, role).expect(403);
      await call('post', `/api/${route}`, role, {}).expect(403);
      await call('patch', `/api/${route}/${randomUUID()}`, role, {}).expect(403);
    }
    await call('get', `/api/${route}`, 'ADMIN').expect(200);
    await call('get', `/api/${route}`, 'SECRETARIA').expect(200);
  }
  await call('post', '/api/teachers', 'SECRETARIA', { userId: users.DOCENTE.id }).expect(403);
  await call('patch', `/api/teachers/${randomUUID()}`, 'SECRETARIA', { isActive: false }).expect(403);
});

test('filtros y paginación estrictos; orden estable', async () => {
  for (const route of ['students', 'teachers', 'enrollments']) {
    for (const query of ['page=0', 'limit=101', 'limit=abc', 'unexpected=x']) {
      await call('get', `/api/${route}?${query}`, 'ADMIN').expect(400);
    }
    const result = await call('get', `/api/${route}?page=2&limit=3`, 'SECRETARIA').expect(200);
    expect(result.body).toEqual({ data: [], pagination: { page: 2, limit: 3, total: 0, totalPages: 0 } });
  }
  await call('get', '/api/students?isActive=maybe', 'ADMIN').expect(400);
  await call('get', '/api/enrollments?studentId=bad', 'ADMIN').expect(400);
  await call('get', '/api/enrollments?status=UNKNOWN', 'ADMIN').expect(400);
  expect(Student.findAndCountAll.mock.calls.at(-1)[0].order).toEqual([['createdAt', 'ASC'], ['id', 'ASC']]);
});

test('estudiantes: códigos, fechas, UUID y PATCH estrictos', async () => {
  const valid = { studentCode: 'E-1', firstName: 'Ana', lastName: 'Rojas', birthDate: '2012-05-14' };
  await call('post', '/api/students', 'ADMIN', { ...valid, birthDate: '2099-01-01' }).expect(400);
  await call('post', '/api/students', 'ADMIN', { ...valid, birthDate: '2012-02-30' }).expect(400);
  await call('post', '/api/students', 'ADMIN', { ...valid, firstName: ' ' }).expect(400);
  await call('post', '/api/students', 'ADMIN', { ...valid, studentCode: 'sin espacio' }).expect(400);
  await call('post', '/api/students', 'ADMIN', { ...valid, extra: true }).expect(400);
  await call('patch', `/api/students/${randomUUID()}`, 'ADMIN', {}).expect(400);
  await call('patch', `/api/students/${randomUUID()}`, 'ADMIN', { studentCode: 'OTRO' }).expect(400);
  await call('get', '/api/students/no-uuid', 'ADMIN').expect(400);
});

test('docentes y matrículas: campos inesperados o inmutables se rechazan', async () => {
  await call('post', '/api/teachers', 'ADMIN', { userId: 'bad' }).expect(400);
  await call('post', '/api/teachers', 'ADMIN', { userId: users.DOCENTE.id, firstName: 'Duplicado' }).expect(400);
  await call('patch', `/api/teachers/${randomUUID()}`, 'ADMIN', {}).expect(400);
  await call('patch', `/api/teachers/${randomUUID()}`, 'ADMIN', { userId: users.DOCENTE.id }).expect(400);
  await call('post', '/api/enrollments', 'ADMIN', { studentId: randomUUID(), sectionId: randomUUID(), academicPeriodId: randomUUID() }).expect(400);
  await call('patch', `/api/enrollments/${randomUUID()}`, 'ADMIN', {}).expect(400);
  await call('patch', `/api/enrollments/${randomUUID()}`, 'ADMIN', { studentId: randomUUID() }).expect(400);
  await call('patch', `/api/enrollments/${randomUUID()}`, 'ADMIN', { status: 'OTHER' }).expect(400);
});

test('listado de docentes consulta solo campos seguros de User', async () => {
  Teacher.findAndCountAll.mockResolvedValue({
    count: 1,
    rows: [{
      id: randomUUID(),
      userId: users.DOCENTE.id,
      user: {
        id: users.DOCENTE.id, email: users.DOCENTE.email, firstName: 'Docente', lastName: 'Prueba', role: 'DOCENTE',
      },
    }],
  });
  const result = await call('get', '/api/teachers?search=docente', 'ADMIN').expect(200);
  expect(result.body.pagination.total).toBe(1);
  expect(JSON.stringify(result.body)).not.toContain('passwordHash');
  const userInclude = Teacher.findAndCountAll.mock.calls[0][0].include.find((item) => item.as === 'user');
  expect(userInclude.attributes).not.toContain('passwordHash');
  expect(userInclude.attributes).not.toContain('password');
});

test('matrículas: listado y detalle identifican desde Student sin cuenta y conservan permisos', async () => {
  const id = randomUUID();
  const record = {
    id, studentId: randomUUID(), sectionId: randomUUID(), academicPeriodId: randomUUID(), status: 'ACTIVE',
    student: { id: randomUUID(), studentCode: 'EST-2026-001', firstName: 'María Elena', lastName: 'Rojas Quispe' },
    section: { id: randomUUID(), name: 'A' }, academicPeriod: { id: randomUUID(), name: '2026' },
  };
  Enrollment.findAndCountAll.mockResolvedValue({ count: 1, rows: [record] });
  Enrollment.findByPk.mockResolvedValue(record);

  const listed = await call('get', '/api/enrollments?page=1&limit=20', 'SECRETARIA').expect(200);
  const detail = await call('get', `/api/enrollments/${id}`, 'ADMIN').expect(200);
  expect(listed.body.data[0].student).toMatchObject({ firstName: 'María Elena', lastName: 'Rojas Quispe', studentCode: 'EST-2026-001' });
  expect(detail.body.data.student).toEqual(listed.body.data[0].student);
  const studentInclude = Enrollment.findAndCountAll.mock.calls[0][0].include.find((item) => item.as === 'student');
  expect(studentInclude.attributes).toEqual(['id', 'studentCode', 'firstName', 'lastName']);
  expect(JSON.stringify([listed.body, detail.body])).not.toContain('passwordHash');
  await call('get', `/api/enrollments/${id}`, 'DOCENTE').expect(403);
  await call('get', `/api/enrollments/${id}`, 'ESTUDIANTE').expect(403);
});

test('crear o editar estudiante con userId sincroniza nombres en User', async () => {
  const studentId = randomUUID();
  const studentRecord = {
    id: studentId,
    studentCode: 'E-99',
    firstName: 'Sofía',
    lastName: 'Quispe',
    userId: users.ESTUDIANTE.id,
    update: jest.fn(async (data) => {
      Object.assign(studentRecord, data);
      return studentRecord;
    }),
  };
  User.findByPk.mockImplementation(async (id) => {
    if (id === users.ESTUDIANTE.id) return users.ESTUDIANTE;
    return Object.values(users).find((u) => u.id === id) || null;
  });
  User.update.mockResolvedValue([1]);
  Student.create.mockResolvedValue(studentRecord);
  Student.findByPk.mockResolvedValue(studentRecord);

  await call('post', '/api/students', 'ADMIN', {
    studentCode: 'E-99', firstName: 'Sofía', lastName: 'Quispe', birthDate: '2014-02-10', userId: users.ESTUDIANTE.id,
  }).expect(201);
  expect(User.update).toHaveBeenCalledWith(
    { firstName: 'Sofía', lastName: 'Quispe' },
    { where: { id: users.ESTUDIANTE.id }, transaction: expect.any(Object) },
  );

  User.update.mockClear();
  await call('patch', `/api/students/${studentId}`, 'ADMIN', { firstName: 'Sofía Lucía' }).expect(200);
  expect(User.update).toHaveBeenCalledWith(
    { firstName: 'Sofía Lucía', lastName: 'Quispe' },
    { where: { id: users.ESTUDIANTE.id }, transaction: expect.any(Object) },
  );
});
