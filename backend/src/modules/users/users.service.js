const bcrypt = require('bcrypt');
const { Op } = require('sequelize');
const env = require('../../config/env');
const { sequelize, User, Student } = require('../../models');
const { adminUserAttributes, adminUser } = require('../../shared/user-projection');

async function createUser(data) {
  const { password, ...fields } = data;
  const passwordHash = await bcrypt.hash(password, env.BCRYPT_ROUNDS);
  const created = await User.create({ ...fields, passwordHash });
  const user = await User.findByPk(created.id, { attributes: adminUserAttributes });
  return adminUser(user);
}

async function listUsers({ search, role, isActive, page, limit } = {}) {
  const where = {
    ...(role ? { role } : {}),
    ...(isActive === undefined ? {} : { isActive }),
    ...(search
      ? { [Op.or]: ['firstName', 'lastName', 'email'].map((field) => ({ [field]: { [Op.iLike]: `%${search}%` } })) }
      : {}),
  };
  const paginated = page !== undefined || limit !== undefined;
  const currentPage = page || 1;
  const pageSize = limit || 20;
  const query = {
    where,
    attributes: adminUserAttributes,
    order: [['createdAt', 'DESC'], ['id', 'ASC']],
    ...(paginated ? { offset: (currentPage - 1) * pageSize, limit: pageSize } : {}),
  };
  if (!paginated) {
    const rows = await User.findAll(query);
    return { users: rows.map(adminUser) };
  }
  const { count, rows } = await User.findAndCountAll(query);
  return {
    users: rows.map(adminUser),
    pagination: { page: currentPage, limit: pageSize, total: count, totalPages: Math.ceil(count / pageSize) },
  };
}

async function getUser(id) {
  const user = await User.findByPk(id, { attributes: adminUserAttributes });
  return user ? adminUser(user) : null;
}

async function updateUser(id, data) {
  return sequelize.transaction(async (transaction) => {
    const user = await User.findByPk(id, { attributes: adminUserAttributes, transaction });
    if (!user) throw Object.assign(new Error('missing'), { code: 'P2025' });
    await user.update(data, { transaction });
    if (data.firstName !== undefined || data.lastName !== undefined) {
      await Student.update(
        {
          ...(data.firstName !== undefined ? { firstName: data.firstName } : {}),
          ...(data.lastName !== undefined ? { lastName: data.lastName } : {}),
        },
        { where: { userId: id }, transaction },
      );
    }
    return adminUser(user);
  });
}

async function setStatus(id, isActive) {
  const user = await User.findByPk(id, { attributes: adminUserAttributes });
  if (!user) return null;
  await user.update({ isActive });
  return adminUser(user);
}

module.exports = { createUser, listUsers, getUser, updateUser, setStatus };
