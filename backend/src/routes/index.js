const express = require('express');
const healthRoutes = require('./health.routes');
const createAuthRouter = require('./auth.routes');
const userRoutes = require('./user.routes');

function createRouter() {
  const router = express.Router();

  router.use(healthRoutes);
  router.use('/auth', createAuthRouter());
  router.use('/users', userRoutes);

  return router;
}

module.exports = createRouter;
