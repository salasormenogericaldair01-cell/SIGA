const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');
const env = require('../config/env');
const { publicUser } = require('../utils/user');
const { passwordSchema } = require('../validators/user.validator');

async function login({ email, password }) {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !user.isActive || !(await bcrypt.compare(password, user.passwordHash))) {
    return null;
  }

  const token = jwt.sign({ tokenVersion: user.tokenVersion }, env.JWT_SECRET, {
    algorithm: 'HS256',
    subject: user.id,
    expiresIn: env.JWT_EXPIRES_IN,
  });

  return { user: publicUser(user), token };
}

async function changePassword(userId, tokenVersion, currentPassword, newPassword) {
  // Releer el hash y usar una actualización condicional evita que dos cambios
  // concurrentes acepten la misma contraseña anterior.
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true, tokenVersion: true, isActive: true },
  });
  if (!user || !user.isActive || user.tokenVersion !== tokenVersion) return 'stale-session';
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) return 'invalid-current';

  const password = passwordSchema.parse(newPassword);
  const passwordHash = await bcrypt.hash(password, env.BCRYPT_ROUNDS);
  const result = await prisma.user.updateMany({
    where: { id: userId, isActive: true, passwordHash: user.passwordHash, tokenVersion },
    data: { passwordHash, tokenVersion: { increment: 1 } },
  });
  return result.count === 1 ? 'changed' : 'stale-session';
}

module.exports = { login, changePassword };
