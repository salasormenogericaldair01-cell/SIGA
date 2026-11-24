const prisma = require('../config/prisma');
const { AppError } = require('./errors');
const { paginated } = require('./pagination');
const access = require('./record-access');

const recordInclude = {
  teachingAssignment: {
    select: {
      id: true,
      teacherId: true,
      sectionId: true,
      isActive: true,
      course: { select: { id: true, code: true, name: true } },
      teacher: { select: { id: true, user: { select: { id: true, firstName: true, lastName: true } } } },
      section: {
        select: {
          id: true,
          name: true,
          academicPeriod: { select: { id: true, name: true } },
          grade: { select: { id: true, name: true, educationLevel: { select: { id: true, code: true, name: true } } } },
        },
      },
    },
  },
  enrollment: {
    select: {
      id: true,
      studentId: true,
      sectionId: true,
      status: true,
      student: { select: { id: true, studentCode: true, firstName: true, lastName: true } },
    },
  },
};

async function requireActiveAssignmentRelations(db, { courseId, sectionId, teacherId }) {
  const course = await db.course.findUnique({ where: { id: courseId } });
  if (!course) throw new AppError(404, 'Curso no encontrado');
  const section = await db.section.findUnique({
    where: { id: sectionId },
    include: { grade: { include: { educationLevel: true } }, academicPeriod: true },
  });
  if (!section) throw new AppError(404, 'Sección no encontrada');
  const teacher = await db.teacher.findUnique({
    where: { id: teacherId },
    include: { user: { select: { id: true, role: true, isActive: true } } },
  });
  if (!teacher) throw new AppError(404, 'Docente no encontrado');
  if (!course.isActive || !section.isActive || !section.grade.isActive || !section.grade.educationLevel.isActive
      || !section.academicPeriod.isActive || !teacher.isActive || !teacher.user.isActive || teacher.user.role !== 'DOCENTE') {
    throw new AppError(409, 'Referencia académica o docente inactivo o incompatible');
  }
  return { course, section, teacher };
}

function createRecordService(kind) {
  const missing = () => new AppError(404, kind === 'gradeRecord' ? 'Calificación no encontrada' : 'Asistencia no encontrada');

  async function validateWrite(db, assignmentId, enrollmentId, scope, date) {
    const assignment = await db.teachingAssignment.findUnique({ where: { id: assignmentId } });
    if (!assignment) throw new AppError(404, 'Asignación no encontrada');
    access.assertAssignment(scope, assignment);
    const enrollment = await db.enrollment.findUnique({
      where: { id: enrollmentId },
      include: { student: { select: { id: true, isActive: true } } },
    });
    if (!enrollment) throw new AppError(404, 'Matrícula no encontrada');
    if (assignment.sectionId !== enrollment.sectionId) {
      throw new AppError(409, 'Asignación y matrícula pertenecen a secciones distintas');
    }
    if (!assignment.isActive || enrollment.status !== 'ACTIVE' || !enrollment.student.isActive) {
      throw new AppError(409, 'Asignación, matrícula o estudiante inactivo');
    }
    const { section } = await requireActiveAssignmentRelations(db, assignment);
    if (date) {
      const day = date.toISOString().slice(0, 10);
      const start = section.academicPeriod.startDate.toISOString().slice(0, 10);
      const end = section.academicPeriod.endDate.toISOString().slice(0, 10);
      if (day < start || day > end) throw new AppError(400, 'La fecha está fuera del periodo académico');
    }
    return assignment;
  }

  return {
    async list(filters, user) {
      const scope = await access.scopeFor(user);
      const { teachingAssignmentId, enrollmentId, academicPeriodId, term, date, page, limit } = filters;
      const requested = {
        ...(teachingAssignmentId ? { teachingAssignmentId } : {}),
        ...(enrollmentId ? { enrollmentId } : {}),
        ...(academicPeriodId ? { teachingAssignment: { is: { section: { is: { academicPeriodId } } } } } : {}),
        ...(term !== undefined ? { term } : {}),
        ...(date !== undefined ? { date } : {}),
      };
      const where = { AND: [requested, access.recordWhere(scope)] };
      const orderBy = kind === 'attendanceRecord'
        ? [{ date: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }]
        : [{ createdAt: 'desc' }, { id: 'asc' }];
      const [total, data] = await Promise.all([
        prisma[kind].count({ where }),
        prisma[kind].findMany({ where, include: recordInclude, orderBy, skip: (page - 1) * limit, take: limit }),
      ]);
      return paginated(data, total, page, limit);
    },

    async get(id, user) {
      const scope = await access.scopeFor(user);
      const record = await prisma[kind].findUnique({ where: { id }, include: recordInclude });
      if (!record) throw missing();
      access.assertRecord(scope, record);
      return record;
    },

    async create(data, user) {
      return prisma.$transaction(async (db) => {
        const scope = await access.scopeFor(user, db);
        access.assertWriter(scope);
        const assignment = await validateWrite(db, data.teachingAssignmentId, data.enrollmentId, scope, data.date);
        return db[kind].create({ data: { ...data, sectionId: assignment.sectionId }, include: recordInclude });
      });
    },

    async update(id, data, user) {
      return prisma.$transaction(async (db) => {
        const scope = await access.scopeFor(user, db);
        access.assertWriter(scope);
        const current = await db[kind].findUnique({ where: { id } });
        if (!current) throw missing();
        await validateWrite(db, current.teachingAssignmentId, current.enrollmentId, scope, current.date);
        return db[kind].update({ where: { id }, data, include: recordInclude });
      });
    },

    async remove(id, user) {
      return prisma.$transaction(async (db) => {
        const scope = await access.scopeFor(user, db);
        access.assertWriter(scope);
        const current = await db[kind].findUnique({ where: { id } });
        if (!current) throw missing();
        await validateWrite(db, current.teachingAssignmentId, current.enrollmentId, scope, current.date);
        return db[kind].delete({ where: { id }, include: recordInclude });
      });
    },
  };
}

module.exports = { createRecordService, requireActiveAssignmentRelations };
