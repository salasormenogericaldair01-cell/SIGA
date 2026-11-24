const prisma = require('../../config/prisma');
const { publicUserSelect } = require('../../shared/user-projection');
const { AppError } = require('../../shared/errors');
const { paginated } = require('../../shared/pagination');

const include = { user: { select: publicUserSelect } };
const orderBy = [{ createdAt: 'asc' }, { id: 'asc' }];

async function requireStudentUser(db, userId) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, role: true, isActive: true } });
  if (!user) throw new AppError(404, 'Usuario no encontrado');
  if (!user.isActive || user.role !== 'ESTUDIANTE') throw new AppError(409, 'Usuario incompatible o inactivo');
}

async function list({ search, isActive, page, limit }) {
  const where = {
    ...(isActive === undefined ? {} : { isActive }),
    ...(search ? { OR: [
      { studentCode: { contains: search, mode: 'insensitive' } },
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
    ] } : {}),
  };
  const [total, data] = await Promise.all([
    prisma.student.count({ where }),
    prisma.student.findMany({ where, include, orderBy, skip: (page - 1) * limit, take: limit }),
  ]);
  return paginated(data, total, page, limit);
}

async function get(id) {
  const student = await prisma.student.findUnique({ where: { id }, include });
  if (!student) throw new AppError(404, 'Estudiante no encontrado');
  return student;
}

async function create(data) {
  return prisma.$transaction(async (db) => {
    if (data.userId) {
      await requireStudentUser(db, data.userId);
      await db.user.update({
        where: { id: data.userId },
        data: { firstName: data.firstName, lastName: data.lastName },
      });
    }
    return db.student.create({ data, include });
  });
}

async function update(id, data) {
  return prisma.$transaction(async (db) => {
    const current = await db.student.findUnique({
      where: { id },
      select: { id: true, userId: true, firstName: true, lastName: true },
    });
    if (!current) throw new AppError(404, 'Estudiante no encontrado');
    if (data.userId) await requireStudentUser(db, data.userId);
    const targetUserId = data.userId !== undefined ? data.userId : current.userId;
    if (targetUserId && (data.userId !== undefined || data.firstName !== undefined || data.lastName !== undefined)) {
      await db.user.update({
        where: { id: targetUserId },
        data: {
          firstName: data.firstName ?? current.firstName,
          lastName: data.lastName ?? current.lastName,
        },
      });
    }
    return db.student.update({ where: { id }, data, include });
  });
}

module.exports = { list, get, create, update };
