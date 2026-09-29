const jwt = require('jsonwebtoken');
const { z } = require('zod');
const prisma = require('../config/prisma');
const env = require('../config/env');
const { publicUserSelect } = require('../utils/user');

async function authenticate(req, res, next) {
  const match = /^Bearer (\S+)$/.exec(req.get('Authorization') || '');
  if (!match) return res.status(401).json({ message: 'No autorizado' });

  let payload;
  try {
    payload = jwt.verify(match[1], env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ message: 'No autorizado' });
    }
    throw error;
  }

  if (
    typeof payload !== 'object' ||
    !z.uuid().safeParse(payload.sub).success ||
    typeof payload.exp !== 'number' ||
    payload.exp <= Math.floor(Date.now() / 1000)
  ) {
    return res.status(401).json({ message: 'No autorizado' });
  }

  // La base es la fuente actual del rol y del estado; el JWT solo identifica.
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { ...publicUserSelect, isActive: true },
  });
  if (!user || !user.isActive) return res.status(401).json({ message: 'No autorizado' });

  const { isActive, ...safeUser } = user;
  req.user = safeUser;
  return next();
}

function authorizeRoles(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'No autorizado' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ message: 'Prohibido' });
    return next();
  };
}

module.exports = { authenticate, authorizeRoles };
