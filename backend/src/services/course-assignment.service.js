const prisma = require('../config/prisma');
const { publicUserSelect } = require('../utils/user');
const { ModuleError } = require('../utils/module-error');
const access = require('./record-access.service');

const orderBy = [{ createdAt: 'asc' }, { id: 'asc' }];
const assignmentInclude = {
  course: { select: { id: true, code: true, name: true } },
  section: { select: { id: true, name: true, academicPeriod: { select: { id: true, name: true } }, grade: { select: { id: true, name: true, educationLevel: { select: { id: true, code: true, name: true } } } } } },
  teacher: { select: { id: true, user: { select: publicUserSelect } } },
};

function paginated(data, total, page, limit) {
  return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

async function listCourses({ search, isActive, page, limit }) {
  const where = {
    ...(isActive === undefined ? {} : { isActive }),
    ...(search ? { OR: [{ code: { contains: search, mode: 'insensitive' } }, { name: { contains: search, mode: 'insensitive' } }] } : {}),
  };
  const [total, data] = await Promise.all([
    prisma.course.count({ where }), prisma.course.findMany({ where, orderBy, skip: (page - 1) * limit, take: limit }),
  ]);
  return paginated(data, total, page, limit);
}

async function getCourse(id) {
  const course = await prisma.course.findUnique({ where: { id } });
  if (!course) throw new ModuleError(404, 'Curso no encontrado');
  return course;
}

async function createCourse(data) { return prisma.course.create({ data }); }
async function updateCourse(id, data) {
  await getCourse(id);
  return prisma.course.update({ where: { id }, data });
}

async function requireActiveRelations(db, { courseId, sectionId, teacherId }) {
  const course = await db.course.findUnique({ where: { id: courseId } });
  if (!course) throw new ModuleError(404, 'Curso no encontrado');
  const section = await db.section.findUnique({ where: { id: sectionId }, include: { grade: { include: { educationLevel: true } }, academicPeriod: true } });
  if (!section) throw new ModuleError(404, 'Sección no encontrada');
  const teacher = await db.teacher.findUnique({ where: { id: teacherId }, include: { user: { select: { id: true, role: true, isActive: true } } } });
  if (!teacher) throw new ModuleError(404, 'Docente no encontrado');
  if (!course.isActive || !section.isActive || !section.grade.isActive || !section.grade.educationLevel.isActive ||
      !section.academicPeriod.isActive || !teacher.isActive || !teacher.user.isActive || teacher.user.role !== 'DOCENTE') {
    throw new ModuleError(409, 'Referencia académica o docente inactivo o incompatible');
  }
  return { course, section, teacher };
}

async function listAssignments(filters, user) {
  const scope = await access.scopeFor(user);
  const { courseId, sectionId, teacherId, academicPeriodId, isActive, page, limit } = filters;
  const requested = {
    ...(courseId ? { courseId } : {}), ...(sectionId ? { sectionId } : {}),
    ...(teacherId ? { teacherId } : {}),
    ...(academicPeriodId ? { section: { is: { academicPeriodId } } } : {}),
    ...(isActive === undefined ? {} : { isActive }),
  };
  const where = { AND: [requested, access.assignmentWhere(scope)] };
  const [total, data] = await Promise.all([
    prisma.teachingAssignment.count({ where }),
    prisma.teachingAssignment.findMany({ where, include: assignmentInclude, orderBy, skip: (page - 1) * limit, take: limit }),
  ]);
  return paginated(data, total, page, limit);
}

async function getAssignment(id, user) {
  const scope = await access.scopeFor(user);
  const assignment = await prisma.teachingAssignment.findUnique({ where: { id }, include: assignmentInclude });
  if (!assignment) throw new ModuleError(404, 'Asignación no encontrada');
  access.assertAssignment(scope, assignment);
  return assignment;
}

async function createAssignment(data) {
  return prisma.$transaction(async (db) => {
    await requireActiveRelations(db, data);
    return db.teachingAssignment.create({ data, include: assignmentInclude });
  });
}

async function updateAssignment(id, data) {
  return prisma.$transaction(async (db) => {
    const current = await db.teachingAssignment.findUnique({ where: { id } });
    if (!current) throw new ModuleError(404, 'Asignación no encontrada');
    if (data.teacherId !== undefined || data.isActive === true) {
      await requireActiveRelations(db, { courseId: current.courseId, sectionId: current.sectionId, teacherId: data.teacherId || current.teacherId });
    }
    return db.teachingAssignment.update({ where: { id }, data, include: assignmentInclude });
  });
}

async function assignmentEnrollments(id, filters, user) {
  const assignment = await getAssignment(id, user);
  const { status, page, limit } = filters;
  const where = { sectionId: assignment.sectionId, ...(status ? { status } : {}) };
  const [total, data] = await Promise.all([
    prisma.enrollment.count({ where }),
    prisma.enrollment.findMany({ where, select: {
      id: true, status: true, sectionId: true,
      student: { select: { id: true, studentCode: true, firstName: true, lastName: true } },
    }, orderBy, skip: (page - 1) * limit, take: limit }),
  ]);
  return paginated(data, total, page, limit);
}

module.exports = { listCourses, getCourse, createCourse, updateCourse, listAssignments, getAssignment, createAssignment, updateAssignment, assignmentEnrollments, requireActiveRelations };
