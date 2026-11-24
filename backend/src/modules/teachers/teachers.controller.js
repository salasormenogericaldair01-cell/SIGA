const { createCrudController } = require('../../shared/crud');
const schemas = require('./teachers.validator');
const service = require('./teachers.service');

module.exports = createCrudController({ schemas, service, itemKey: 'data' });
