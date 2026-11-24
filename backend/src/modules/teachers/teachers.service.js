const prisma = require('../../config/prisma');
const { publicUserSelect } = require('../../shared/user-projection');
const { AppError } = require('../../shared/errors');
const { paginated } = require('../../shared/pagination');

const include = { user: { select: publicUserSelect } };
const orderBy = [{ createdAt: 'asc' }, { id: 'asc' }];

async function requireTeacherUser(db, userId) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, role: true, isActive: true } });
  if (!user) throw new AppError(404, 'Usuario no encontrado');
  if (!user.isActive || user.role !== 'DOCENTE') throw new AppError(409, 'Usuario incompatible o inactivo');
}

async function list({ search, isActive, page, limit }) {
  const where = {
    ...(isActive === undefined ? {} : { isActive }),
    ...(search ? { user: { is: { OR: [
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ] } } } : {}),
  };
  const [total, data] = await Promise.all([
    prisma.teacher.count({ where }),
    prisma.teacher.findMany({ where, include, orderBy, skip: (page - 1) * limit, take: limit }),
  ]);
  return paginated(data, total, page, limit);
}

async function get(id) {
  const teacher = await prisma.teacher.findUnique({ where: { id }, include });
  if (!teacher) throw new AppError(404, 'Docente no encontrado');
  return teacher;
}

async function create(data) {
  return prisma.$transaction(async (db) => {
    await requireTeacherUser(db, data.userId);
    return db.teacher.create({ data, include });
  });
}

async function update(id, data) {
  return prisma.$transaction(async (db) => {
    const current = await db.teacher.findUnique({ where: { id }, select: { id: true } });
    if (!current) throw new AppError(404, 'Docente no encontrado');
    return db.teacher.update({ where: { id }, data, include });
  });
}

module.exports = { list, get, create, update };
