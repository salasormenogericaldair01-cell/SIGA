const { createCrudController } = require('../../shared/crud');
const schemas = require('./students.validator');
const service = require('./students.service');

module.exports = createCrudController({ schemas, service, itemKey: 'data' });
