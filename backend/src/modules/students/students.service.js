const { Op } = require('sequelize');
const { sequelize, Student, User } = require('../../models');
const { publicUserAttributes } = require('../../shared/user-projection');
const { AppError } = require('../../shared/errors');
const { paginated } = require('../../shared/pagination');
const { toDateOnlyISO } = require('../../shared/academic-helpers');

const include = [{ model: User, as: 'user', attributes: publicUserAttributes }];
const order = [['createdAt', 'ASC'], ['id', 'ASC']];

async function requireStudentUser(transaction, userId) {
  const user = await User.findByPk(userId, { attributes: ['id', 'role', 'isActive'], transaction });
  if (!user) throw new AppError(404, 'Usuario no encontrado');
  if (!user.isActive || user.role !== 'ESTUDIANTE') throw new AppError(409, 'Usuario incompatible o inactivo');
}

async function list({ search, isActive, page, limit }) {
  const where = {
    ...(isActive === undefined ? {} : { isActive }),
    ...(search
      ? {
          [Op.or]: ['studentCode', 'firstName', 'lastName'].map((field) => ({
            [field]: { [Op.iLike]: `%${search}%` },
          })),
        }
      : {}),
  };
  const { count, rows } = await Student.findAndCountAll({
    where,
    include,
    order,
    offset: (page - 1) * limit,
    limit,
  });
  return paginated(rows, count, page, limit);
}

async function get(id) {
  const student = await Student.findByPk(id, { include });
  if (!student) throw new AppError(404, 'Estudiante no encontrado');
  return student;
}

async function create(data) {
  return sequelize.transaction(async (transaction) => {
    if (data.userId) {
      await requireStudentUser(transaction, data.userId);
      await User.update(
        { firstName: data.firstName, lastName: data.lastName },
        { where: { id: data.userId }, transaction },
      );
    }
    const created = await Student.create(
      { ...data, birthDate: toDateOnlyISO(data.birthDate) },
      { transaction },
    );
    return Student.findByPk(created.id, { include, transaction });
  });
}

async function update(id, data) {
  return sequelize.transaction(async (transaction) => {
    const current = await Student.findByPk(id, {
      attributes: ['id', 'userId', 'firstName', 'lastName'],
      transaction,
    });
    if (!current) throw new AppError(404, 'Estudiante no encontrado');
    if (data.userId) await requireStudentUser(transaction, data.userId);
    const targetUserId = data.userId !== undefined ? data.userId : current.userId;
    if (targetUserId && (data.userId !== undefined || data.firstName !== undefined || data.lastName !== undefined)) {
      await User.update(
        {
          firstName: data.firstName ?? current.firstName,
          lastName: data.lastName ?? current.lastName,
        },
        { where: { id: targetUserId }, transaction },
      );
    }
    await current.update(
      { ...data, ...(data.birthDate ? { birthDate: toDateOnlyISO(data.birthDate) } : {}) },
      { transaction },
    );
    return Student.findByPk(id, { include, transaction });
  });
}

module.exports = { list, get, create, update };
