const prisma = require('../../config/prisma');
const { assertGradeOrder, missingAcademic, requireActiveAcademic } = require('../../shared/academic-helpers');

const include = {
  educationLevel: { select: { id: true, code: true, name: true, isActive: true } },
};

async function list(filters) {
  return prisma.grade.findMany({
    where: filters,
    orderBy: [{ educationLevel: { code: 'asc' } }, { order: 'asc' }, { id: 'asc' }],
    include,
  });
}

async function get(id) {
  const record = await prisma.grade.findUnique({ where: { id }, include });
  if (!record) throw missingAcademic('grade');
  return record;
}

async function create(data) {
  const level = await requireActiveAcademic('educationLevel', data.educationLevelId, 'Nivel');
  assertGradeOrder(level.code, data.order);
  return prisma.grade.create({ data, include });
}

async function update(id, data) {
  const current = await get(id);
  if (data.order !== undefined) {
    const level = await prisma.educationLevel.findUnique({ where: { id: current.educationLevelId } });
    assertGradeOrder(level.code, data.order);
  }
  return prisma.grade.update({ where: { id }, data, include });
}

module.exports = { list, get, create, update };
