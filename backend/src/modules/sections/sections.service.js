const prisma = require('../../config/prisma');
const { missingAcademic, requireActiveAcademic } = require('../../shared/academic-helpers');

const include = {
  grade: {
    select: {
      id: true,
      name: true,
      order: true,
      isActive: true,
      educationLevel: { select: { id: true, code: true, name: true, isActive: true } },
    },
  },
  academicPeriod: { select: { id: true, name: true, startDate: true, endDate: true, isActive: true } },
};

async function list(filters) {
  return prisma.section.findMany({
    where: filters,
    orderBy: [
      { academicPeriod: { startDate: 'asc' } },
      { grade: { educationLevel: { code: 'asc' } } },
      { grade: { order: 'asc' } },
      { name: 'asc' },
      { id: 'asc' },
    ],
    include,
  });
}

async function get(id) {
  const record = await prisma.section.findUnique({ where: { id }, include });
  if (!record) throw missingAcademic('section');
  return record;
}

async function create(data) {
  const grade = await requireActiveAcademic('grade', data.gradeId, 'Grado');
  await requireActiveAcademic('educationLevel', grade.educationLevelId, 'Nivel');
  await requireActiveAcademic('academicPeriod', data.academicPeriodId, 'Periodo');
  return prisma.section.create({ data, include });
}

async function update(id, data) {
  await get(id);
  return prisma.section.update({ where: { id }, data, include });
}

module.exports = { list, get, create, update };
