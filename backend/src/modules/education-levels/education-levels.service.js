const prisma = require('../../config/prisma');
const { missingAcademic } = require('../../shared/academic-helpers');

async function list(filters) {
  return prisma.educationLevel.findMany({
    where: filters,
    orderBy: [{ code: 'asc' }, { id: 'asc' }],
  });
}

async function get(id) {
  const record = await prisma.educationLevel.findUnique({ where: { id } });
  if (!record) throw missingAcademic('educationLevel');
  return record;
}

async function create(data) {
  return prisma.educationLevel.create({ data });
}

async function update(id, data) {
  await get(id);
  return prisma.educationLevel.update({ where: { id }, data });
}

module.exports = { list, get, create, update };
