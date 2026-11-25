const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const env = require('../../config/env');
const { sequelize, User, Student } = require('../../models');
const { publicUser, publicUserAttributes } = require('../../shared/user-projection');
const { passwordSchema } = require('./auth.validator');

async function login({ email, password }) {
  const user = await User.findOne({ where: { email } });

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
  const user = await User.findByPk(userId, {
    attributes: ['passwordHash', 'tokenVersion', 'isActive'],
    raw: true,
  });
  if (!user || !user.isActive || user.tokenVersion !== tokenVersion) return 'stale-session';
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) return 'invalid-current';

  const password = passwordSchema.parse(newPassword);
  const passwordHash = await bcrypt.hash(password, env.BCRYPT_ROUNDS);
  const [affectedCount] = await User.update(
    { passwordHash, tokenVersion: tokenVersion + 1 },
    { where: { id: userId, isActive: true, passwordHash: user.passwordHash, tokenVersion } },
  );
  return affectedCount === 1 ? 'changed' : 'stale-session';
}

async function updateProfile(userId, tokenVersion, fields) {
  return sequelize.transaction(async (transaction) => {
    const [affectedCount] = await User.update(fields, {
      where: { id: userId, isActive: true, tokenVersion },
      transaction,
    });
    if (affectedCount !== 1) {
      throw Object.assign(new Error('missing'), { code: 'P2025' });
    }
    if (fields.firstName !== undefined || fields.lastName !== undefined) {
      await Student.update(
        {
          ...(fields.firstName !== undefined ? { firstName: fields.firstName } : {}),
          ...(fields.lastName !== undefined ? { lastName: fields.lastName } : {}),
        },
        { where: { userId }, transaction },
      );
    }
    return User.findByPk(userId, { attributes: publicUserAttributes, raw: true, transaction });
  });
}

module.exports = { login, changePassword, updateProfile };
