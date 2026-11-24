const { createCrudController } = require('../../shared/crud');
const schemas = require('./attendance-records.validator');
const service = require('./attendance-records.service');

module.exports = createCrudController({ schemas, service, itemKey: 'data' });
