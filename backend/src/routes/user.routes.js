const express = require('express');
const { create, list, setStatus } = require('../controllers/user.controller');
const { authenticate, authorizeRoles } = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(authenticate, authorizeRoles('ADMIN'));
router.post('/', create);
router.get('/', list);
router.patch('/:id/status', setStatus);

module.exports = router;
