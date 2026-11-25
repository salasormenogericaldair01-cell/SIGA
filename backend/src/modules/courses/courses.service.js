const { Op } = require('sequelize');
const { Course } = require('../../models');
const { AppError } = require('../../shared/errors');
const { paginated } = require('../../shared/pagination');

const order = [['createdAt', 'ASC'], ['id', 'ASC']];

async function list({ search, isActive, page, limit }) {
  const where = {
    ...(isActive === undefined ? {} : { isActive }),
    ...(search
      ? {
          [Op.or]: [
            { code: { [Op.iLike]: `%${search}%` } },
            { name: { [Op.iLike]: `%${search}%` } },
          ],
        }
      : {}),
  };
  const { count, rows } = await Course.findAndCountAll({
    where,
    order,
    offset: (page - 1) * limit,
    limit,
  });
  return paginated(rows, count, page, limit);
}

async function get(id) {
  const course = await Course.findByPk(id);
  if (!course) throw new AppError(404, 'Curso no encontrado');
  return course;
}

async function create(data) {
  return Course.create(data);
}

async function update(id, data) {
  const course = await get(id);
  return course.update(data);
}

module.exports = { list, get, create, update };
