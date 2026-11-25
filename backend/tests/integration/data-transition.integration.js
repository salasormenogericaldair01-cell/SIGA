const crypto = require('node:crypto');
const bcrypt = require('bcrypt');
const { Transaction } = require('sequelize');
const allModels = require('../../src/models');
const { credentials, legacyEmails, prepare, retire, assertNoForbiddenLabels } = require('../../scripts/operations/data-transition');
const { ROLES, emailDigest } = require('../../scripts/operations/data-transition-core');

const { sequelize } = allModels;

jest.setTimeout(120000);
const models = [
  'User', 'EducationLevel', 'Grade', 'AcademicPeriod', 'Section', 'Student', 'Teacher',
  'Course', 'TeachingAssignment', 'Enrollment', 'GradeRecord', 'AttendanceRecord',
];
const day = (value) => value;
const undo = new Error('rollback intencional de registros exclusivos de esta prueba');

async function verifyTestDestination(transaction) {
  const url = new URL(process.env.DATABASE_URL);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)
    || url.hostname !== '127.0.0.1' || url.port !== '5433'
    || decodeURIComponent(url.pathname) !== '/siga_test') {
    throw new Error('Este ensayo solo admite siga_test en 127.0.0.1:5433');
  }
  const [rows] = await sequelize.query(
    'SELECT current_database() AS name, inet_server_port() AS port',
    transaction ? { transaction } : undefined,
  );
  const [row] = rows;
  if (row.name !== 'siga_test' || row.port !== 5433) throw new Error('El destino PostgreSQL de la prueba no coincide');
}

async function counts(transaction) {
  const result = {};
  for (const model of models) {
    result[model] = await allModels[model].count(transaction ? { transaction } : undefined);
  }
  return result;
}

function fixture() {
  const suffix = crypto.randomBytes(6).toString('hex');
  const env = {};
  const legacyNames = {
    ADMIN: 'admin', SECRETARIA: 'secretaria', DOCENTE_A: 'docente-a',
    DOCENTE_B: 'docente-b', ESTUDIANTE_A: 'estudiante-a', ESTUDIANTE_B: 'estudiante-b',
  };
  for (const [key, name] of Object.entries(legacyNames)) {
    env[`BETA_LEGACY_${key}_EMAIL`] = `demo-${name}@run-${suffix}.invalid`;
    env[`BETA_${key}_EMAIL`] = `${name}@run-${suffix}.invalid`;
    env[`BETA_${key}_PASSWORD`] = crypto.randomBytes(24).toString('base64url');
  }
  return { people: credentials(env), legacy: legacyEmails(env) };
}

async function seedObservedGraph(transaction, legacy) {
  const levels = {};
  const grades = {};
  for (const code of ['PRIMARIA', 'SECUNDARIA']) {
    levels[code] = await allModels.EducationLevel.create({ code, name: `DEMO ${code}` }, { transaction });
    grades[code] = await allModels.Grade.create({ educationLevelId: levels[code].id, order: 1, name: 'DEMO 1.º' }, { transaction });
  }
  const userInfo = {
    ADMIN: ['Admin', 'ADMIN'], SECRETARIA: ['Secretaria', 'SECRETARIA'],
    DOCENTE_A: ['Docente A', 'DOCENTE'], DOCENTE_B: ['Docente B', 'DOCENTE'],
    ESTUDIANTE_A: ['Estudiante A', 'ESTUDIANTE'], ESTUDIANTE_B: ['Estudiante B', 'ESTUDIANTE'],
  };
  const users = {};
  for (const [key, [lastName, role]] of Object.entries(userInfo)) {
    users[key] = await allModels.User.create({
      email: legacy[key], firstName: 'Demo', lastName, role,
      passwordHash: await bcrypt.hash(crypto.randomBytes(24).toString('base64url'), 10),
    }, { transaction });
  }
  const period = await allModels.AcademicPeriod.create({ name: 'DEMO 2026', startDate: day('2026-01-01'), endDate: day('2026-12-31') }, { transaction });
  for (const key of ['A', 'B']) {
    const levelCode = key === 'A' ? 'PRIMARIA' : 'SECUNDARIA';
    const section = await allModels.Section.create({ gradeId: grades[levelCode].id, academicPeriodId: period.id, name: `DEMO-${key}` }, { transaction });
    const teacher = await allModels.Teacher.create({ userId: users[`DOCENTE_${key}`].id }, { transaction });
    const student = await allModels.Student.create({
      studentCode: `DEMO-EST-${key}`, firstName: 'Demo', lastName: `Estudiante ${key}`,
      birthDate: day(key === 'A' ? '2015-05-15' : '2012-05-15'), userId: users[`ESTUDIANTE_${key}`].id,
    }, { transaction });
    const course = await allModels.Course.create({ code: key === 'A' ? 'DEMO-MAT' : 'DEMO-COM', name: key === 'A' ? 'DEMO Matemática' : 'DEMO Comunicación' }, { transaction });
    const assignment = await allModels.TeachingAssignment.create({ courseId: course.id, sectionId: section.id, teacherId: teacher.id }, { transaction });
    const enrollment = await allModels.Enrollment.create({ studentId: student.id, sectionId: section.id, academicPeriodId: period.id }, { transaction });
    await allModels.GradeRecord.create({ teachingAssignmentId: assignment.id, enrollmentId: enrollment.id, sectionId: section.id, term: 1, value: key === 'A' ? 'A' : 'B' }, { transaction });
    await allModels.AttendanceRecord.create({ teachingAssignmentId: assignment.id, enrollmentId: enrollment.id, sectionId: section.id, date: day('2026-10-01'), status: 'PRESENT' }, { transaction });
  }
  return { originalAdminId: users.ADMIN.id, originalLevelIds: Object.values(levels).map((item) => item.id), originalGradeIds: Object.values(grades).map((item) => item.id) };
}

async function proofFor(transaction, people) {
  const now = new Date().toISOString();
  const roles = {};
  for (const [key, account] of Object.entries(people)) {
    const user = await allModels.User.findOne({ where: { email: account.email }, transaction });
    expect(user.isActive).toBe(true);
    expect(user.role).toBe(ROLES[key][2]);
    expect(await bcrypt.compare(account.password, user.passwordHash)).toBe(true);
    roles[key] = { id: user.id, role: user.role, emailSha256: emailDigest(user.email), verifiedAt: now };
  }
  return { database: 'siga_demo_egx3', verifiedAt: now, roles };
}

beforeAll(async () => {
  await verifyTestDestination();
  const existing = await counts();
  if (Object.values(existing).some((count) => count !== 0)) {
    throw new Error('siga_test contiene datos ajenos; el ensayo no escribirá ni los limpiará');
  }
});

afterAll(async () => {
  try {
    await verifyTestDestination();
    expect(Object.values(await counts()).every((count) => count === 0)).toBe(true);
  } finally {
    await sequelize.close();
  }
});

test('grafo real: prepare, comprobación, retire, conteos e idempotencia; todo se revierte', async () => {
  const { people, legacy } = fixture();
  const hashes = Object.fromEntries(await Promise.all(Object.entries(people).map(async ([key, account]) => [key, await bcrypt.hash(account.password, 10)])));
  try {
    await sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE }, async (tx) => {
      await verifyTestDestination(tx);
      const original = await seedObservedGraph(tx, legacy);
      expect(Object.values(await counts(tx)).reduce((sum, count) => sum + count, 0)).toBe(27);
      const prepared = await prepare(tx, people, hashes, allModels);
      expect(await allModels.EducationLevel.count({ transaction: tx })).toBe(3);
      expect(await allModels.Grade.count({ transaction: tx })).toBe(14);
      expect(await allModels.User.count({ transaction: tx })).toBe(12);
      expect(await allModels.User.count({ where: { id: original.originalAdminId, isActive: true, role: 'ADMIN' }, transaction: tx })).toBe(1);
      expect((await allModels.EducationLevel.findAll({ where: { code: ['PRIMARIA', 'SECUNDARIA'] }, transaction: tx })).map((item) => item.id).sort()).toEqual(original.originalLevelIds.sort());
      expect((await allModels.Grade.findAll({ where: { id: original.originalGradeIds }, transaction: tx })).map((item) => item.id).sort()).toEqual(original.originalGradeIds.sort());
      await expect(prepare(tx, people, hashes, allModels)).rejects.toThrow(/no se repite/);
      await expect(retire(tx, people, {}, legacy, allModels)).rejects.toThrow(/Comprobación API/);
      expect(await allModels.User.count({ where: { id: original.originalAdminId }, transaction: tx })).toBe(1);
      const proof = await proofFor(tx, people);
      expect(proof.roles.ADMIN.id).toBe(prepared.adminId);
      await retire(tx, people, proof, legacy, allModels);
      const final = await counts(tx);
      expect(final).toMatchObject({ User: 6, EducationLevel: 3, Grade: 14, AcademicPeriod: 1, Section: 2, Student: 2, Teacher: 2, Course: 2, TeachingAssignment: 2, Enrollment: 2, GradeRecord: 2, AttendanceRecord: 2 });
      expect(await allModels.User.count({ where: { id: original.originalAdminId }, transaction: tx })).toBe(0);
      expect(await allModels.User.count({ where: { id: prepared.adminId, role: 'ADMIN', isActive: true }, transaction: tx })).toBe(1);
      await assertNoForbiddenLabels(tx, allModels);
      const records = await allModels.GradeRecord.findAll({
        include: [
          { model: allModels.TeachingAssignment, as: 'teachingAssignment' },
          { model: allModels.Enrollment, as: 'enrollment' },
        ],
        transaction: tx,
      });
      for (const record of records) {
        expect(record.sectionId).toBe(record.teachingAssignment.sectionId);
        expect(record.sectionId).toBe(record.enrollment.sectionId);
      }
      await expect(retire(tx, people, proof, legacy, allModels)).rejects.toThrow(/conjunto DEMO cambió/);
      throw undo;
    });
  } catch (error) {
    if (error !== undo) throw error;
  }
  expect(Object.values(await counts()).every((count) => count === 0)).toBe(true);
});

test('un fallo deliberado durante retire revierte las eliminaciones y las creaciones de la transacción', async () => {
  const { people, legacy } = fixture();
  const hashes = Object.fromEntries(await Promise.all(Object.entries(people).map(async ([key, account]) => [key, await bcrypt.hash(account.password, 10)])));
  const failure = new Error('fallo deliberado después de una eliminación');
  await expect(sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE }, async (tx) => {
    await verifyTestDestination(tx);
    await seedObservedGraph(tx, legacy);
    await prepare(tx, people, hashes, allModels);
    const proof = await proofFor(tx, people);
    const failingModels = {
      ...allModels,
      GradeRecord: {
        findAll: (...args) => allModels.GradeRecord.findAll(...args),
        destroy: async (...args) => { await allModels.GradeRecord.destroy(...args); throw failure; },
      },
    };
    await retire(tx, people, proof, legacy, failingModels);
  })).rejects.toBe(failure);
  expect(Object.values(await counts()).every((count) => count === 0)).toBe(true);
});
