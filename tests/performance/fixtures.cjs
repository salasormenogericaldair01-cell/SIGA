const fs = require('node:fs');
const path = require('node:path');
const { randomBytes, randomUUID } = require('node:crypto');
const { backendRequire, prisma, verifyLocalTestDatabase } = require('./target.cjs');

const bcrypt = backendRequire('bcrypt');
const { passwordSchema } = backendRequire('./src/validators/user.validator');
const output = path.resolve(__dirname, 'results');
const manifestFile = path.join(output, 'fixture.json');
const tokenFile = path.join(output, 'tokens.json');
const kinds = ['user', 'teacher', 'student', 'educationLevel', 'grade', 'academicPeriod', 'section', 'course', 'teachingAssignment', 'enrollment', 'gradeRecord', 'attendanceRecord'];
const deleteOrder = ['attendanceRecord', 'gradeRecord', 'enrollment', 'teachingAssignment', 'student', 'teacher', 'section', 'course', 'academicPeriod', 'grade', 'educationLevel', 'user'];
const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function manifestIds() { return Object.fromEntries(kinds.map((kind) => [kind, []])); }
function remember(ids, kind, row) { ids[kind].push(row.id); return row; }

async function prepare() {
  if (fs.existsSync(manifestFile) || fs.existsSync(tokenFile)) throw new Error('Hay una ejecución anterior pendiente; revisa y limpia primero');
  const run = randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase();
  const prefix = `PERF-${run}`;
  const passwords = Object.fromEntries(['ADMIN', 'DOCENTE', 'ESTUDIANTE'].map((role) => [role, randomBytes(24).toString('base64url')]));
  if (Object.values(passwords).some((password) => !passwordSchema.safeParse(password).success)) throw new Error('Contraseña temporal inválida');
  const hashes = Object.fromEntries(await Promise.all(Object.entries(passwords).map(async ([role, password]) => [role, await bcrypt.hash(password, 10)])));
  const ids = manifestIds();
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const part = (type) => parts.find((item) => item.type === type).value;
  const today = `${part('year')}-${part('month')}-${part('day')}`;
  const year = Number(today.slice(0, 4));
  const accounts = {};

  const assignmentId = await prisma.$transaction(async (tx) => {
    let grade = await tx.grade.findFirst({ where: { isActive: true, educationLevel: { isActive: true } } });
    if (!grade) {
      let level = await tx.educationLevel.findFirst({ where: { isActive: true }, include: { grades: true } });
      if (!level) {
        const existing = await tx.educationLevel.findMany({ select: { code: true } });
        const code = ['INICIAL', 'PRIMARIA', 'SECUNDARIA'].find((item) => !existing.some((row) => row.code === item));
        if (!code) throw new Error('No hay nivel activo ni código libre');
        level = remember(ids, 'educationLevel', await tx.educationLevel.create({ data: { code, name: prefix }, include: { grades: true } }));
      }
      const range = level.code === 'INICIAL' ? [3, 4, 5] : level.code === 'PRIMARIA' ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5];
      const order = range.find((number) => !level.grades.some((row) => row.order === number));
      if (!order) throw new Error('No hay grado activo ni orden libre');
      grade = remember(ids, 'grade', await tx.grade.create({ data: { educationLevelId: level.id, order, name: prefix } }));
    }
    for (const role of ['ADMIN', 'DOCENTE', 'ESTUDIANTE']) {
      const email = `${prefix.toLowerCase()}-${role.toLowerCase()}@performance.invalid`;
      const user = remember(ids, 'user', await tx.user.create({ data: {
        email, passwordHash: hashes[role], firstName: 'Rendimiento', lastName: role, role,
      } }));
      accounts[role] = { email, id: user.id };
    }
    const teacher = remember(ids, 'teacher', await tx.teacher.create({ data: { userId: accounts.DOCENTE.id } }));
    const student = remember(ids, 'student', await tx.student.create({ data: {
      studentCode: prefix, firstName: 'Estudiante', lastName: 'Temporal', birthDate: new Date('2012-01-01'), userId: accounts.ESTUDIANTE.id,
    } }));
    const period = remember(ids, 'academicPeriod', await tx.academicPeriod.create({ data: {
      name: prefix, startDate: new Date(`${year}-01-01T00:00:00.000Z`), endDate: new Date(`${year}-12-31T00:00:00.000Z`),
    } }));
    const section = remember(ids, 'section', await tx.section.create({ data: { gradeId: grade.id, academicPeriodId: period.id, name: 'P' } }));
    const course = remember(ids, 'course', await tx.course.create({ data: { code: prefix, name: 'Curso temporal de rendimiento' } }));
    const assignment = remember(ids, 'teachingAssignment', await tx.teachingAssignment.create({ data: { courseId: course.id, sectionId: section.id, teacherId: teacher.id } }));
    const enrollment = remember(ids, 'enrollment', await tx.enrollment.create({ data: { studentId: student.id, sectionId: section.id, academicPeriodId: period.id } }));
    remember(ids, 'gradeRecord', await tx.gradeRecord.create({ data: { teachingAssignmentId: assignment.id, enrollmentId: enrollment.id, sectionId: section.id, term: 1, value: 'A' } }));
    remember(ids, 'attendanceRecord', await tx.attendanceRecord.create({ data: { teachingAssignmentId: assignment.id, enrollmentId: enrollment.id, sectionId: section.id, date: new Date(`${today}T00:00:00.000Z`), status: 'PRESENT' } }));
    return assignment.id;
  }, { maxWait: 10000, timeout: 120000 });

  fs.mkdirSync(output, { recursive: true });
  const manifest = { run, prefix, ids, assignmentId, createdAt: new Date().toISOString() };
  fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2), { flag: 'wx', mode: 0o600 });
  const tokens = {};
  for (const role of ['ADMIN', 'DOCENTE', 'ESTUDIANTE']) {
    const login = await fetch('http://127.0.0.1:3000/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: accounts[role].email, password: passwords[role] }),
    });
    if (login.status !== 200) throw new Error(`Login único previo a carga falló para ${role}: HTTP ${login.status}`);
    const body = await login.json();
    if (body.user?.id !== accounts[role].id || body.user?.role !== role || !body.token) throw new Error(`Identidad de ${role} no coincide`);
    const me = await fetch('http://127.0.0.1:3000/api/auth/me', { headers: { Authorization: `Bearer ${body.token}` } });
    if (me.status !== 200 || (await me.json()).user?.id !== accounts[role].id) throw new Error(`Sesión previa de ${role} no válida`);
    tokens[role] = body.token;
  }
  fs.writeFileSync(tokenFile, JSON.stringify(tokens), { flag: 'wx', mode: 0o600 });
  console.log(`Datos temporales ${prefix} listos: ${Object.values(ids).reduce((sum, list) => sum + list.length, 0)} registros; tres sesiones comprobadas. No se muestran credenciales.`);
}

async function cleanup() {
  if (!fs.existsSync(manifestFile)) throw new Error('Falta el manifiesto local; no se limpiará nada');
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  if (!/^PERF-[0-9A-F]{12}$/.test(manifest.prefix) || manifest.run !== manifest.prefix.slice(5)
      || kinds.some((kind) => !Array.isArray(manifest.ids?.[kind]) || manifest.ids[kind].some((id) => !idPattern.test(id)))) {
    throw new Error('Manifiesto local inválido; no se limpiará nada');
  }
  const { ids, prefix } = manifest;
  await prisma.$transaction(async (tx) => {
    const rows = {};
    for (const kind of kinds) {
      rows[kind] = await tx[kind].findMany({ where: { id: { in: ids[kind] } } });
      if (rows[kind].length !== ids[kind].length || new Set(ids[kind]).size !== ids[kind].length) throw new Error(`IDs ${kind} inconsistentes`);
    }
    if (rows.user.some((row) => !row.email.startsWith(`${prefix.toLowerCase()}-`))
      || rows.student.some((row) => row.studentCode !== prefix)
      || rows.course.some((row) => row.code !== prefix)
      || rows.academicPeriod.some((row) => row.name !== prefix)
      || rows.educationLevel.some((row) => row.name !== prefix)
      || rows.grade.some((row) => row.name !== prefix)
      || rows.teacher.some((row) => !ids.user.includes(row.userId))
      || rows.section.some((row) => !ids.academicPeriod.includes(row.academicPeriodId))
      || rows.teachingAssignment.some((row) => !ids.course.includes(row.courseId) || !ids.section.includes(row.sectionId) || !ids.teacher.includes(row.teacherId))
      || rows.enrollment.some((row) => !ids.student.includes(row.studentId) || !ids.section.includes(row.sectionId))
      || [...rows.gradeRecord, ...rows.attendanceRecord].some((row) => !ids.teachingAssignment.includes(row.teachingAssignmentId) || !ids.enrollment.includes(row.enrollmentId))) {
      throw new Error('El manifiesto no pertenece íntegramente a esta ejecución; no se limpiará nada');
    }
    for (const kind of deleteOrder) {
      if (!ids[kind].length) continue;
      const deleted = await tx[kind].deleteMany({ where: { id: { in: ids[kind] } } });
      if (deleted.count !== ids[kind].length) throw new Error(`Limpieza incompleta de ${kind}`);
    }
  }, { maxWait: 10000, timeout: 120000 });
  for (const kind of kinds) {
    if (await prisma[kind].count({ where: { id: { in: ids[kind] } } }) !== 0) throw new Error(`Persisten IDs ${kind}`);
  }
  if (fs.existsSync(tokenFile)) fs.unlinkSync(tokenFile);
  fs.unlinkSync(manifestFile);
  console.log(`Limpieza por ID verificada: ${Object.values(ids).reduce((sum, list) => sum + list.length, 0)} registros temporales eliminados.`);
}

async function main() {
  const command = process.argv[2];
  if (!['prepare', 'cleanup'].includes(command)) throw new Error('Usa prepare o cleanup');
  await verifyLocalTestDatabase();
  if (command === 'prepare') await prepare();
  else await cleanup();
}

main().catch((error) => { console.error(`Operación local no completada: ${error.message}`); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
