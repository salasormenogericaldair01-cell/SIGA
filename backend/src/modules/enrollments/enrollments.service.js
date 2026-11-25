const {
  sequelize,
  Enrollment,
  Student,
  Section,
  Grade,
  EducationLevel,
  AcademicPeriod,
  GradeRecord,
  AttendanceRecord,
} = require('../../models');
const { AppError } = require('../../shared/errors');
const { paginated } = require('../../shared/pagination');

const include = [
  { model: Student, as: 'student', attributes: ['id', 'studentCode', 'firstName', 'lastName'] },
  {
    model: Section,
    as: 'section',
    attributes: ['id', 'name'],
    include: [{
      model: Grade,
      as: 'grade',
      attributes: ['id', 'name', 'order'],
      include: [{ model: EducationLevel, as: 'educationLevel', attributes: ['id', 'code', 'name'] }],
    }],
  },
  { model: AcademicPeriod, as: 'academicPeriod', attributes: ['id', 'name', 'startDate', 'endDate'] },
];

function toPlain(row) {
  return row && typeof row.get === 'function' ? row.get({ plain: true }) : row;
}

async function attachCounts(rows, transaction) {
  if (!rows.length) return [];
  const ids = rows.map((row) => row.id);
  const [gradeRows, attendanceRows] = await Promise.all([
    GradeRecord.findAll({
      attributes: ['enrollmentId', [sequelize.fn('COUNT', sequelize.col('id')), 'total']],
      where: { enrollmentId: ids },
      group: ['enrollmentId'],
      raw: true,
      ...(transaction ? { transaction } : {}),
    }),
    AttendanceRecord.findAll({
      attributes: ['enrollmentId', [sequelize.fn('COUNT', sequelize.col('id')), 'total']],
      where: { enrollmentId: ids },
      group: ['enrollmentId'],
      raw: true,
      ...(transaction ? { transaction } : {}),
    }),
  ]);
  const gradeMap = new Map(gradeRows.map((item) => [item.enrollmentId, Number(item.total)]));
  const attendanceMap = new Map(attendanceRows.map((item) => [item.enrollmentId, Number(item.total)]));
  return rows.map((row) => ({
    ...toPlain(row),
    _count: {
      gradeRecords: gradeMap.get(row.id) || 0,
      attendanceRecords: attendanceMap.get(row.id) || 0,
    },
  }));
}

async function requireActiveStudent(transaction, id) {
  const student = await Student.findByPk(id, { attributes: ['id', 'isActive'], transaction });
  if (!student) throw new AppError(404, 'Estudiante no encontrado');
  if (!student.isActive) throw new AppError(409, 'Estudiante inactivo');
}

async function requireActiveSection(transaction, id) {
  const section = await Section.findByPk(id, {
    include: [
      { model: Grade, as: 'grade', include: [{ model: EducationLevel, as: 'educationLevel' }] },
      { model: AcademicPeriod, as: 'academicPeriod' },
    ],
    transaction,
  });
  if (!section) throw new AppError(404, 'Sección no encontrada');
  if (!section.isActive || !section.grade.isActive || !section.grade.educationLevel.isActive || !section.academicPeriod.isActive) {
    throw new AppError(409, 'Referencia académica inactiva');
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
  const { count, rows } = await Enrollment.findAndCountAll({
    where,
    include,
    order: [['createdAt', 'ASC'], ['id', 'ASC']],
    offset: (page - 1) * limit,
    limit,
    distinct: true,
  });
  const data = await attachCounts(rows);
  return paginated(data, count, page, limit);
}

async function get(id, transaction) {
  const record = await Enrollment.findByPk(id, { include, ...(transaction ? { transaction } : {}) });
  if (!record) throw new AppError(404, 'Matrícula no encontrada');
  const [gradeRecords, attendanceRecords] = await Promise.all([
    GradeRecord.count({ where: { enrollmentId: id }, ...(transaction ? { transaction } : {}) }),
    AttendanceRecord.count({ where: { enrollmentId: id }, ...(transaction ? { transaction } : {}) }),
  ]);
  return { ...toPlain(record), _count: { gradeRecords, attendanceRecords } };
}

async function create({ studentId, sectionId }) {
  return sequelize.transaction(async (transaction) => {
    await requireActiveStudent(transaction, studentId);
    const section = await requireActiveSection(transaction, sectionId);
    const existing = await Enrollment.findOne({
      where: { studentId, academicPeriodId: section.academicPeriodId },
      transaction,
    });
    if (existing) throw new AppError(409, 'El estudiante ya tiene matrícula en ese periodo');
    const created = await Enrollment.create(
      { studentId, sectionId, academicPeriodId: section.academicPeriodId },
      { transaction },
    );
    return get(created.id, transaction);
  });
}

async function update(id, data) {
  return sequelize.transaction(async (transaction) => {
    const current = await Enrollment.findByPk(id, { transaction });
    if (!current) throw new AppError(404, 'Matrícula no encontrada');
    if (data.sectionId && data.sectionId !== current.sectionId) {
      const [grades, attendance] = await Promise.all([
        GradeRecord.count({ where: { enrollmentId: id }, transaction }),
        AttendanceRecord.count({ where: { enrollmentId: id }, transaction }),
      ]);
      if (grades > 0 || attendance > 0) {
        throw new AppError(409, 'La matrícula tiene notas o asistencias en su sección actual');
      }
    }
    if (data.sectionId !== undefined || data.status === 'ACTIVE') {
      await requireActiveStudent(transaction, current.studentId);
      const section = await requireActiveSection(transaction, data.sectionId || current.sectionId);
      if (section.academicPeriodId !== current.academicPeriodId) {
        throw new AppError(409, 'La sección pertenece a otro periodo');
      }
    }
    await current.update(data, { transaction });
    return get(id, transaction);
  });
}

module.exports = { list, get, create, update };
