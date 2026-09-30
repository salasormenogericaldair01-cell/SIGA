const express = require('express');
const controllerFor = require('../controllers/people-enrollment.controller');
const { authenticate, authorizeRoles } = require('../middlewares/auth.middleware');

function routerFor(kind) {
  const router = express.Router();
  const controller = controllerFor(kind);
  const read = authorizeRoles('ADMIN', 'SECRETARIA');
  const write = kind === 'teacher' ? authorizeRoles('ADMIN') : read;
  router.use(authenticate);
  router.get('/', read, controller.list);
  router.get('/:id', read, controller.get);
  router.post('/', write, controller.create);
  router.patch('/:id', write, controller.update);
  return router;
}

module.exports = routerFor;
