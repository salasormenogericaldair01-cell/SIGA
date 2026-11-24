const express = require('express');
const controller = require('./attendance-records.controller');
const { authenticate, authorizeRoles } = require('../../middlewares/auth.middleware');

const router = express.Router();
const readRoles = ['ADMIN', 'SECRETARIA', 'DOCENTE', 'ESTUDIANTE'];
const writeRoles = ['ADMIN', 'DOCENTE'];

router.use(authenticate);
router.get('/', authorizeRoles(...readRoles), controller.list);
router.get('/:id', authorizeRoles(...readRoles), controller.get);
router.post('/', authorizeRoles(...writeRoles), controller.create);
router.patch('/:id', authorizeRoles(...writeRoles), controller.update);
router.delete('/:id', authorizeRoles(...writeRoles), controller.remove);

module.exports = router;
