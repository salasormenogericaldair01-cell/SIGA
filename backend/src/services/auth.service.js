const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');
const env = require('../config/env');
const { publicUser } = require('../utils/user');

async function login({ email, password }) {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !user.isActive || !(await bcrypt.compare(password, user.passwordHash))) {
    return null;
  }

  const token = jwt.sign({}, env.JWT_SECRET, {
    algorithm: 'HS256',
    subject: user.id,
    expiresIn: env.JWT_EXPIRES_IN,
  });

  return { user: publicUser(user), token };
}

module.exports = { login };
