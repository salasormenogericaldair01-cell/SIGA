const { createCrudController } = require('../../shared/crud');
const schemas = require('./grade-records.validator');
const service = require('./grade-records.service');

module.exports = createCrudController({ schemas, service, itemKey: 'data' });
