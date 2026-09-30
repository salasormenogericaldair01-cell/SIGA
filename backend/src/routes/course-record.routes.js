const express = require('express');
const controllerFor = require('../controllers/course-record.controller');
const { authenticate, authorizeRoles } = require('../middlewares/auth.middleware');

function routerFor(kind) {
  const router = express.Router();
  const controller = controllerFor(kind);
  const readRoles = kind === 'gradeRecord' || kind === 'attendanceRecord'
    ? ['ADMIN', 'SECRETARIA', 'DOCENTE', 'ESTUDIANTE'] : ['ADMIN', 'SECRETARIA', 'DOCENTE'];
  const writeRoles = kind === 'gradeRecord' || kind === 'attendanceRecord'
    ? ['ADMIN', 'DOCENTE'] : ['ADMIN', 'SECRETARIA'];
  router.use(authenticate);
  router.get('/', authorizeRoles(...readRoles), controller.list);
  if (kind === 'assignment') {
    router.get('/:id/enrollments', authorizeRoles(...readRoles), controller.assignmentEnrollments);
  }
  router.get('/:id', authorizeRoles(...readRoles), controller.get);
  router.post('/', authorizeRoles(...writeRoles), controller.create);
  router.patch('/:id', authorizeRoles(...writeRoles), controller.update);
  return router;
}

module.exports = routerFor;
