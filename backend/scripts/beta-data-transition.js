const fs = require('node:fs');
const bcrypt = require('bcrypt');
const { PrismaClient, Prisma } = require('@prisma/client');
const { createUserSchema } = require('../src/validators/user.validator');
const {
  ControlledError, ROLES, FORBIDDEN, verifyDatabase, outsideRepository, backupReceipt,
  assertCleanLabels, requireConfirmation, checkAccessProof, emailDigest,
} = require('./beta-transition-core');

const KEYS = Object.keys(ROLES);
const date = (value) => new Date(`${value}T00:00:00.000Z`);
const gradeName = (code, order) => code === 'INICIAL' ? `${order} años` : `${order}.º`;
const gradeOrders = { INICIAL: [3, 4, 5], PRIMARIA: [1, 2, 3, 4, 5, 6], SECUNDARIA: [1, 2, 3, 4, 5] };

function credentials(env) {
  const result = {};
  for (const key of KEYS) {
    const [firstName, lastName, role] = ROLES[key];
    const parsed = createUserSchema.safeParse({
      email: env[`BETA_${key}_EMAIL`], password: env[`BETA_${key}_PASSWORD`],
      firstName, lastName, role,
    });
    if (!parsed.success) throw new ControlledError(`Falta una cuenta válida para ${key}; revisa el archivo local`);
    result[key] = parsed.data;
    assertCleanLabels([result[key].email, firstName, lastName]);
  }
  if (new Set(KEYS.map((key) => result[key].email)).size !== KEYS.length) {
    throw new ControlledError('Los seis correos deben ser distintos');
  }
  return result;
}

function legacyEmails(env) {
  const emails = Object.fromEntries(KEYS.map((key) => [key, env[`BETA_LEGACY_${key}_EMAIL`]?.trim().toLowerCase()]));
  if (Object.values(emails).some((email) => !/^demo-[a-z-]+@[a-z0-9.-]+\.invalid$/.test(email))
    || new Set(Object.values(emails)).size !== KEYS.length) {
    throw new ControlledError('Faltan los seis correos anteriores en el archivo local');
  }
  return emails;
}

async function requireLegacyCatalog(tx) {
  const levels = await tx.educationLevel.findMany({ include: { grades: true } });
  if (levels.length !== 2 || levels.reduce((sum, item) => sum + item.grades.length, 0) !== 2) {
    throw new ControlledError('El catálogo de partida cambió; no se modificó nada');
  }
  for (const code of ['PRIMARIA', 'SECUNDARIA']) {
    const level = levels.find((item) => item.code === code);
    if (!level || !level.isActive || level.name !== `DEMO ${code}`
      || level.grades.length !== 1 || level.grades[0].order !== 1
      || level.grades[0].name !== 'DEMO 1.º' || !level.grades[0].isActive) {
      throw new ControlledError('El catálogo de partida no coincide; revisión manual necesaria');
    }
  }
  return levels;
}

async function prepare(tx, people, hashes) {
  if (await tx.user.count({ where: { email: { in: KEYS.map((key) => people[key].email) } } })) {
    throw new ControlledError('La transición ya empezó o hay cuentas coincidentes; no se repite');
  }
  if (await tx.academicPeriod.findUnique({ where: { name: '2026' } })
    || await tx.course.count({ where: { code: { in: ['MAT-01', 'COM-01'] } } })
    || await tx.student.count({ where: { studentCode: { in: ['SIGA-2026-01', 'SIGA-2026-02'] } } })) {
    throw new ControlledError('Hay datos académicos coincidentes; no se sobrescriben');
  }
  const existing = await requireLegacyCatalog(tx);
  const levels = {};
  const grades = {};
  for (const [code, orders] of Object.entries(gradeOrders)) {
    const prior = existing.find((row) => row.code === code);
    levels[code] = prior
      ? await tx.educationLevel.update({ where: { id: prior.id }, data: { name: code[0] + code.slice(1).toLowerCase() } })
      : await tx.educationLevel.create({ data: { code, name: 'Inicial' } });
    grades[code] = {};
    for (const order of orders) {
      const priorGrade = prior?.grades.find((row) => row.order === order);
      grades[code][order] = priorGrade
        ? await tx.grade.update({ where: { id: priorGrade.id }, data: { name: gradeName(code, order) } })
        : await tx.grade.create({ data: { educationLevelId: levels[code].id, order, name: gradeName(code, order) } });
    }
  }
  const users = {};
  for (const key of KEYS) {
    const { password: _password, ...data } = people[key];
    users[key] = await tx.user.create({ data: { ...data, passwordHash: hashes[key] } });
  }
  const period = await tx.academicPeriod.create({ data: { name: '2026', startDate: date('2026-01-01'), endDate: date('2026-12-31') } });
  const sections = {
    A: await tx.section.create({ data: { name: 'A', gradeId: grades.PRIMARIA[1].id, academicPeriodId: period.id } }),
    B: await tx.section.create({ data: { name: 'B', gradeId: grades.SECUNDARIA[1].id, academicPeriodId: period.id } }),
  };
  const teachers = {
    A: await tx.teacher.create({ data: { userId: users.DOCENTE_A.id } }),
    B: await tx.teacher.create({ data: { userId: users.DOCENTE_B.id } }),
  };
  const students = {
    A: await tx.student.create({ data: { studentCode: 'SIGA-2026-01', firstName: 'Estudiante', lastName: '01', birthDate: date('2015-05-15'), userId: users.ESTUDIANTE_A.id } }),
    B: await tx.student.create({ data: { studentCode: 'SIGA-2026-02', firstName: 'Estudiante', lastName: '02', birthDate: date('2012-05-15'), userId: users.ESTUDIANTE_B.id } }),
  };
  const courses = {
    A: await tx.course.create({ data: { code: 'MAT-01', name: 'Matemática' } }),
    B: await tx.course.create({ data: { code: 'COM-01', name: 'Comunicación' } }),
  };
  for (const key of ['A', 'B']) {
    const sectionId = sections[key].id;
    const assignment = await tx.teachingAssignment.create({ data: { sectionId, courseId: courses[key].id, teacherId: teachers[key].id } });
    const enrollment = await tx.enrollment.create({ data: { sectionId, studentId: students[key].id, academicPeriodId: period.id } });
    await tx.gradeRecord.create({ data: { sectionId, teachingAssignmentId: assignment.id, enrollmentId: enrollment.id, term: 1, value: key === 'A' ? 'A' : 'B' } });
    await tx.attendanceRecord.create({ data: { sectionId, teachingAssignmentId: assignment.id, enrollmentId: enrollment.id, date: date('2026-09-30'), status: 'PRESENT' } });
  }
  return { adminId: users.ADMIN.id };
}

function assertLegacyGraph(graph, legacy) {
  const { users, students, teachers, period, sections, courses, assignments, enrollments, grades, attendance } = graph;
  if (users.length !== 6 || students.length !== 2 || teachers.length !== 2 || !period
    || sections.length !== 2 || courses.length !== 2 || assignments.length !== 2
    || enrollments.length !== 2 || grades.length !== 2 || attendance.length !== 2) {
    throw new ControlledError('El conjunto DEMO cambió; no se retiró ningún registro');
  }
  const byEmail = Object.fromEntries(users.map((item) => [item.email, item]));
  if (Object.values(legacy).some((email) => !byEmail[email])) throw new ControlledError('Faltan cuentas DEMO esperadas');
  const expectedUsers = [
    ['ADMIN', 'Admin', 'ADMIN'], ['SECRETARIA', 'Secretaria', 'SECRETARIA'],
    ['DOCENTE_A', 'Docente A', 'DOCENTE'], ['DOCENTE_B', 'Docente B', 'DOCENTE'],
    ['ESTUDIANTE_A', 'Estudiante A', 'ESTUDIANTE'], ['ESTUDIANTE_B', 'Estudiante B', 'ESTUDIANTE'],
  ];
  if (expectedUsers.some(([key, lastName, role]) => {
    const item = byEmail[legacy[key]];
    return item.firstName !== 'Demo' || item.lastName !== lastName || item.role !== role || !item.isActive;
  })
    || students.some((item) => item.firstName !== 'Demo' || !item.isActive)
    || courses.some((item) => item.name !== (item.code === 'DEMO-MAT' ? 'DEMO Matemática' : 'DEMO Comunicación') || !item.isActive)) {
    throw new ControlledError('Los datos DEMO fueron editados; requieren revisión manual');
  }
  const studentByKey = Object.fromEntries(students.map((item) => [item.studentCode.slice(-1), item]));
  const teacherByKey = Object.fromEntries(teachers.map((item) => [item.userId === byEmail[legacy.DOCENTE_A].id ? 'A' : 'B', item]));
  const sectionByKey = Object.fromEntries(sections.map((item) => [item.name.slice(-1), item]));
  const courseByKey = Object.fromEntries(courses.map((item) => [item.code.slice(-3) === 'MAT' ? 'A' : 'B', item]));
  if (period.name !== 'DEMO 2026' || period.startDate.toISOString().slice(0, 10) !== '2026-01-01'
    || period.endDate.toISOString().slice(0, 10) !== '2026-12-31') throw new ControlledError('Periodo DEMO inesperado');
  for (const key of ['A', 'B']) {
    const student = studentByKey[key];
    const teacher = teacherByKey[key];
    const section = sectionByKey[key];
    const course = courseByKey[key];
    const assignment = assignments.find((item) => item.courseId === course?.id);
    const enrollment = enrollments.find((item) => item.studentId === student?.id);
    if (!student || !teacher || !section || !course || !assignment || !enrollment
      || student.userId !== byEmail[legacy[`ESTUDIANTE_${key}`]].id
      || student.lastName !== `Estudiante ${key}` || student.studentCode !== `DEMO-EST-${key}`
      || teacher.userId !== byEmail[legacy[`DOCENTE_${key}`]].id
      || section.name !== `DEMO-${key}` || section.academicPeriodId !== period.id
      || section.grade?.order !== 1 || section.grade?.educationLevel?.code !== (key === 'A' ? 'PRIMARIA' : 'SECUNDARIA')
      || course.code !== (key === 'A' ? 'DEMO-MAT' : 'DEMO-COM')
      || assignment.sectionId !== section.id || assignment.teacherId !== teacher.id || !assignment.isActive
      || enrollment.sectionId !== section.id || enrollment.academicPeriodId !== period.id || enrollment.status !== 'ACTIVE'
      || grades.filter((item) => item.enrollmentId === enrollment.id && item.teachingAssignmentId === assignment.id && item.sectionId === section.id && item.term === 1 && item.value === (key === 'A' ? 'A' : 'B')).length !== 1
      || attendance.filter((item) => item.enrollmentId === enrollment.id && item.teachingAssignmentId === assignment.id && item.sectionId === section.id && item.status === 'PRESENT').length !== 1) {
      throw new ControlledError('Las relaciones DEMO cambiaron; no se retiró ningún registro');
    }
  }
}

async function readLegacyGraph(tx, legacy) {
  const users = await tx.user.findMany({ where: { email: { in: Object.values(legacy) } } });
  const userIds = users.map((item) => item.id);
  const students = await tx.student.findMany({ where: { studentCode: { in: ['DEMO-EST-A', 'DEMO-EST-B'] } } });
  const teachers = await tx.teacher.findMany({ where: { userId: { in: userIds } } });
  const period = await tx.academicPeriod.findUnique({ where: { name: 'DEMO 2026' } });
  const sections = await tx.section.findMany({ where: { academicPeriodId: period?.id }, include: { grade: { include: { educationLevel: true } } } });
  const courses = await tx.course.findMany({ where: { code: { in: ['DEMO-MAT', 'DEMO-COM'] } } });
  const assignments = await tx.teachingAssignment.findMany({ where: { OR: [{ sectionId: { in: sections.map((row) => row.id) } }, { courseId: { in: courses.map((row) => row.id) } }, { teacherId: { in: teachers.map((row) => row.id) } }] } });
  const enrollments = await tx.enrollment.findMany({ where: { OR: [{ sectionId: { in: sections.map((row) => row.id) } }, { studentId: { in: students.map((row) => row.id) } }, { academicPeriodId: period?.id }] } });
  const grades = await tx.gradeRecord.findMany({ where: { OR: [{ teachingAssignmentId: { in: assignments.map((row) => row.id) } }, { enrollmentId: { in: enrollments.map((row) => row.id) } }] } });
  const attendance = await tx.attendanceRecord.findMany({ where: { OR: [{ teachingAssignmentId: { in: assignments.map((row) => row.id) } }, { enrollmentId: { in: enrollments.map((row) => row.id) } }] } });
  return { users, students, teachers, period, sections, courses, assignments, enrollments, grades, attendance };
}

async function assertNoForbiddenLabels(tx) {
  const fields = [
    ['user', ['email', 'firstName', 'lastName']],
    ['educationLevel', ['name']], ['grade', ['name']], ['academicPeriod', ['name']],
    ['section', ['name']], ['student', ['studentCode', 'firstName', 'lastName']],
    ['course', ['code', 'name']],
  ];
  for (const [model, keys] of fields) {
    const rows = await tx[model].findMany({ select: Object.fromEntries(keys.map((key) => [key, true])) });
    if (rows.some((row) => keys.some((key) => FORBIDDEN.test(row[key])))) {
      throw new ControlledError('Quedan etiquetas no permitidas; retiro revertido');
    }
  }
}

async function retire(tx, people, proof, legacy) {
  const admin = await tx.user.findUnique({ where: { email: people.ADMIN.email } });
  if (!admin || !admin.isActive || admin.role !== 'ADMIN') throw new ControlledError('El nuevo ADMIN no está activo');
  checkAccessProof(proof, Object.fromEntries(KEYS.map((key) => [key, emailDigest(people[key].email)])), admin.id);
  const graph = await readLegacyGraph(tx, legacy);
  assertLegacyGraph(graph, legacy);
  for (const [model, rows] of [
    ['gradeRecord', graph.grades], ['attendanceRecord', graph.attendance],
    ['enrollment', graph.enrollments], ['teachingAssignment', graph.assignments],
    ['section', graph.sections], ['student', graph.students], ['teacher', graph.teachers],
    ['course', graph.courses], ['academicPeriod', [graph.period]], ['user', graph.users],
  ]) {
    const ids = rows.map((row) => row.id);
    const result = await tx[model].deleteMany({ where: { id: { in: ids } } });
    if (result.count !== ids.length) throw new ControlledError('El retiro no coincidió con los registros revisados');
  }
  await assertNoForbiddenLabels(tx);
  const counts = await Promise.all([tx.educationLevel.count(), tx.grade.count(), tx.user.count({ where: { id: admin.id, role: 'ADMIN', isActive: true } })]);
  if (counts[0] !== 3 || counts[1] !== 14 || counts[2] !== 1) throw new ControlledError('Catálogo o ADMIN incompleto; retiro revertido');
}

async function main() {
  const stage = process.argv[2];
  if (!['prepare', 'retire'].includes(stage)) throw new ControlledError('Etapa requerida: prepare o retire');
  requireConfirmation(process.env, stage);
  const prisma = new PrismaClient();
  try {
    const target = await verifyDatabase(prisma, process.env);
    const backup = backupReceipt(process.env.BETA_BACKUP_FILE, target.hostname);
    const people = credentials(process.env);
    const legacy = legacyEmails(process.env);
    if (stage === 'prepare') {
      const hashes = Object.fromEntries(await Promise.all(KEYS.map(async (key) => [key, await bcrypt.hash(people[key].password, 12)])));
      await prisma.$transaction(async (tx) => {
        await verifyDatabase(tx, process.env);
        return prepare(tx, people, hashes);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10000, timeout: 120000 });
      console.log('Datos nuevos preparados; el ADMIN anterior permanece. Verifica accesos antes del retiro.');
    } else {
      const proofFile = outsideRepository(process.env.BETA_ACCESS_PROOF_FILE);
      const proof = JSON.parse(fs.readFileSync(proofFile, 'utf8'));
      if (proof.archiveSha256 !== backup.archiveSha256) throw new ControlledError('La comprobación API no corresponde al respaldo verificado');
      await prisma.$transaction(async (tx) => {
        await verifyDatabase(tx, process.env);
        return retire(tx, people, proof, legacy);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10000, timeout: 120000 });
      console.log('Registros anteriores retirados; catálogo y ADMIN nuevo verificados.');
    }
  } finally { await prisma.$disconnect(); }
}

if (require.main === module) main().catch((error) => {
  console.error(error instanceof ControlledError ? error.message : 'No se pudo completar la transición; revisa el entorno y el estado de la base.');
  process.exitCode = 1;
});

module.exports = { credentials, legacyEmails, requireLegacyCatalog, prepare, assertLegacyGraph, readLegacyGraph, retire, assertNoForbiddenLabels };
