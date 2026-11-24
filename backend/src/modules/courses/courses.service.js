const prisma = require('../../config/prisma');
const { AppError } = require('../../shared/errors');
const { paginated } = require('../../shared/pagination');

const orderBy = [{ createdAt: 'asc' }, { id: 'asc' }];

async function list({ search, isActive, page, limit }) {
  const where = {
    ...(isActive === undefined ? {} : { isActive }),
    ...(search ? { OR: [{ code: { contains: search, mode: 'insensitive' } }, { name: { contains: search, mode: 'insensitive' } }] } : {}),
  };
  const [total, data] = await Promise.all([
    prisma.course.count({ where }),
    prisma.course.findMany({ where, orderBy, skip: (page - 1) * limit, take: limit }),
  ]);
  return paginated(data, total, page, limit);
}

async function get(id) {
  const course = await prisma.course.findUnique({ where: { id } });
  if (!course) throw new AppError(404, 'Curso no encontrado');
  return course;
}

async function create(data) {
  return prisma.course.create({ data });
}

async function update(id, data) {
  await get(id);
  return prisma.course.update({ where: { id }, data });
}

module.exports = { list, get, create, update };
