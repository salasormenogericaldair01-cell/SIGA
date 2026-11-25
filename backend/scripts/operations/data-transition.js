const fs = require('node:fs');
const bcrypt = require('bcrypt');
const { Op, Transaction } = require('sequelize');
const defaultModels = require('../../src/models');
const { createUserSchema } = require('../../src/modules/users/users.validator');
const {
  ControlledError, ROLES, FORBIDDEN, verifyDatabase, outsideRepository, backupReceipt,
  assertCleanLabels, requireConfirmation, checkAccessProof, emailDigest,
} = require('./data-transition-core');

const KEYS = Object.keys(ROLES);
const date = (value) => value;
const gradeName = (code, order) => (code === 'INICIAL' ? `${order} años` : `${order}.º`);
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

async function requireLegacyCatalog(transaction, db = defaultModels) {
  const levels = await db.EducationLevel.findAll({
    include: [{ model: db.Grade, as: 'grades' }],
    transaction,
  });
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

async function prepare(transaction, people, hashes, db = defaultModels) {
  if (await db.User.count({ where: { email: KEYS.map((key) => people[key].email) }, transaction })) {
    throw new ControlledError('La transición ya empezó o hay cuentas coincidentes; no se repite');
  }
  if (await db.AcademicPeriod.findOne({ where: { name: '2026' }, transaction })
    || await db.Course.count({ where: { code: ['MAT-01', 'COM-01'] }, transaction })
    || await db.Student.count({ where: { studentCode: ['SIGA-2026-01', 'SIGA-2026-02'] }, transaction })) {
    throw new ControlledError('Hay datos académicos coincidentes; no se sobrescriben');
  }
  const existing = await requireLegacyCatalog(transaction, db);
  const levels = {};
  const grades = {};
  for (const [code, orders] of Object.entries(gradeOrders)) {
    const prior = existing.find((row) => row.code === code);
    if (prior) {
      await prior.update({ name: code[0] + code.slice(1).toLowerCase() }, { transaction });
      levels[code] = prior;
    } else {
      levels[code] = await db.EducationLevel.create({ code, name: 'Inicial' }, { transaction });
    }
    grades[code] = {};
    for (const order of orders) {
      const priorGrade = prior?.grades.find((row) => row.order === order);
      if (priorGrade) {
        await priorGrade.update({ name: gradeName(code, order) }, { transaction });
        grades[code][order] = priorGrade;
      } else {
        grades[code][order] = await db.Grade.create(
          { educationLevelId: levels[code].id, order, name: gradeName(code, order) },
          { transaction },
        );
      }
    }
  }
  const users = {};
  for (const key of KEYS) {
    const { password: _password, ...data } = people[key];
    users[key] = await db.User.create({ ...data, passwordHash: hashes[key] }, { transaction });
  }
  const period = await db.AcademicPeriod.create(
    { name: '2026', startDate: date('2026-01-01'), endDate: date('2026-12-31') },
    { transaction },
  );
  const sections = {
    A: await db.Section.create({ name: 'A', gradeId: grades.PRIMARIA[1].id, academicPeriodId: period.id }, { transaction }),
    B: await db.Section.create({ name: 'B', gradeId: grades.SECUNDARIA[1].id, academicPeriodId: period.id }, { transaction }),
  };
  const teachers = {
    A: await db.Teacher.create({ userId: users.DOCENTE_A.id }, { transaction }),
    B: await db.Teacher.create({ userId: users.DOCENTE_B.id }, { transaction }),
  };
  const students = {
    A: await db.Student.create(
      { studentCode: 'SIGA-2026-01', firstName: 'Estudiante', lastName: '01', birthDate: date('2015-05-15'), userId: users.ESTUDIANTE_A.id },
      { transaction },
    ),
    B: await db.Student.create(
      { studentCode: 'SIGA-2026-02', firstName: 'Estudiante', lastName: '02', birthDate: date('2012-05-15'), userId: users.ESTUDIANTE_B.id },
      { transaction },
    ),
  };
  const courses = {
    A: await db.Course.create({ code: 'MAT-01', name: 'Matemática' }, { transaction }),
    B: await db.Course.create({ code: 'COM-01', name: 'Comunicación' }, { transaction }),
  };
  for (const key of ['A', 'B']) {
    const sectionId = sections[key].id;
    const assignment = await db.TeachingAssignment.create(
      { sectionId, courseId: courses[key].id, teacherId: teachers[key].id },
      { transaction },
    );
    const enrollment = await db.Enrollment.create(
      { sectionId, studentId: students[key].id, academicPeriodId: period.id },
      { transaction },
    );
    await db.GradeRecord.create(
      { sectionId, teachingAssignmentId: assignment.id, enrollmentId: enrollment.id, term: 1, value: key === 'A' ? 'A' : 'B' },
      { transaction },
    );
    await db.AttendanceRecord.create(
      { sectionId, teachingAssignmentId: assignment.id, enrollmentId: enrollment.id, date: date('2026-09-30'), status: 'PRESENT' },
      { transaction },
    );
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
  const isoDate = (value) => (value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10));
  if (period.name !== 'DEMO 2026' || isoDate(period.startDate) !== '2026-01-01' || isoDate(period.endDate) !== '2026-12-31') {
    throw new ControlledError('Periodo DEMO inesperado');
  }
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

async function readLegacyGraph(transaction, legacy, db = defaultModels) {
  const users = await db.User.findAll({ where: { email: Object.values(legacy) }, transaction });
  const userIds = users.map((item) => item.id);
  const students = await db.Student.findAll({ where: { studentCode: ['DEMO-EST-A', 'DEMO-EST-B'] }, transaction });
  const teachers = await db.Teacher.findAll({ where: { userId: userIds }, transaction });
  const period = await db.AcademicPeriod.findOne({ where: { name: 'DEMO 2026' }, transaction });
  const sections = await db.Section.findAll({
    where: { academicPeriodId: period?.id || null },
    include: [{ model: db.Grade, as: 'grade', include: [{ model: db.EducationLevel, as: 'educationLevel' }] }],
    transaction,
  });
  const courses = await db.Course.findAll({ where: { code: ['DEMO-MAT', 'DEMO-COM'] }, transaction });
  const assignments = await db.TeachingAssignment.findAll({
    where: {
      [Op.or]: [
        { sectionId: sections.map((row) => row.id) },
        { courseId: courses.map((row) => row.id) },
        { teacherId: teachers.map((row) => row.id) },
      ],
    },
    transaction,
  });
  const enrollments = await db.Enrollment.findAll({
    where: {
      [Op.or]: [
        { sectionId: sections.map((row) => row.id) },
        { studentId: students.map((row) => row.id) },
        { academicPeriodId: period?.id || null },
      ],
    },
    transaction,
  });
  const grades = await db.GradeRecord.findAll({
    where: {
      [Op.or]: [
        { teachingAssignmentId: assignments.map((row) => row.id) },
        { enrollmentId: enrollments.map((row) => row.id) },
      ],
    },
    transaction,
  });
  const attendance = await db.AttendanceRecord.findAll({
    where: {
      [Op.or]: [
        { teachingAssignmentId: assignments.map((row) => row.id) },
        { enrollmentId: enrollments.map((row) => row.id) },
      ],
    },
    transaction,
  });
  return { users, students, teachers, period, sections, courses, assignments, enrollments, grades, attendance };
}

async function assertNoForbiddenLabels(transaction, db = defaultModels) {
  const fields = [
    ['User', ['email', 'firstName', 'lastName']],
    ['EducationLevel', ['name']], ['Grade', ['name']], ['AcademicPeriod', ['name']],
    ['Section', ['name']], ['Student', ['studentCode', 'firstName', 'lastName']],
    ['Course', ['code', 'name']],
  ];
  for (const [model, keys] of fields) {
    const rows = await db[model].findAll({ attributes: keys, raw: true, transaction });
    if (rows.some((row) => keys.some((key) => FORBIDDEN.test(row[key])))) {
      throw new ControlledError('Quedan etiquetas no permitidas; retiro revertido');
    }
  }
}

async function retire(transaction, people, proof, legacy, db = defaultModels) {
  const admin = await db.User.findOne({ where: { email: people.ADMIN.email }, transaction });
  if (!admin || !admin.isActive || admin.role !== 'ADMIN') throw new ControlledError('El nuevo ADMIN no está activo');
  checkAccessProof(proof, Object.fromEntries(KEYS.map((key) => [key, emailDigest(people[key].email)])), admin.id);
  const graph = await readLegacyGraph(transaction, legacy, db);
  assertLegacyGraph(graph, legacy);
  for (const [model, rows] of [
    ['GradeRecord', graph.grades], ['AttendanceRecord', graph.attendance],
    ['Enrollment', graph.enrollments], ['TeachingAssignment', graph.assignments],
    ['Section', graph.sections], ['Student', graph.students], ['Teacher', graph.teachers],
    ['Course', graph.courses], ['AcademicPeriod', [graph.period]], ['User', graph.users],
  ]) {
    const ids = rows.map((row) => row.id);
    const deleted = await db[model].destroy({ where: { id: ids }, transaction });
    if (deleted !== ids.length) throw new ControlledError('El retiro no coincidió con los registros revisados');
  }
  await assertNoForbiddenLabels(transaction, db);
  const counts = await Promise.all([
    db.EducationLevel.count({ transaction }),
    db.Grade.count({ transaction }),
    db.User.count({ where: { id: admin.id, role: 'ADMIN', isActive: true }, transaction }),
  ]);
  if (counts[0] !== 3 || counts[1] !== 14 || counts[2] !== 1) throw new ControlledError('Catálogo o ADMIN incompleto; retiro revertido');
}

async function main() {
  const stage = process.argv[2];
  if (!['prepare', 'retire'].includes(stage)) throw new ControlledError('Etapa requerida: prepare o retire');
  requireConfirmation(process.env, stage);
  const { sequelize } = defaultModels;
  try {
    const target = await verifyDatabase(sequelize, process.env);
    const backup = backupReceipt(process.env.BETA_BACKUP_FILE, target.hostname);
    const people = credentials(process.env);
    const legacy = legacyEmails(process.env);
    if (stage === 'prepare') {
      const hashes = Object.fromEntries(await Promise.all(KEYS.map(async (key) => [key, await bcrypt.hash(people[key].password, 12)])));
      await sequelize.transaction(
        { isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE },
        async (transaction) => {
          await verifyDatabase(sequelize, process.env, transaction);
          return prepare(transaction, people, hashes, defaultModels);
        },
      );
      console.log('Datos nuevos preparados; el ADMIN anterior permanece. Verifica accesos antes del retiro.');
    } else {
      const proofFile = outsideRepository(process.env.BETA_ACCESS_PROOF_FILE);
      const proof = JSON.parse(fs.readFileSync(proofFile, 'utf8'));
      if (proof.archiveSha256 !== backup.archiveSha256) throw new ControlledError('La comprobación API no corresponde al respaldo verificado');
      await sequelize.transaction(
        { isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE },
        async (transaction) => {
          await verifyDatabase(sequelize, process.env, transaction);
          return retire(transaction, people, proof, legacy, defaultModels);
        },
      );
      console.log('Registros anteriores retirados; catálogo y ADMIN nuevo verificados.');
    }
  } finally {
    await sequelize.close();
  }
}

if (require.main === module) main().catch((error) => {
  console.error(error instanceof ControlledError ? error.message : 'No se pudo completar la transición; revisa el entorno y el estado de la base.');
  process.exitCode = 1;
});

module.exports = { credentials, legacyEmails, requireLegacyCatalog, prepare, assertLegacyGraph, readLegacyGraph, retire, assertNoForbiddenLabels };
