const prisma = require('../../config/prisma');
const { publicUserSelect } = require('../../shared/user-projection');
const { AppError } = require('../../shared/errors');
const { paginated } = require('../../shared/pagination');
const access = require('../../shared/record-access');
const { requireActiveAssignmentRelations } = require('../../shared/academic-records');

const orderBy = [{ createdAt: 'asc' }, { id: 'asc' }];
const include = {
  course: { select: { id: true, code: true, name: true } },
  section: {
    select: {
      id: true,
      name: true,
      academicPeriod: { select: { id: true, name: true } },
      grade: { select: { id: true, name: true, educationLevel: { select: { id: true, code: true, name: true } } } },
    },
  },
  teacher: { select: { id: true, user: { select: publicUserSelect } } },
};

async function list(filters, user) {
  const scope = await access.scopeFor(user);
  const { courseId, sectionId, teacherId, academicPeriodId, isActive, page, limit } = filters;
  const requested = {
    ...(courseId ? { courseId } : {}),
    ...(sectionId ? { sectionId } : {}),
    ...(teacherId ? { teacherId } : {}),
    ...(academicPeriodId ? { section: { is: { academicPeriodId } } } : {}),
    ...(isActive === undefined ? {} : { isActive }),
  };
  const where = { AND: [requested, access.assignmentWhere(scope)] };
  const [total, data] = await Promise.all([
    prisma.teachingAssignment.count({ where }),
    prisma.teachingAssignment.findMany({ where, include, orderBy, skip: (page - 1) * limit, take: limit }),
  ]);
  return paginated(data, total, page, limit);
}

async function get(id, user) {
  const scope = await access.scopeFor(user);
  const assignment = await prisma.teachingAssignment.findUnique({ where: { id }, include });
  if (!assignment) throw new AppError(404, 'Asignación no encontrada');
  access.assertAssignment(scope, assignment);
  return assignment;
}

async function create(data) {
  return prisma.$transaction(async (db) => {
    await requireActiveAssignmentRelations(db, data);
    return db.teachingAssignment.create({ data, include });
  });
}

async function update(id, data) {
  return prisma.$transaction(async (db) => {
    const current = await db.teachingAssignment.findUnique({ where: { id } });
    if (!current) throw new AppError(404, 'Asignación no encontrada');
    if (data.teacherId !== undefined || data.isActive === true) {
      await requireActiveAssignmentRelations(db, {
        courseId: current.courseId,
        sectionId: current.sectionId,
        teacherId: data.teacherId || current.teacherId,
      });
    }
    return db.teachingAssignment.update({ where: { id }, data, include });
  });
}

async function listEnrollments(id, filters, user) {
  const assignment = await get(id, user);
  const { status, page, limit } = filters;
  const where = { sectionId: assignment.sectionId, ...(status ? { status } : {}) };
  const [total, data] = await Promise.all([
    prisma.enrollment.count({ where }),
    prisma.enrollment.findMany({
      where,
      select: {
        id: true,
        status: true,
        sectionId: true,
        student: { select: { id: true, studentCode: true, firstName: true, lastName: true } },
      },
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);
  return paginated(data, total, page, limit);
}

module.exports = { list, get, create, update, listEnrollments };
