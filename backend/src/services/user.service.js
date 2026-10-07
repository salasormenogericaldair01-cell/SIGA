const bcrypt = require('bcrypt');
const prisma = require('../config/prisma');
const env = require('../config/env');
const { adminUserSelect, adminUser } = require('../utils/user');

async function createUser(data) {
  const { password, ...fields } = data;
  const passwordHash = await bcrypt.hash(password, env.BCRYPT_ROUNDS);
  const user = await prisma.user.create({
    data: { ...fields, passwordHash },
    select: adminUserSelect,
  });
  return adminUser(user);
}

async function listUsers({ search, role, isActive, page, limit } = {}) {
  const where = {
    ...(role ? { role } : {}),
    ...(isActive === undefined ? {} : { isActive }),
    ...(search ? { OR: ['firstName', 'lastName', 'email'].map((field) => ({ [field]: { contains: search, mode: 'insensitive' } })) } : {}),
  };
  const paginated = page !== undefined || limit !== undefined;
  const currentPage = page || 1;
  const pageSize = limit || 20;
  const query = {
    where,
    select: adminUserSelect,
    orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    ...(paginated ? { skip: (currentPage - 1) * pageSize, take: pageSize } : {}),
  };
  if (!paginated) return { users: (await prisma.user.findMany(query)).map(adminUser) };
  const [total, users] = await Promise.all([prisma.user.count({ where }), prisma.user.findMany(query)]);
  return { users: users.map(adminUser), pagination: { page: currentPage, limit: pageSize, total, totalPages: Math.ceil(total / pageSize) } };
}

async function getUser(id) {
  const user = await prisma.user.findUnique({ where: { id }, select: adminUserSelect });
  return user ? adminUser(user) : null;
}

async function updateUser(id, data) {
  const user = await prisma.user.update({ where: { id }, data, select: adminUserSelect });
  return adminUser(user);
}

async function setStatus(id, isActive) {
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!user) return null;

  const updated = await prisma.user.update({
    where: { id },
    data: { isActive },
    select: adminUserSelect,
  });
  return adminUser(updated);
}

module.exports = { createUser, listUsers, getUser, updateUser, setStatus };
