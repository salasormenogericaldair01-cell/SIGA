const { createCrudController } = require('../../shared/crud');
const schemas = require('./sections.validator');
const service = require('./sections.service');

module.exports = createCrudController({ schemas, service, itemKey: 'item', listKey: 'items' });
