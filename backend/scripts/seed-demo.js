const fs = require('node:fs');
const path = require('node:path');
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const { createUserSchema } = require('../src/validators/user.validator');
const verifyTarget = require('./verify-demo-target');

const prisma = new PrismaClient();
const kinds = ['attendanceRecord', 'gradeRecord', 'enrollment', 'teachingAssignment', 'course', 'section', 'academicPeriod', 'grade', 'educationLevel', 'teacher', 'student', 'user'];
const created = Object.fromEntries(kinds.map((kind) => [kind, []]));

function fail(message) { throw new Error(`Colisión DEMO incompatible: ${message}`); }
function remember(kind, record) { created[kind].push(record.id); return record; }
function manifestPath(target) { return path.resolve(__dirname, `../.env.demo-${target}-manifest.json`); }
function limaToday() {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const pick = (type) => parts.find((part) => part.type === type).value;
  return `${pick('year')}-${pick('month')}-${pick('day')}`;
}

async function main() {
  const target = process.env.DEMO_TARGET;
  await verifyTarget(prisma, target);
  const passwords = {
    admin: process.env.DEMO_ADMIN_PASSWORD,
    secretaria: process.env.DEMO_SECRETARIA_PASSWORD,
    docenteA: process.env.DEMO_DOCENTE_A_PASSWORD,
    docenteB: process.env.DEMO_DOCENTE_B_PASSWORD,
    estudianteA: process.env.DEMO_ESTUDIANTE_A_PASSWORD,
    estudianteB: process.env.DEMO_ESTUDIANTE_B_PASSWORD,
  };
  const people = [
    ['admin', 'demo-admin@siga.invalid', 'Demo', 'Admin', 'ADMIN'],
    ['secretaria', 'demo-secretaria@siga.invalid', 'Demo', 'Secretaria', 'SECRETARIA'],
    ['docenteA', 'demo-docente-a@siga.invalid', 'Demo', 'Docente A', 'DOCENTE'],
    ['docenteB', 'demo-docente-b@siga.invalid', 'Demo', 'Docente B', 'DOCENTE'],
    ['estudianteA', 'demo-estudiante-a@siga.invalid', 'Demo', 'Estudiante A', 'ESTUDIANTE'],
    ['estudianteB', 'demo-estudiante-b@siga.invalid', 'Demo', 'Estudiante B', 'ESTUDIANTE'],
  ];
  const valid = people.map(([key, email, firstName, lastName, role]) => {
    const parsed = createUserSchema.safeParse({ email, firstName, lastName, role, password: passwords[key] });
    if (!parsed.success) throw new Error(`Falta una contraseña DEMO válida para ${key} (12 caracteres, máximo 72 bytes)`);
    return [key, parsed.data];
  });
  const hashes = Object.fromEntries(await Promise.all(valid.map(async ([key, data]) => [key, await bcrypt.hash(data.password, 12)])));
  const today = limaToday();
  const year = Number(today.slice(0, 4));
  const startDate = new Date(`${year}-01-01T00:00:00.000Z`);
  const endDate = new Date(`${year}-12-31T00:00:00.000Z`);

  await prisma.$transaction(async (tx) => {
    const users = {};
    for (const [key, data] of valid) {
      const existing = await tx.user.findUnique({ where: { email: data.email } });
      if (existing) {
        if (existing.role !== data.role || !existing.isActive || !await bcrypt.compare(data.password, existing.passwordHash)) fail(`cuenta ${key}`);
        users[key] = existing;
      } else {
        users[key] = remember('user', await tx.user.create({ data: { email: data.email, firstName: data.firstName, lastName: data.lastName, role: data.role, passwordHash: hashes[key] } }));
      }
    }

    const levels = {};
    const grades = {};
    for (const [code, order] of [['PRIMARIA', 1], ['SECUNDARIA', 1]]) {
      let level = await tx.educationLevel.findUnique({ where: { code } });
      if (level && !level.isActive) fail(`nivel ${code} inactivo`);
      if (!level) level = remember('educationLevel', await tx.educationLevel.create({ data: { code, name: `DEMO ${code}` } }));
      levels[code] = level;
      let grade = await tx.grade.findUnique({ where: { educationLevelId_order: { educationLevelId: level.id, order } } });
      if (grade && !grade.isActive) fail(`grado ${code} inactivo`);
      if (!grade) grade = remember('grade', await tx.grade.create({ data: { educationLevelId: level.id, order, name: 'DEMO 1.º' } }));
      grades[code] = grade;
    }

    const periodName = `DEMO ${year}`;
    let period = await tx.academicPeriod.findUnique({ where: { name: periodName } });
    if (period && (!period.isActive || period.startDate > new Date(`${today}T00:00:00.000Z`) || period.endDate < new Date(`${today}T00:00:00.000Z`))) fail('periodo');
    if (!period) period = remember('academicPeriod', await tx.academicPeriod.create({ data: { name: periodName, startDate, endDate } }));

    const sections = {};
    for (const [key, grade] of [['A', grades.PRIMARIA], ['B', grades.SECUNDARIA]]) {
      const name = `DEMO-${key}`;
      let section = await tx.section.findUnique({ where: { gradeId_academicPeriodId_name: { gradeId: grade.id, academicPeriodId: period.id, name } } });
      if (section && !section.isActive) fail(`sección ${key} inactiva`);
      if (!section) section = remember('section', await tx.section.create({ data: { gradeId: grade.id, academicPeriodId: period.id, name } }));
      sections[key] = section;
    }

    const students = {};
    const teachers = {};
    for (const key of ['A', 'B']) {
      const user = users[`estudiante${key}`];
      const studentCode = `DEMO-EST-${key}`;
      let student = await tx.student.findUnique({ where: { studentCode } });
      if (student && (student.userId !== user.id || !student.isActive)) fail(`estudiante ${key}`);
      if (!student) {
        if (await tx.student.findUnique({ where: { userId: user.id } })) fail(`cuenta estudiante ${key} vinculada`);
        student = remember('student', await tx.student.create({ data: { studentCode, firstName: 'Demo', lastName: `Estudiante ${key}`, birthDate: new Date('2015-05-15T00:00:00.000Z'), userId: user.id } }));
      }
      students[key] = student;
      const teacherUser = users[`docente${key}`];
      let teacher = await tx.teacher.findUnique({ where: { userId: teacherUser.id } });
      if (teacher && !teacher.isActive) fail(`docente ${key} inactivo`);
      if (!teacher) teacher = remember('teacher', await tx.teacher.create({ data: { userId: teacherUser.id } }));
      teachers[key] = teacher;
    }

    const courses = {};
    const assignments = {};
    const enrollments = {};
    for (const [key, code, name] of [['A', 'DEMO-MAT', 'DEMO Matemática'], ['B', 'DEMO-COM', 'DEMO Comunicación']]) {
      let course = await tx.course.findUnique({ where: { code } });
      if (course && !course.isActive) fail(`curso ${key} inactivo`);
      if (!course) course = remember('course', await tx.course.create({ data: { code, name } }));
      courses[key] = course;
      let assignment = await tx.teachingAssignment.findUnique({ where: { courseId_sectionId: { courseId: course.id, sectionId: sections[key].id } } });
      if (assignment && (assignment.teacherId !== teachers[key].id || !assignment.isActive)) fail(`asignación ${key}`);
      if (!assignment) assignment = remember('teachingAssignment', await tx.teachingAssignment.create({ data: { courseId: course.id, sectionId: sections[key].id, teacherId: teachers[key].id } }));
      assignments[key] = assignment;
      let enrollment = await tx.enrollment.findUnique({ where: { studentId_academicPeriodId: { studentId: students[key].id, academicPeriodId: period.id } } });
      if (enrollment && (enrollment.sectionId !== sections[key].id || enrollment.status !== 'ACTIVE')) fail(`matrícula ${key}`);
      if (!enrollment) enrollment = remember('enrollment', await tx.enrollment.create({ data: { studentId: students[key].id, sectionId: sections[key].id, academicPeriodId: period.id } }));
      enrollments[key] = enrollment;
    }

    for (const key of ['A', 'B']) {
      const gradeWhere = { teachingAssignmentId_enrollmentId_term: { teachingAssignmentId: assignments[key].id, enrollmentId: enrollments[key].id, term: 1 } };
      if (!await tx.gradeRecord.findUnique({ where: gradeWhere })) remember('gradeRecord', await tx.gradeRecord.create({ data: { teachingAssignmentId: assignments[key].id, enrollmentId: enrollments[key].id, sectionId: sections[key].id, term: 1, value: key === 'A' ? 'A' : 'B' } }));
      const date = new Date(`${today}T00:00:00.000Z`);
      const attendanceWhere = { teachingAssignmentId_enrollmentId_date: { teachingAssignmentId: assignments[key].id, enrollmentId: enrollments[key].id, date } };
      if (!await tx.attendanceRecord.findUnique({ where: attendanceWhere })) remember('attendanceRecord', await tx.attendanceRecord.create({ data: { teachingAssignmentId: assignments[key].id, enrollmentId: enrollments[key].id, sectionId: sections[key].id, date, status: 'PRESENT' } }));
    }
  });

  const file = manifestPath(target);
  const previous = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  const merged = Object.fromEntries(kinds.map((kind) => [kind, [...new Set([...(previous[kind] || []), ...created[kind]])]]));
  fs.writeFileSync(file, JSON.stringify(merged, null, 2));
  console.log(`Datos DEMO listos en ${target}. Nuevos registros: ${Object.values(created).reduce((sum, ids) => sum + ids.length, 0)}.`);
}

main().catch((error) => {
  console.error(error.message?.startsWith('Colisión DEMO') ? error.message : `No se pudo preparar la demo: ${error.code || error.name}`);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
