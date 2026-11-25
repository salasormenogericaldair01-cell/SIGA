const {
  sequelize,
  Course,
  Section,
  Grade,
  EducationLevel,
  AcademicPeriod,
  Teacher,
  User,
  Enrollment,
  Student,
  TeachingAssignment,
  GradeRecord,
  AttendanceRecord,
} = require('../models');
const { AppError } = require('./errors');
const { paginated } = require('./pagination');
const { toDateOnlyISO } = require('./academic-helpers');
const access = require('./record-access');

function buildRecordInclude({ scope, academicPeriodId } = {}) {
  return [
    {
      model: TeachingAssignment,
      as: 'teachingAssignment',
      attributes: ['id', 'teacherId', 'sectionId', 'isActive'],
      ...(scope?.role === 'DOCENTE' ? { where: { teacherId: scope.teacherId }, required: true } : {}),
      ...(academicPeriodId ? { required: true } : {}),
      include: [
        { model: Course, as: 'course', attributes: ['id', 'code', 'name'] },
        {
          model: Teacher,
          as: 'teacher',
          attributes: ['id'],
          include: [{ model: User, as: 'user', attributes: ['id', 'firstName', 'lastName'] }],
        },
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
      ],
    },
    {
      model: Enrollment,
      as: 'enrollment',
      attributes: ['id', 'studentId', 'sectionId', 'status'],
      ...(scope?.role === 'ESTUDIANTE' ? { where: { studentId: scope.studentId }, required: true } : {}),
      include: [
        { model: Student, as: 'student', attributes: ['id', 'studentCode', 'firstName', 'lastName'] },
      ],
    },
  ];
}

async function requireActiveAssignmentRelations(transaction, { courseId, sectionId, teacherId }) {
  const course = await Course.findByPk(courseId, { transaction });
  if (!course) throw new AppError(404, 'Curso no encontrado');

  const section = await Section.findByPk(sectionId, {
    include: [
      { model: Grade, as: 'grade', include: [{ model: EducationLevel, as: 'educationLevel' }] },
      { model: AcademicPeriod, as: 'academicPeriod' },
    ],
    transaction,
  });
  if (!section) throw new AppError(404, 'Sección no encontrada');

  const teacher = await Teacher.findByPk(teacherId, {
    include: [{ model: User, as: 'user', attributes: ['id', 'role', 'isActive'] }],
    transaction,
  });
  if (!teacher) throw new AppError(404, 'Docente no encontrado');

  if (
    !course.isActive
    || !section.isActive
    || !section.grade.isActive
    || !section.grade.educationLevel.isActive
    || !section.academicPeriod.isActive
    || !teacher.isActive
    || !teacher.user.isActive
    || teacher.user.role !== 'DOCENTE'
  ) {
    throw new AppError(409, 'Referencia académica o docente inactivo o incompatible');
  }
  return { course, section, teacher };
}

function createRecordService(kind) {
  const Model = kind === 'gradeRecord' ? GradeRecord : AttendanceRecord;
  const missing = () => new AppError(404, kind === 'gradeRecord' ? 'Calificación no encontrada' : 'Asistencia no encontrada');

  async function validateWrite(transaction, assignmentId, enrollmentId, scope, date) {
    const assignment = await TeachingAssignment.findByPk(assignmentId, { transaction });
    if (!assignment) throw new AppError(404, 'Asignación no encontrada');
    access.assertAssignment(scope, assignment);

    const enrollment = await Enrollment.findByPk(enrollmentId, {
      include: [{ model: Student, as: 'student', attributes: ['id', 'isActive'] }],
      transaction,
    });
    if (!enrollment) throw new AppError(404, 'Matrícula no encontrada');
    if (assignment.sectionId !== enrollment.sectionId) {
      throw new AppError(409, 'Asignación y matrícula pertenecen a secciones distintas');
    }
    if (!assignment.isActive || enrollment.status !== 'ACTIVE' || !enrollment.student.isActive) {
      throw new AppError(409, 'Asignación, matrícula o estudiante inactivo');
    }

    const { section } = await requireActiveAssignmentRelations(transaction, assignment);
    if (date) {
      const day = toDateOnlyISO(date);
      const start = toDateOnlyISO(section.academicPeriod.startDate);
      const end = toDateOnlyISO(section.academicPeriod.endDate);
      if (day < start || day > end) throw new AppError(400, 'La fecha está fuera del periodo académico');
    }
    return assignment;
  }

  return {
    async list(filters, user) {
      const scope = await access.scopeFor(user);
      const { teachingAssignmentId, enrollmentId, academicPeriodId, term, date, page, limit } = filters;
      const where = {
        ...(teachingAssignmentId ? { teachingAssignmentId } : {}),
        ...(enrollmentId ? { enrollmentId } : {}),
        ...(term !== undefined ? { term } : {}),
        ...(date !== undefined ? { date: toDateOnlyISO(date) } : {}),
      };
      const order = kind === 'attendanceRecord'
        ? [['date', 'DESC'], ['createdAt', 'DESC'], ['id', 'ASC']]
        : [['createdAt', 'DESC'], ['id', 'ASC']];

      const { count, rows } = await Model.findAndCountAll({
        where,
        include: buildRecordInclude({ scope, academicPeriodId }),
        order,
        offset: (page - 1) * limit,
        limit,
        distinct: true,
      });
      return paginated(rows, count, page, limit);
    },

    async get(id, user) {
      const scope = await access.scopeFor(user);
      const record = await Model.findByPk(id, { include: buildRecordInclude() });
      if (!record) throw missing();
      access.assertRecord(scope, record);
      return record;
    },

    async create(data, user) {
      return sequelize.transaction(async (transaction) => {
        const scope = await access.scopeFor(user, transaction);
        access.assertWriter(scope);
        const assignment = await validateWrite(transaction, data.teachingAssignmentId, data.enrollmentId, scope, data.date);
        const payload = {
          ...data,
          ...(data.date ? { date: toDateOnlyISO(data.date) } : {}),
          sectionId: assignment.sectionId,
        };
        const created = await Model.create(payload, { transaction });
        return Model.findByPk(created.id, { include: buildRecordInclude(), transaction });
      });
    },

    async update(id, data, user) {
      return sequelize.transaction(async (transaction) => {
        const scope = await access.scopeFor(user, transaction);
        access.assertWriter(scope);
        const current = await Model.findByPk(id, { transaction });
        if (!current) throw missing();
        await validateWrite(transaction, current.teachingAssignmentId, current.enrollmentId, scope, current.date);
        await current.update(data, { transaction });
        return Model.findByPk(id, { include: buildRecordInclude(), transaction });
      });
    },

    async remove(id, user) {
      return sequelize.transaction(async (transaction) => {
        const scope = await access.scopeFor(user, transaction);
        access.assertWriter(scope);
        const current = await Model.findByPk(id, { include: buildRecordInclude(), transaction });
        if (!current) throw missing();
        await validateWrite(transaction, current.teachingAssignmentId, current.enrollmentId, scope, current.date);
        await current.destroy({ transaction });
        return current;
      });
    },
  };
}

module.exports = { createRecordService, requireActiveAssignmentRelations };
