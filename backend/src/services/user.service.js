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

async function listUsers() {
  const users = await prisma.user.findMany({
    select: adminUserSelect,
    orderBy: { createdAt: 'desc' },
  });
  return users.map(adminUser);
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

module.exports = { createUser, listUsers, setStatus };
