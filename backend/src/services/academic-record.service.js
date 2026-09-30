const prisma = require('../config/prisma');
const { ModuleError } = require('../utils/module-error');
const access = require('./record-access.service');
const { requireActiveRelations } = require('./course-assignment.service');

const recordInclude = {
  teachingAssignment: { select: { id: true, teacherId: true, sectionId: true, course: { select: { id: true, code: true, name: true } } } },
  enrollment: { select: { id: true, studentId: true, sectionId: true, student: { select: { id: true, studentCode: true, firstName: true, lastName: true } } } },
};
const models = { gradeRecord: 'gradeRecord', attendanceRecord: 'attendanceRecord' };
const missing = (kind) => new ModuleError(404, kind === 'gradeRecord' ? 'Calificación no encontrada' : 'Asistencia no encontrada');

async function list(kind, filters, user) {
  const scope = await access.scopeFor(user);
  const { teachingAssignmentId, enrollmentId, academicPeriodId, term, page, limit } = filters;
  const requested = {
    ...(teachingAssignmentId ? { teachingAssignmentId } : {}),
    ...(enrollmentId ? { enrollmentId } : {}),
    ...(academicPeriodId ? { teachingAssignment: { is: { section: { is: { academicPeriodId } } } } } : {}),
    ...(term !== undefined ? { term } : {}),
  };
  const where = { AND: [requested, access.recordWhere(scope)] };
  const [total, data] = await Promise.all([
    prisma[models[kind]].count({ where }),
    prisma[models[kind]].findMany({ where, include: recordInclude, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], skip: (page - 1) * limit, take: limit }),
  ]);
  return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

async function get(kind, id, user) {
  const scope = await access.scopeFor(user);
  const record = await prisma[models[kind]].findUnique({ where: { id }, include: recordInclude });
  if (!record) throw missing(kind);
  access.assertRecord(scope, record);
  return record;
}

async function validateWrite(db, assignmentId, enrollmentId, scope, date) {
  const assignment = await db.teachingAssignment.findUnique({ where: { id: assignmentId } });
  if (!assignment) throw new ModuleError(404, 'Asignación no encontrada');
  access.assertAssignment(scope, assignment);
  const enrollment = await db.enrollment.findUnique({ where: { id: enrollmentId }, include: { student: { select: { id: true, isActive: true } } } });
  if (!enrollment) throw new ModuleError(404, 'Matrícula no encontrada');
  if (assignment.sectionId !== enrollment.sectionId) throw new ModuleError(409, 'Asignación y matrícula pertenecen a secciones distintas');
  if (!assignment.isActive || enrollment.status !== 'ACTIVE' || !enrollment.student.isActive) {
    throw new ModuleError(409, 'Asignación, matrícula o estudiante inactivo');
  }
  const { section } = await requireActiveRelations(db, assignment);
  if (date) {
    const day = date.toISOString().slice(0, 10);
    const start = section.academicPeriod.startDate.toISOString().slice(0, 10);
    const end = section.academicPeriod.endDate.toISOString().slice(0, 10);
    if (day < start || day > end) throw new ModuleError(400, 'La fecha está fuera del periodo académico');
  }
  return assignment;
}

async function create(kind, data, user) {
  return prisma.$transaction(async (db) => {
    const scope = await access.scopeFor(user, db);
    access.assertWriter(scope);
    const assignment = await validateWrite(db, data.teachingAssignmentId, data.enrollmentId, scope, data.date);
    return db[models[kind]].create({ data: { ...data, sectionId: assignment.sectionId }, include: recordInclude });
  });
}

async function update(kind, id, data, user) {
  return prisma.$transaction(async (db) => {
    const scope = await access.scopeFor(user, db);
    access.assertWriter(scope);
    const current = await db[models[kind]].findUnique({ where: { id } });
    if (!current) throw missing(kind);
    await validateWrite(db, current.teachingAssignmentId, current.enrollmentId, scope, current.date);
    return db[models[kind]].update({ where: { id }, data, include: recordInclude });
  });
}

module.exports = { list, get, create, update };
