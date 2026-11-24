const { createCrudController } = require('../../shared/crud');
const schemas = require('./education-levels.validator');
const service = require('./education-levels.service');

module.exports = createCrudController({ schemas, service, itemKey: 'item', listKey: 'items' });
