const express = require('express');
const { rateLimit } = require('express-rate-limit');
const { login, me } = require('../controllers/auth.controller');
const { authenticate } = require('../middlewares/auth.middleware');

function createAuthRouter() {
  const router = express.Router();
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { message: 'Demasiados intentos. Inténtalo más tarde' },
  });

  router.post('/login', loginLimiter, login);
  router.get('/me', authenticate, me);
  return router;
}

module.exports = createAuthRouter;
