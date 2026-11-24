const { createCrudController } = require('../../shared/crud');
const schemas = require('./academic-periods.validator');
const service = require('./academic-periods.service');

module.exports = createCrudController({
  schemas,
  service,
  itemKey: 'item',
  listKey: 'items',
  errorOptions: { conflict2034Message: 'El periodo cambió durante la operación. Inténtalo de nuevo.' },
});
