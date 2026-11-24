const { createCrudController } = require('../../shared/crud');
const schemas = require('./courses.validator');
const service = require('./courses.service');

module.exports = createCrudController({ schemas, service, itemKey: 'data' });
