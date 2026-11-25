const { Op } = require('sequelize');
const { sequelize, Teacher, User } = require('../../models');
const { publicUserAttributes } = require('../../shared/user-projection');
const { AppError } = require('../../shared/errors');
const { paginated } = require('../../shared/pagination');

const order = [['createdAt', 'ASC'], ['id', 'ASC']];

function buildInclude(search) {
  return [{
    model: User,
    as: 'user',
    attributes: publicUserAttributes,
    ...(search
      ? {
          where: {
            [Op.or]: ['firstName', 'lastName', 'email'].map((field) => ({
              [field]: { [Op.iLike]: `%${search}%` },
            })),
          },
          required: true,
        }
      : {}),
  }];
}

async function requireTeacherUser(transaction, userId) {
  const user = await User.findByPk(userId, { attributes: ['id', 'role', 'isActive'], transaction });
  if (!user) throw new AppError(404, 'Usuario no encontrado');
  if (!user.isActive || user.role !== 'DOCENTE') throw new AppError(409, 'Usuario incompatible o inactivo');
}

async function list({ search, isActive, page, limit }) {
  const where = { ...(isActive === undefined ? {} : { isActive }) };
  const { count, rows } = await Teacher.findAndCountAll({
    where,
    include: buildInclude(search),
    order,
    offset: (page - 1) * limit,
    limit,
    distinct: true,
  });
  return paginated(rows, count, page, limit);
}

async function get(id) {
  const teacher = await Teacher.findByPk(id, { include: buildInclude() });
  if (!teacher) throw new AppError(404, 'Docente no encontrado');
  return teacher;
}

async function create(data) {
  return sequelize.transaction(async (transaction) => {
    await requireTeacherUser(transaction, data.userId);
    const created = await Teacher.create(data, { transaction });
    return Teacher.findByPk(created.id, { include: buildInclude(), transaction });
  });
}

async function update(id, data) {
  return sequelize.transaction(async (transaction) => {
    const current = await Teacher.findByPk(id, { attributes: ['id'], transaction });
    if (!current) throw new AppError(404, 'Docente no encontrado');
    await current.update(data, { transaction });
    return Teacher.findByPk(id, { include: buildInclude(), transaction });
  });
}

module.exports = { list, get, create, update };
