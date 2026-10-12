const express = require('express');
const { createHash } = require('node:crypto');
const { rateLimit, ipKeyGenerator, MemoryStore } = require('express-rate-limit');
const { login, me, updateProfile, changePassword } = require('../controllers/auth.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { emailSchema } = require('../validators/user.validator');

function loginKey(req) {
  const email = emailSchema.safeParse(req.body?.email);
  if (email.success) {
    return `account:${createHash('sha256').update(email.data).digest('hex')}`;
  }
  return `ip:${ipKeyGenerator(req.ip)}`;
}

const loginWindowMs = 15 * 60 * 1000;
const limitedMessage = { message: 'Demasiados intentos. Inténtalo más tarde' };

function notFailedLogin(_req, res) {
  return res.statusCode < 400 || res.statusCode === 429 || res.statusCode >= 500;
}

function rejectLimited(property) {
  return (req, res) => {
    const resetTime = req[property]?.resetTime;
    const seconds = resetTime ? Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 1000)) : loginWindowMs / 1000;
    res.set('Retry-After', String(seconds));
    return res.status(429).json(limitedMessage);
  };
}

function createAuthRouter() {
  const router = express.Router();
  // Las respuestas de autenticación contienen o dependen de datos de sesión.
  // no-store cubre éxitos y errores; Pragma no-cache es solo compatibilidad heredada.
  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  const loginIpLimiter = rateLimit({
    windowMs: loginWindowMs,
    limit: 30,
    keyGenerator: (req) => ipKeyGenerator(req.ip),
    store: new MemoryStore(),
    requestPropertyName: 'loginIpLimit',
    skipSuccessfulRequests: true,
    requestWasSuccessful: notFailedLogin,
    standardHeaders: false,
    legacyHeaders: false,
    handler: rejectLimited('loginIpLimit'),
  });
  const loginAccountLimiter = rateLimit({
    windowMs: loginWindowMs,
    limit: 5,
    keyGenerator: loginKey,
    store: new MemoryStore(),
    requestPropertyName: 'loginAccountLimit',
    skipSuccessfulRequests: true,
    requestWasSuccessful: notFailedLogin,
    standardHeaders: false,
    legacyHeaders: false,
    handler: rejectLimited('loginAccountLimit'),
  });
  const changePasswordLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { message: 'Demasiados intentos. Inténtalo más tarde' },
  });

  router.post('/login', loginIpLimiter, loginAccountLimiter, login);
  router.get('/me', authenticate, me);
  router.patch('/me', authenticate, updateProfile);
  router.post('/change-password', authenticate, changePasswordLimiter, changePassword);
  return router;
}

module.exports = createAuthRouter;
