const express = require('express');
const controller = require('./teaching-assignments.controller');
const { authenticate, authorizeRoles } = require('../../middlewares/auth.middleware');

const router = express.Router();
const readRoles = ['ADMIN', 'SECRETARIA', 'DOCENTE'];
const writeRoles = ['ADMIN', 'SECRETARIA'];

router.use(authenticate);
router.get('/', authorizeRoles(...readRoles), controller.list);
router.get('/:id/enrollments', authorizeRoles(...readRoles), controller.listEnrollments);
router.get('/:id', authorizeRoles(...readRoles), controller.get);
router.post('/', authorizeRoles(...writeRoles), controller.create);
router.patch('/:id', authorizeRoles(...writeRoles), controller.update);

module.exports = router;
