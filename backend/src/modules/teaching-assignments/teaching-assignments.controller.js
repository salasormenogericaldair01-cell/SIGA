const { createCrudController } = require('../../shared/crud');
const { respondError } = require('../../shared/errors');
const { uuidSchema } = require('../../shared/pagination');
const schemas = require('./teaching-assignments.validator');
const service = require('./teaching-assignments.service');

const base = createCrudController({ schemas, service, itemKey: 'data' });

async function listEnrollments(req, res) {
  const id = uuidSchema.safeParse(req.params.id);
  const query = schemas.enrollments.safeParse(req.query);
  if (!id.success || !query.success) return res.status(400).json({ message: 'Datos inválidos' });
  try {
    return res.json(await service.listEnrollments(id.data, query.data, req.user));
  } catch (error) {
    return respondError(error, res);
  }
}

module.exports = { ...base, listEnrollments };
