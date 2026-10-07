const request = require('supertest');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('node:crypto');
const prisma = require('../../src/config/prisma');
const { createApp } = require('../../src/app');

const app = createApp();
const ids = { users: [], levels: [], grades: [], periods: [], sections: [], students: [], teachers: [], courses: [], assignments: [], enrollments: [], gradeRecords: [], attendanceRecords: [] };
let verified = false;
const tag = randomUUID();
const bearer = (user) => `Bearer ${jwt.sign({ tokenVersion: user.tokenVersion }, process.env.JWT_SECRET, { algorithm: 'HS256', subject: user.id, expiresIn: '1h' })}`;

async function localTarget() {
  const url = new URL(process.env.DATABASE_URL);
  const rows = await prisma.$queryRaw`SELECT current_database() AS name, inet_server_port() AS port`;
  if (url.hostname !== '127.0.0.1' || url.port !== '5433' || url.pathname !== '/siga_test' || rows[0].name !== 'siga_test' || rows[0].port !== 5433) {
    throw new Error('La integración solo puede escribir en siga_test en 127.0.0.1:5433');
  }
}

beforeAll(async () => { await localTarget(); verified = true; });

afterAll(async () => {
  if (verified) {
    await localTarget();
    await prisma.attendanceRecord.deleteMany({ where: { id: { in: ids.attendanceRecords } } });
    await prisma.gradeRecord.deleteMany({ where: { id: { in: ids.gradeRecords } } });
    await prisma.enrollment.deleteMany({ where: { id: { in: ids.enrollments } } });
    await prisma.teachingAssignment.deleteMany({ where: { id: { in: ids.assignments } } });
    await prisma.section.deleteMany({ where: { id: { in: ids.sections } } });
    await prisma.teacher.deleteMany({ where: { id: { in: ids.teachers } } });
    await prisma.student.deleteMany({ where: { id: { in: ids.students } } });
    await prisma.course.deleteMany({ where: { id: { in: ids.courses } } });
    await prisma.academicPeriod.deleteMany({ where: { id: { in: ids.periods } } });
    await prisma.grade.deleteMany({ where: { id: { in: ids.grades } } });
    await prisma.educationLevel.deleteMany({ where: { id: { in: ids.levels } } });
    await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
  }
  await prisma.$disconnect();
});

test('PostgreSQL real: cuentas, orden, filtro Secundaria e historial académico sin pérdida', async () => {
  const admin = await prisma.user.create({ data: { email: `ux-admin-${tag}@siga.invalid`, passwordHash: 'sin-login', firstName: 'Administrador', lastName: 'Temporal', role: 'ADMIN' } });
  ids.users.push(admin.id);
  const secretary = await prisma.user.create({ data: { email: `ux-secretaria-${tag}@siga.invalid`, passwordHash: 'sin-login', firstName: 'Secretaria', lastName: 'Temporal', role: 'SECRETARIA' } });
  ids.users.push(secretary.id);
  const studentUser = await prisma.user.create({ data: { email: `ux-estudiante-${tag}@siga.invalid`, passwordHash: 'sin-login', firstName: 'Cuenta', lastName: 'Estudiante', role: 'ESTUDIANTE' } });
  ids.users.push(studentUser.id);
  const teacherUser = await prisma.user.create({ data: { email: `ux-docente-${tag}@siga.invalid`, passwordHash: 'sin-login', firstName: 'Cuenta', lastName: 'Docente', role: 'DOCENTE' } });
  ids.users.push(teacherUser.id);
  const token = bearer(admin);

  await request(app).get(`/api/users/${studentUser.id}`).set('Authorization', bearer(secretary)).expect(403);
  const detail = await request(app).get(`/api/users/${studentUser.id}`).set('Authorization', token).expect(200);
  expect(detail.body.user).not.toHaveProperty('passwordHash');
  expect(detail.body.user).not.toHaveProperty('tokenVersion');
  const changedEmail = `ux-cuenta-${tag}@siga.invalid`;
  await request(app).patch(`/api/users/${studentUser.id}`).set('Authorization', token)
    .send({ email: changedEmail.toUpperCase(), firstName: 'Cuenta corregida' }).expect(200);
  await request(app).patch(`/api/users/${studentUser.id}`).set('Authorization', token).send({ email: admin.email }).expect(409);
  await request(app).patch(`/api/users/${studentUser.id}`).set('Authorization', token).send({ role: 'ADMIN' }).expect(400);
  const filteredUsers = await request(app).get(`/api/users?search=corregida&role=ESTUDIANTE&isActive=true&page=1&limit=20`).set('Authorization', token).expect(200);
  expect(filteredUsers.body.users.map((user) => user.id)).toEqual([studentUser.id]);
  await request(app).patch(`/api/users/${admin.id}/status`).set('Authorization', token).send({ isActive: false }).expect(400);

  const levels = {};
  const grades = {};
  for (const code of ['INICIAL', 'PRIMARIA', 'SECUNDARIA']) {
    let level = await prisma.educationLevel.findUnique({ where: { code } });
    if (!level) { level = await prisma.educationLevel.create({ data: { code, name: code === 'INICIAL' ? 'Inicial' : code === 'PRIMARIA' ? 'Primaria' : 'Secundaria' } }); ids.levels.push(level.id); }
    expect(level.isActive).toBe(true);
    levels[code] = level;
    const orders = code === 'INICIAL' ? [3, 4, 5] : code === 'PRIMARIA' ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5];
    for (const order of orders) {
      let grade = await prisma.grade.findUnique({ where: { educationLevelId_order: { educationLevelId: level.id, order } } });
      if (!grade) { grade = await prisma.grade.create({ data: { educationLevelId: level.id, order, name: code === 'INICIAL' ? `${order} años` : `${order}.º` } }); ids.grades.push(grade.id); }
      grades[`${code}-${order}`] = grade;
    }
  }
  const levelList = await request(app).get('/api/education-levels').set('Authorization', token).expect(200);
  expect(levelList.body.items.filter((item) => ['INICIAL', 'PRIMARIA', 'SECUNDARIA'].includes(item.code)).map((item) => item.code)).toEqual(['INICIAL', 'PRIMARIA', 'SECUNDARIA']);
  const secondaryGrades = await request(app).get(`/api/grades?educationLevelId=${levels.SECUNDARIA.id}`).set('Authorization', token).expect(200);
  expect(secondaryGrades.body.items.map((item) => item.order)).toEqual([1, 2, 3, 4, 5]);
  expect(secondaryGrades.body.items.every((item) => item.educationLevelId === levels.SECUNDARIA.id)).toBe(true);
  const initialGrades = await request(app).get(`/api/grades?educationLevelId=${levels.INICIAL.id}`).set('Authorization', token).expect(200);
  expect(initialGrades.body.items.map((item) => item.order)).toEqual([3, 4, 5]);

  const period = await prisma.academicPeriod.create({ data: { name: `UX-${tag}`, startDate: new Date('2026-01-01T00:00:00Z'), endDate: new Date('2026-12-31T00:00:00Z') } });
  ids.periods.push(period.id);
  const primarySection = await prisma.section.create({ data: { gradeId: grades['PRIMARIA-1'].id, academicPeriodId: period.id, name: 'ÚNICA' } });
  ids.sections.push(primarySection.id);
  const secondarySection = await prisma.section.create({ data: { gradeId: grades['SECUNDARIA-1'].id, academicPeriodId: period.id, name: 'ÚNICA' } });
  ids.sections.push(secondarySection.id);
  const sectionList = await request(app).get(`/api/sections?academicPeriodId=${period.id}`).set('Authorization', token).expect(200);
  expect(sectionList.body.items.map((item) => item.gradeId)).toEqual([primarySection.gradeId, secondarySection.gradeId]);
  const student = await prisma.student.create({ data: { studentCode: `UX-${tag.slice(0, 12)}`.toUpperCase(), firstName: 'Estudiante', lastName: 'Temporal', birthDate: new Date('2015-01-01T00:00:00Z'), userId: studentUser.id } });
  ids.students.push(student.id);
  const studentDetail = await request(app).get(`/api/students/${student.id}`).set('Authorization', bearer(secretary)).expect(200);
  expect(studentDetail.body.data.user).toMatchObject({ firstName: 'Cuenta corregida', email: changedEmail });
  expect(studentDetail.body.data.user).not.toHaveProperty('passwordHash');
  const teacher = await prisma.teacher.create({ data: { userId: teacherUser.id } });
  ids.teachers.push(teacher.id);
  const course = await prisma.course.create({ data: { code: `UX-${tag.slice(0, 10)}`.toUpperCase(), name: 'Curso temporal' } });
  ids.courses.push(course.id);
  const assignment = await prisma.teachingAssignment.create({ data: { courseId: course.id, sectionId: primarySection.id, teacherId: teacher.id } });
  ids.assignments.push(assignment.id);
  const enrollment = await prisma.enrollment.create({ data: { studentId: student.id, sectionId: primarySection.id, academicPeriodId: period.id } });
  ids.enrollments.push(enrollment.id);
  const gradeRecord = await prisma.gradeRecord.create({ data: { teachingAssignmentId: assignment.id, enrollmentId: enrollment.id, sectionId: primarySection.id, term: 1, value: 'A' } });
  ids.gradeRecords.push(gradeRecord.id);
  const attendanceRecord = await prisma.attendanceRecord.create({ data: { teachingAssignmentId: assignment.id, enrollmentId: enrollment.id, sectionId: primarySection.id, date: new Date('2026-06-01T00:00:00Z'), status: 'PRESENT' } });
  ids.attendanceRecords.push(attendanceRecord.id);

  await request(app).patch(`/api/academic-periods/${period.id}`).set('Authorization', token).send({ startDate: '2026-07-01' }).expect(409);
  await request(app).patch(`/api/academic-periods/${period.id}`).set('Authorization', token).send({ startDate: '2026-05-01' }).expect(200);
  await request(app).patch(`/api/academic-periods/${period.id}`).set('Authorization', token).send({ isActive: false }).expect(200);
  const historic = await request(app).get('/api/academic-periods?isActive=false').set('Authorization', token).expect(200);
  expect(historic.body.items.some((item) => item.id === period.id)).toBe(true);
  for (const [route, id] of [['sections', primarySection.id], ['enrollments', enrollment.id], ['teaching-assignments', assignment.id], ['grade-records', gradeRecord.id], ['attendance-records', attendanceRecord.id]]) {
    await request(app).get(`/api/${route}/${id}`).set('Authorization', token).expect(200);
  }
  expect(await prisma.enrollment.count({ where: { id: enrollment.id } })).toBe(1);
  expect(await prisma.gradeRecord.count({ where: { id: gradeRecord.id } })).toBe(1);
  expect(await prisma.attendanceRecord.count({ where: { id: attendanceRecord.id } })).toBe(1);
});
