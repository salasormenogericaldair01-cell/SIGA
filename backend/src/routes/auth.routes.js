const express = require('express');
const { rateLimit } = require('express-rate-limit');
const { login, me, updateProfile, changePassword } = require('../controllers/auth.controller');
const { authenticate } = require('../middlewares/auth.middleware');

function createAuthRouter() {
  const router = express.Router();
  // Las respuestas de autenticación contienen o dependen de datos de sesión.
  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { message: 'Demasiados intentos. Inténtalo más tarde' },
  });
  const changePasswordLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { message: 'Demasiados intentos. Inténtalo más tarde' },
  });

  router.post('/login', loginLimiter, login);
  router.get('/me', authenticate, me);
  router.patch('/me', authenticate, updateProfile);
  router.post('/change-password', authenticate, changePasswordLimiter, changePassword);
  return router;
}

module.exports = createAuthRouter;
