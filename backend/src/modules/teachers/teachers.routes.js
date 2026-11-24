const express = require('express');
const controller = require('./teachers.controller');
const { authenticate, authorizeRoles } = require('../../middlewares/auth.middleware');

const router = express.Router();

router.use(authenticate);
router.get('/', authorizeRoles('ADMIN', 'SECRETARIA'), controller.list);
router.get('/:id', authorizeRoles('ADMIN', 'SECRETARIA'), controller.get);
router.post('/', authorizeRoles('ADMIN'), controller.create);
router.patch('/:id', authorizeRoles('ADMIN'), controller.update);

module.exports = router;
