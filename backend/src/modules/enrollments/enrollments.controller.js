const { createCrudController } = require('../../shared/crud');
const schemas = require('./enrollments.validator');
const service = require('./enrollments.service');

module.exports = createCrudController({ schemas, service, itemKey: 'data' });
