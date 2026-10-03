const crypto = require('node:crypto');
const bcrypt = require('bcrypt');
const { PrismaClient, Prisma } = require('@prisma/client');
const { credentials, legacyEmails, prepare, retire, assertNoForbiddenLabels } = require('../../scripts/operations/data-transition');
const { ROLES, emailDigest } = require('../../scripts/operations/data-transition-core');

jest.setTimeout(120000);
const prisma = new PrismaClient();
const models = [
  'user', 'educationLevel', 'grade', 'academicPeriod', 'section', 'student', 'teacher',
  'course', 'teachingAssignment', 'enrollment', 'gradeRecord', 'attendanceRecord',
];
const day = (value) => new Date(`${value}T00:00:00.000Z`);
const undo = new Error('rollback intencional de registros exclusivos de esta prueba');

async function verifyTestDestination(client = prisma) {
  const url = new URL(process.env.DATABASE_URL);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)
    || url.hostname !== '127.0.0.1' || url.port !== '5433'
    || decodeURIComponent(url.pathname) !== '/siga_test') {
    throw new Error('Este ensayo solo admite siga_test en 127.0.0.1:5433');
  }
  const [row] = await client.$queryRaw`SELECT current_database() AS name, inet_server_port() AS port`;
  if (row.name !== 'siga_test' || row.port !== 5433) throw new Error('El destino PostgreSQL de la prueba no coincide');
}

async function counts(client) {
  const result = {};
  for (const model of models) result[model] = await client[model].count();
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

async function seedObservedGraph(tx, legacy) {
  const levels = {};
  const grades = {};
  for (const code of ['PRIMARIA', 'SECUNDARIA']) {
    levels[code] = await tx.educationLevel.create({ data: { code, name: `DEMO ${code}` } });
    grades[code] = await tx.grade.create({ data: { educationLevelId: levels[code].id, order: 1, name: 'DEMO 1.º' } });
  }
  const userInfo = {
    ADMIN: ['Admin', 'ADMIN'], SECRETARIA: ['Secretaria', 'SECRETARIA'],
    DOCENTE_A: ['Docente A', 'DOCENTE'], DOCENTE_B: ['Docente B', 'DOCENTE'],
    ESTUDIANTE_A: ['Estudiante A', 'ESTUDIANTE'], ESTUDIANTE_B: ['Estudiante B', 'ESTUDIANTE'],
  };
  const users = {};
  for (const [key, [lastName, role]] of Object.entries(userInfo)) {
    users[key] = await tx.user.create({ data: {
      email: legacy[key], firstName: 'Demo', lastName, role,
      passwordHash: await bcrypt.hash(crypto.randomBytes(24).toString('base64url'), 10),
    } });
  }
  const period = await tx.academicPeriod.create({ data: { name: 'DEMO 2026', startDate: day('2026-01-01'), endDate: day('2026-12-31') } });
  for (const key of ['A', 'B']) {
    const levelCode = key === 'A' ? 'PRIMARIA' : 'SECUNDARIA';
    const section = await tx.section.create({ data: { gradeId: grades[levelCode].id, academicPeriodId: period.id, name: `DEMO-${key}` } });
    const teacher = await tx.teacher.create({ data: { userId: users[`DOCENTE_${key}`].id } });
    const student = await tx.student.create({ data: {
      studentCode: `DEMO-EST-${key}`, firstName: 'Demo', lastName: `Estudiante ${key}`,
      birthDate: day(key === 'A' ? '2015-05-15' : '2012-05-15'), userId: users[`ESTUDIANTE_${key}`].id,
    } });
    const course = await tx.course.create({ data: { code: key === 'A' ? 'DEMO-MAT' : 'DEMO-COM', name: key === 'A' ? 'DEMO Matemática' : 'DEMO Comunicación' } });
    const assignment = await tx.teachingAssignment.create({ data: { courseId: course.id, sectionId: section.id, teacherId: teacher.id } });
    const enrollment = await tx.enrollment.create({ data: { studentId: student.id, sectionId: section.id, academicPeriodId: period.id } });
    await tx.gradeRecord.create({ data: { teachingAssignmentId: assignment.id, enrollmentId: enrollment.id, sectionId: section.id, term: 1, value: key === 'A' ? 'A' : 'B' } });
    await tx.attendanceRecord.create({ data: { teachingAssignmentId: assignment.id, enrollmentId: enrollment.id, sectionId: section.id, date: day('2026-10-01'), status: 'PRESENT' } });
  }
  return { originalAdminId: users.ADMIN.id, originalLevelIds: Object.values(levels).map((item) => item.id), originalGradeIds: Object.values(grades).map((item) => item.id) };
}

async function proofFor(tx, people) {
  const now = new Date().toISOString();
  const roles = {};
  for (const [key, account] of Object.entries(people)) {
    const user = await tx.user.findUnique({ where: { email: account.email } });
    expect(user.isActive).toBe(true);
    expect(user.role).toBe(ROLES[key][2]);
    expect(await bcrypt.compare(account.password, user.passwordHash)).toBe(true);
    roles[key] = { id: user.id, role: user.role, emailSha256: emailDigest(user.email), verifiedAt: now };
  }
  // Es un comprobante simulado: el ensayo valida hashes y roles en PostgreSQL,
  // pero no afirma haber llamado a la API publicada.
  return { database: 'siga_demo_egx3', verifiedAt: now, roles };
}

beforeAll(async () => {
  await verifyTestDestination();
  const existing = await counts(prisma);
  if (Object.values(existing).some((count) => count !== 0)) {
    throw new Error('siga_test contiene datos ajenos; el ensayo no escribirá ni los limpiará');
  }
});

afterAll(async () => {
  try {
    await verifyTestDestination();
    expect(Object.values(await counts(prisma)).every((count) => count === 0)).toBe(true);
  } finally { await prisma.$disconnect(); }
});

test('grafo real: prepare, comprobación, retire, conteos e idempotencia; todo se revierte', async () => {
  const { people, legacy } = fixture();
  const hashes = Object.fromEntries(await Promise.all(Object.entries(people).map(async ([key, account]) => [key, await bcrypt.hash(account.password, 10)])));
  try {
    await prisma.$transaction(async (tx) => {
      await verifyTestDestination(tx);
      const original = await seedObservedGraph(tx, legacy);
      expect(Object.values(await counts(tx)).reduce((sum, count) => sum + count, 0)).toBe(27);
      const prepared = await prepare(tx, people, hashes);
      expect(await tx.educationLevel.count()).toBe(3);
      expect(await tx.grade.count()).toBe(14);
      expect(await tx.user.count()).toBe(12);
      expect(await tx.user.count({ where: { id: original.originalAdminId, isActive: true, role: 'ADMIN' } })).toBe(1);
      expect((await tx.educationLevel.findMany({ where: { code: { in: ['PRIMARIA', 'SECUNDARIA'] } } })).map((item) => item.id).sort()).toEqual(original.originalLevelIds.sort());
      expect((await tx.grade.findMany({ where: { id: { in: original.originalGradeIds } } })).map((item) => item.id).sort()).toEqual(original.originalGradeIds.sort());
      await expect(prepare(tx, people, hashes)).rejects.toThrow(/no se repite/);
      await expect(retire(tx, people, {}, legacy)).rejects.toThrow(/Comprobación API/);
      expect(await tx.user.count({ where: { id: original.originalAdminId } })).toBe(1);
      const proof = await proofFor(tx, people);
      expect(proof.roles.ADMIN.id).toBe(prepared.adminId);
      await retire(tx, people, proof, legacy);
      const final = await counts(tx);
      expect(final).toMatchObject({ user: 6, educationLevel: 3, grade: 14, academicPeriod: 1, section: 2, student: 2, teacher: 2, course: 2, teachingAssignment: 2, enrollment: 2, gradeRecord: 2, attendanceRecord: 2 });
      expect(await tx.user.count({ where: { id: original.originalAdminId } })).toBe(0);
      expect(await tx.user.count({ where: { id: prepared.adminId, role: 'ADMIN', isActive: true } })).toBe(1);
      await assertNoForbiddenLabels(tx);
      const records = await tx.gradeRecord.findMany({ include: { teachingAssignment: true, enrollment: true } });
      for (const record of records) {
        expect(record.sectionId).toBe(record.teachingAssignment.sectionId);
        expect(record.sectionId).toBe(record.enrollment.sectionId);
      }
      await expect(retire(tx, people, proof, legacy)).rejects.toThrow(/conjunto DEMO cambió/);
      throw undo;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 120000 });
  } catch (error) { if (error !== undo) throw error; }
  expect(Object.values(await counts(prisma)).every((count) => count === 0)).toBe(true);
});

test('un fallo deliberado durante retire revierte las eliminaciones y las creaciones de la transacción', async () => {
  const { people, legacy } = fixture();
  const hashes = Object.fromEntries(await Promise.all(Object.entries(people).map(async ([key, account]) => [key, await bcrypt.hash(account.password, 10)])));
  const failure = new Error('fallo deliberado después de una eliminación');
  await expect(prisma.$transaction(async (tx) => {
    await verifyTestDestination(tx);
    await seedObservedGraph(tx, legacy);
    await prepare(tx, people, hashes);
    const proof = await proofFor(tx, people);
    const failingTx = new Proxy(tx, {
      get(target, property) {
        if (property === 'gradeRecord') return {
          findMany: (...args) => target.gradeRecord.findMany(...args),
          deleteMany: async (...args) => { await target.gradeRecord.deleteMany(...args); throw failure; },
        };
        return target[property];
      },
    });
    await retire(failingTx, people, proof, legacy);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 120000 })).rejects.toBe(failure);
  expect(Object.values(await counts(prisma)).every((count) => count === 0)).toBe(true);
});
