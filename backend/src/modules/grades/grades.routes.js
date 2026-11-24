const express = require('express');
const controller = require('./grades.controller');
const { authenticate, authorizeRoles } = require('../../middlewares/auth.middleware');

const router = express.Router();

router.use(authenticate, authorizeRoles('ADMIN', 'SECRETARIA'));
router.get('/', controller.list);
router.get('/:id', controller.get);
router.post('/', controller.create);
router.patch('/:id', controller.update);

module.exports = router;
