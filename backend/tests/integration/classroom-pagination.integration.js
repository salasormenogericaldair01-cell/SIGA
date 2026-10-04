const request = require('supertest');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('node:crypto');
const prisma = require('../../src/config/prisma');
const { createApp } = require('../../src/app');

const app = createApp();
const ids = { users: [], teachers: [], students: [], enrollments: [], sections: [], periods: [], courses: [], assignments: [], levels: [], grades: [] };
let verified = false;
let first;
let second;
let assignmentA;
let assignmentB;

function auth(user) {
  return `Bearer ${jwt.sign({ tokenVersion: user.tokenVersion }, process.env.JWT_SECRET, {
    algorithm: 'HS256', subject: user.id, expiresIn: '1h',
  })}`;
}

beforeAll(async () => {
  const url = new URL(process.env.DATABASE_URL);
  const [target] = await prisma.$queryRaw`SELECT current_database() AS name, inet_server_port() AS port`;
  if (!['127.0.0.1', 'localhost'].includes(url.hostname) || url.port !== '5433' || url.pathname !== '/siga_test'
      || target.name !== 'siga_test' || target.port !== 5433) {
    throw new Error('La prueba de 125 matrículas exige siga_test en localhost:5433');
  }
  verified = true;

  let grade = await prisma.grade.findFirst({ where: { isActive: true, educationLevel: { isActive: true } } });
  if (!grade) {
    let level = await prisma.educationLevel.findFirst({ where: { isActive: true }, include: { grades: true } });
    if (!level) {
      const existing = await prisma.educationLevel.findMany({ select: { code: true } });
      const code = ['INICIAL', 'PRIMARIA', 'SECUNDARIA'].find((item) => !existing.some((entry) => entry.code === item));
      if (!code) throw new Error('No existe un nivel activo ni un código libre para la prueba');
      level = await prisma.educationLevel.create({ data: { code, name: 'Nivel temporal' }, include: { grades: true } });
      ids.levels.push(level.id);
    }
    const range = level.code === 'INICIAL' ? [3, 4, 5] : level.code === 'PRIMARIA' ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5];
    const order = range.find((number) => !level.grades.some((item) => item.order === number));
    if (!order) throw new Error('No hay grado activo ni orden libre para la prueba');
    grade = await prisma.grade.create({ data: { educationLevelId: level.id, name: 'Grado temporal', order } });
    ids.grades.push(grade.id);
  }

  const period = await prisma.academicPeriod.create({ data: { name: `PR-${randomUUID()}`, startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31') } });
  ids.periods.push(period.id);
  const sections = await Promise.all(['A', 'B'].map((name) => prisma.section.create({ data: { gradeId: grade.id, academicPeriodId: period.id, name } })));
  ids.sections.push(...sections.map((item) => item.id));

  const people = [];
  for (const label of ['A', 'B']) {
    const user = await prisma.user.create({ data: { email: `roster-${randomUUID()}@test.invalid`, passwordHash: 'not-used-for-login', firstName: 'Docente', lastName: label, role: 'DOCENTE' } });
    ids.users.push(user.id);
    const teacher = await prisma.teacher.create({ data: { userId: user.id } });
    ids.teachers.push(teacher.id);
    people.push({ user, teacher });
  }
  [first, second] = people;
  const courses = await Promise.all(['A', 'B'].map((name) => prisma.course.create({ data: { code: `ROSTER-${randomUUID()}`.toUpperCase(), name: `Curso ${name}` } })));
  ids.courses.push(...courses.map((item) => item.id));
  assignmentA = await prisma.teachingAssignment.create({ data: { courseId: courses[0].id, sectionId: sections[0].id, teacherId: first.teacher.id } });
  assignmentB = await prisma.teachingAssignment.create({ data: { courseId: courses[1].id, sectionId: sections[1].id, teacherId: second.teacher.id } });
  ids.assignments.push(assignmentA.id, assignmentB.id);

  const students = Array.from({ length: 126 }, (_, index) => ({ id: randomUUID(), studentCode: `ROSTER-${randomUUID()}`.toUpperCase(), firstName: `Alumno ${index + 1}`, lastName: 'Temporal', birthDate: new Date('2012-01-01') }));
  await prisma.student.createMany({ data: students });
  ids.students.push(...students.map((item) => item.id));
  const enrollments = students.map((student, index) => ({ id: randomUUID(), studentId: student.id, sectionId: index < 125 ? sections[0].id : sections[1].id, academicPeriodId: period.id }));
  await prisma.enrollment.createMany({ data: enrollments });
  ids.enrollments.push(...enrollments.map((item) => item.id));
});

afterAll(async () => {
  if (verified) {
    await prisma.enrollment.deleteMany({ where: { id: { in: ids.enrollments } } });
    await prisma.teachingAssignment.deleteMany({ where: { id: { in: ids.assignments } } });
    await prisma.student.deleteMany({ where: { id: { in: ids.students } } });
    await prisma.teacher.deleteMany({ where: { id: { in: ids.teachers } } });
    await prisma.section.deleteMany({ where: { id: { in: ids.sections } } });
    await prisma.academicPeriod.deleteMany({ where: { id: { in: ids.periods } } });
    await prisma.course.deleteMany({ where: { id: { in: ids.courses } } });
    await prisma.grade.deleteMany({ where: { id: { in: ids.grades } } });
    await prisma.educationLevel.deleteMany({ where: { id: { in: ids.levels } } });
    await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
    expect(await prisma.enrollment.count({ where: { id: { in: ids.enrollments } } })).toBe(0);
    expect(await prisma.student.count({ where: { id: { in: ids.students } } })).toBe(0);
    expect(await prisma.teachingAssignment.count({ where: { id: { in: ids.assignments } } })).toBe(0);
  }
  await prisma.$disconnect();
});

test('PostgreSQL: 125 matrículas paginadas y alcance exclusivo por docente', async () => {
  const routeA = `/api/teaching-assignments/${assignmentA.id}/enrollments`;
  const routeB = `/api/teaching-assignments/${assignmentB.id}/enrollments`;
  const page1 = await request(app).get(`${routeA}?status=ACTIVE&page=1&limit=100`).set('Authorization', auth(first.user)).expect(200);
  const page2 = await request(app).get(`${routeA}?status=ACTIVE&page=2&limit=100`).set('Authorization', auth(first.user)).expect(200);
  const back = await request(app).get(`${routeA}?status=ACTIVE&page=1&limit=100`).set('Authorization', auth(first.user)).expect(200);
  expect([page1.body.data.length, page2.body.data.length]).toEqual([100, 25]);
  expect(page2.body.pagination).toMatchObject({ page: 2, total: 125, totalPages: 2 });
  expect(back.body.data.map((item) => item.id)).toEqual(page1.body.data.map((item) => item.id));
  expect(new Set([...page1.body.data, ...page2.body.data].map((item) => item.id)).size).toBe(125);
  expect(page1.body.data.every((item) => item.sectionId === assignmentA.sectionId)).toBe(true);
  expect(page2.body.data.every((item) => item.sectionId === assignmentA.sectionId)).toBe(true);
  expect(JSON.stringify(page1.body)).not.toMatch(/passwordHash|tokenVersion/);

  const other = await request(app).get(`${routeB}?status=ACTIVE&page=1&limit=100`).set('Authorization', auth(second.user)).expect(200);
  expect(other.body.pagination.total).toBe(1);
  expect(page1.body.data.some((item) => item.id === other.body.data[0].id)).toBe(false);
  const deniedA = await request(app).get(routeA).set('Authorization', auth(second.user)).expect(403);
  const deniedB = await request(app).get(routeB).set('Authorization', auth(first.user)).expect(403);
  const foreignDetail = await request(app).get(`/api/teaching-assignments/${assignmentB.id}`).set('Authorization', auth(first.user)).expect(403);
  const missing = await request(app).get(`/api/teaching-assignments/${randomUUID()}`).set('Authorization', auth(first.user)).expect(404);
  for (const response of [deniedA, deniedB, foreignDetail, missing]) {
    expect(JSON.stringify(response.body)).not.toMatch(/passwordHash|tokenVersion|"token"\s*:|PrismaClient|"stack"\s*:|postgresql:\/\/|SELECT\s+.+FROM/i);
  }
  const filtered = await request(app).get(`/api/teaching-assignments?teacherId=${second.teacher.id}`).set('Authorization', auth(first.user)).expect(200);
  expect(filtered.body.pagination.total).toBe(0);
  expect(await prisma.enrollment.count({ where: { id: { in: ids.enrollments } } })).toBe(126);
});
