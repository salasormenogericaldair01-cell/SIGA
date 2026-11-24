const { createCrudController } = require('../../shared/crud');
const schemas = require('./grades.validator');
const service = require('./grades.service');

module.exports = createCrudController({ schemas, service, itemKey: 'item', listKey: 'items' });
