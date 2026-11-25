const { Op, Transaction } = require('sequelize');
const { sequelize, AcademicPeriod, Enrollment, GradeRecord, AttendanceRecord } = require('../../models');
const { AppError } = require('../../shared/errors');
const { assertPeriodDates, missingAcademic, toDateOnlyISO } = require('../../shared/academic-helpers');

async function list(filters) {
  return AcademicPeriod.findAll({
    where: filters,
    order: [['startDate', 'DESC'], ['id', 'ASC']],
  });
}

async function get(id) {
  const record = await AcademicPeriod.findByPk(id);
  if (!record) throw missingAcademic('academicPeriod');
  return record;
}

async function create(data) {
  assertPeriodDates(data.startDate, data.endDate);
  return AcademicPeriod.create({
    ...data,
    startDate: toDateOnlyISO(data.startDate),
    endDate: toDateOnlyISO(data.endDate),
  });
}

async function update(id, data) {
  return sequelize.transaction(
    { isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE },
    async (transaction) => {
      const current = await AcademicPeriod.findByPk(id, { transaction });
      if (!current) throw missingAcademic('academicPeriod');
      const start = toDateOnlyISO(data.startDate || current.startDate);
      const end = toDateOnlyISO(data.endDate || current.endDate);
      assertPeriodDates(start, end);
      if (data.startDate || data.endDate) {
        const [enrollments, grades, attendanceOutside] = await Promise.all([
          Enrollment.count({ where: { academicPeriodId: id }, transaction }),
          GradeRecord.count({
            include: [{ model: Enrollment, as: 'enrollment', where: { academicPeriodId: id }, required: true }],
            transaction,
          }),
          AttendanceRecord.count({
            where: { [Op.or]: [{ date: { [Op.lt]: start } }, { date: { [Op.gt]: end } }] },
            include: [{ model: Enrollment, as: 'enrollment', where: { academicPeriodId: id }, required: true }],
            transaction,
          }),
        ]);
        if (attendanceOutside > 0) throw new AppError(409, 'Las fechas dejarían asistencias fuera del periodo');
        void enrollments;
        void grades;
      }
      return current.update(
        {
          ...data,
          ...(data.startDate ? { startDate: toDateOnlyISO(data.startDate) } : {}),
          ...(data.endDate ? { endDate: toDateOnlyISO(data.endDate) } : {}),
        },
        { transaction },
      );
    },
  );
}

module.exports = { list, get, create, update };
