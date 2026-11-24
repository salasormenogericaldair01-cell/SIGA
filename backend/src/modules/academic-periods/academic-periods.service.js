const prisma = require('../../config/prisma');
const { AppError } = require('../../shared/errors');
const { assertPeriodDates, missingAcademic } = require('../../shared/academic-helpers');

async function list(filters) {
  return prisma.academicPeriod.findMany({
    where: filters,
    orderBy: [{ startDate: 'desc' }, { id: 'asc' }],
  });
}

async function get(id) {
  const record = await prisma.academicPeriod.findUnique({ where: { id } });
  if (!record) throw missingAcademic('academicPeriod');
  return record;
}

async function create(data) {
  assertPeriodDates(data.startDate, data.endDate);
  return prisma.academicPeriod.create({ data });
}

async function update(id, data) {
  return prisma.$transaction(async (db) => {
    const current = await db.academicPeriod.findUnique({ where: { id } });
    if (!current) throw missingAcademic('academicPeriod');
    const start = data.startDate || current.startDate;
    const end = data.endDate || current.endDate;
    assertPeriodDates(start, end);
    if (data.startDate || data.endDate) {
      const [enrollments, grades, attendanceOutside] = await Promise.all([
        db.enrollment.count({ where: { academicPeriodId: id } }),
        db.gradeRecord.count({ where: { enrollment: { academicPeriodId: id } } }),
        db.attendanceRecord.count({
          where: { enrollment: { academicPeriodId: id }, OR: [{ date: { lt: start } }, { date: { gt: end } }] },
        }),
      ]);
      if (attendanceOutside > 0) throw new AppError(409, 'Las fechas dejarían asistencias fuera del periodo');
      void enrollments;
      void grades;
    }
    return db.academicPeriod.update({ where: { id }, data });
  }, { isolationLevel: 'Serializable' });
}

module.exports = { list, get, create, update };
