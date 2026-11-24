const express = require('express');
const { getHealth } = require('./health.controller');

const router = express.Router();

router.get('/health', getHealth);

module.exports = router;
