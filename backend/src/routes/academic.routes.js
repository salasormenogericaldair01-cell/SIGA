const express = require('express');
const academicController = require('../controllers/academic.controller');
const { authenticate, authorizeRoles } = require('../middlewares/auth.middleware');

function academicRouter(model) {
  const router = express.Router();
  const controller = academicController(model);
  router.use(authenticate, authorizeRoles('ADMIN', 'SECRETARIA'));
  router.get('/', controller.list);
  router.get('/:id', controller.get);
  router.post('/', controller.create);
  router.patch('/:id', controller.update);
  return router;
}

module.exports = academicRouter;
