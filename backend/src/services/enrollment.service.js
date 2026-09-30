const prisma = require('../config/prisma');
const { ModuleError } = require('../utils/module-error');

const include = {
  student: { select: { id: true, studentCode: true, firstName: true, lastName: true } },
  section: { select: {
    id: true, name: true,
    grade: { select: { id: true, name: true, order: true, educationLevel: { select: { id: true, code: true, name: true } } } },
  } },
  academicPeriod: { select: { id: true, name: true, startDate: true, endDate: true } },
};

async function requireActiveStudent(db, id) {
  const student = await db.student.findUnique({ where: { id }, select: { id: true, isActive: true } });
  if (!student) throw new ModuleError(404, 'Estudiante no encontrado');
  if (!student.isActive) throw new ModuleError(409, 'Estudiante inactivo');
}

async function requireActiveSection(db, id) {
  const section = await db.section.findUnique({
    where: { id },
    include: { grade: { include: { educationLevel: true } }, academicPeriod: true },
  });
  if (!section) throw new ModuleError(404, 'Sección no encontrada');
  if (!section.isActive || !section.grade.isActive || !section.grade.educationLevel.isActive || !section.academicPeriod.isActive) {
    throw new ModuleError(409, 'Referencia académica inactiva');
  }
  return section;
}

async function list({ studentId, sectionId, academicPeriodId, status, page, limit }) {
  const where = {
    ...(studentId ? { studentId } : {}),
    ...(sectionId ? { sectionId } : {}),
    ...(academicPeriodId ? { academicPeriodId } : {}),
    ...(status ? { status } : {}),
  };
  const [total, data] = await Promise.all([
    prisma.enrollment.count({ where }),
    prisma.enrollment.findMany({ where, include, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], skip: (page - 1) * limit, take: limit }),
  ]);
  return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

async function get(id) {
  const record = await prisma.enrollment.findUnique({ where: { id }, include });
  if (!record) throw new ModuleError(404, 'Matrícula no encontrada');
  return record;
}

async function create({ studentId, sectionId }) {
  return prisma.$transaction(async (db) => {
    await requireActiveStudent(db, studentId);
    const section = await requireActiveSection(db, sectionId);
    const existing = await db.enrollment.findUnique({ where: { studentId_academicPeriodId: { studentId, academicPeriodId: section.academicPeriodId } } });
    if (existing) throw new ModuleError(409, 'El estudiante ya tiene matrícula en ese periodo');
    return db.enrollment.create({ data: { studentId, sectionId, academicPeriodId: section.academicPeriodId }, include });
  });
}

async function update(id, data) {
  return prisma.$transaction(async (db) => {
    const current = await db.enrollment.findUnique({ where: { id } });
    if (!current) throw new ModuleError(404, 'Matrícula no encontrada');
    if (data.sectionId && data.sectionId !== current.sectionId) {
      const [grades, attendance] = await Promise.all([
        db.gradeRecord.count({ where: { enrollmentId: id } }),
        db.attendanceRecord.count({ where: { enrollmentId: id } }),
      ]);
      if (grades > 0 || attendance > 0) {
        throw new ModuleError(409, 'La matrícula tiene notas o asistencias en su sección actual');
      }
    }
    if (data.sectionId !== undefined || data.status === 'ACTIVE') {
      await requireActiveStudent(db, current.studentId);
      const section = await requireActiveSection(db, data.sectionId || current.sectionId);
      if (section.academicPeriodId !== current.academicPeriodId) {
        throw new ModuleError(409, 'La sección pertenece a otro periodo');
      }
    }
    return db.enrollment.update({ where: { id }, data, include });
  });
}

module.exports = { list, get, create, update };
