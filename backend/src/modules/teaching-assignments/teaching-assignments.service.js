const {
  sequelize,
  TeachingAssignment,
  Course,
  Section,
  AcademicPeriod,
  Grade,
  EducationLevel,
  Teacher,
  User,
  Enrollment,
  Student,
} = require('../../models');
const { publicUserAttributes } = require('../../shared/user-projection');
const { AppError } = require('../../shared/errors');
const { paginated } = require('../../shared/pagination');
const access = require('../../shared/record-access');
const { requireActiveAssignmentRelations } = require('../../shared/academic-records');

const order = [['createdAt', 'ASC'], ['id', 'ASC']];

function buildInclude(academicPeriodId) {
  return [
    { model: Course, as: 'course', attributes: ['id', 'code', 'name'] },
    {
      model: Section,
      as: 'section',
      attributes: ['id', 'name'],
      ...(academicPeriodId ? { where: { academicPeriodId }, required: true } : {}),
      include: [
        { model: AcademicPeriod, as: 'academicPeriod', attributes: ['id', 'name'] },
        {
          model: Grade,
          as: 'grade',
          attributes: ['id', 'name'],
          include: [{ model: EducationLevel, as: 'educationLevel', attributes: ['id', 'code', 'name'] }],
        },
      ],
    },
    {
      model: Teacher,
      as: 'teacher',
      attributes: ['id'],
      include: [{ model: User, as: 'user', attributes: publicUserAttributes }],
    },
  ];
}

async function list(filters, user) {
  const scope = await access.scopeFor(user);
  const { courseId, sectionId, teacherId, academicPeriodId, isActive, page, limit } = filters;
  const requested = {
    ...(courseId ? { courseId } : {}),
    ...(sectionId ? { sectionId } : {}),
    ...(teacherId ? { teacherId } : {}),
    ...(isActive === undefined ? {} : { isActive }),
  };
  const where = { ...requested, ...access.assignmentWhere(scope) };
  const { count, rows } = await TeachingAssignment.findAndCountAll({
    where,
    include: buildInclude(academicPeriodId),
    order,
    offset: (page - 1) * limit,
    limit,
    distinct: true,
  });
  return paginated(rows, count, page, limit);
}

async function get(id, user, transaction) {
  const scope = await access.scopeFor(user, transaction);
  const assignment = await TeachingAssignment.findByPk(id, {
    include: buildInclude(),
    ...(transaction ? { transaction } : {}),
  });
  if (!assignment) throw new AppError(404, 'Asignación no encontrada');
  access.assertAssignment(scope, assignment);
  return assignment;
}

async function create(data) {
  return sequelize.transaction(async (transaction) => {
    await requireActiveAssignmentRelations(transaction, data);
    const created = await TeachingAssignment.create(data, { transaction });
    return TeachingAssignment.findByPk(created.id, { include: buildInclude(), transaction });
  });
}

async function update(id, data) {
  return sequelize.transaction(async (transaction) => {
    const current = await TeachingAssignment.findByPk(id, { transaction });
    if (!current) throw new AppError(404, 'Asignación no encontrada');
    if (data.teacherId !== undefined || data.isActive === true) {
      await requireActiveAssignmentRelations(transaction, {
        courseId: current.courseId,
        sectionId: current.sectionId,
        teacherId: data.teacherId || current.teacherId,
      });
    }
    await current.update(data, { transaction });
    return TeachingAssignment.findByPk(id, { include: buildInclude(), transaction });
  });
}

async function listEnrollments(id, filters, user) {
  const assignment = await get(id, user);
  const { status, page, limit } = filters;
  const where = { sectionId: assignment.sectionId, ...(status ? { status } : {}) };
  const { count, rows } = await Enrollment.findAndCountAll({
    where,
    attributes: ['id', 'status', 'sectionId'],
    include: [{ model: Student, as: 'student', attributes: ['id', 'studentCode', 'firstName', 'lastName'] }],
    order,
    offset: (page - 1) * limit,
    limit,
    distinct: true,
  });
  return paginated(rows, count, page, limit);
}

module.exports = { list, get, create, update, listEnrollments };
