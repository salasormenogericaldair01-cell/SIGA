const express = require('express');
const controller = require('./courses.controller');
const { authenticate, authorizeRoles } = require('../../middlewares/auth.middleware');

const router = express.Router();

router.use(authenticate);
router.get('/', authorizeRoles('ADMIN', 'SECRETARIA', 'DOCENTE'), controller.list);
router.get('/:id', authorizeRoles('ADMIN', 'SECRETARIA', 'DOCENTE'), controller.get);
router.post('/', authorizeRoles('ADMIN', 'SECRETARIA'), controller.create);
router.patch('/:id', authorizeRoles('ADMIN', 'SECRETARIA'), controller.update);

module.exports = router;
