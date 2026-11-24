const { respondError } = require('./errors');
const { uuidSchema } = require('./pagination');

function createCrudController({
  schemas,
  service,
  itemKey = 'data',
  listKey = null,
  idSchema = uuidSchema,
  errorOptions = {},
}) {
  const handleError = (error, res) => respondError(error, res, errorOptions);

  return {
    async list(req, res) {
      const query = schemas.filters.safeParse(req.query);
      if (!query.success) return res.status(400).json({ message: 'Datos inválidos' });
      try {
        const result = await service.list(query.data, req.user);
        return res.json(listKey ? { [listKey]: result } : result);
      } catch (error) {
        return handleError(error, res);
      }
    },

    async get(req, res) {
      const id = idSchema.safeParse(req.params.id);
      if (!id.success) return res.status(400).json({ message: 'Datos inválidos' });
      try {
        return res.json({ [itemKey]: await service.get(id.data, req.user) });
      } catch (error) {
        return handleError(error, res);
      }
    },

    async create(req, res) {
      const body = schemas.create.safeParse(req.body);
      if (!body.success) return res.status(400).json({ message: 'Datos inválidos' });
      try {
        return res.status(201).json({ [itemKey]: await service.create(body.data, req.user) });
      } catch (error) {
        return handleError(error, res);
      }
    },

    async update(req, res) {
      const id = idSchema.safeParse(req.params.id);
      const body = schemas.patch.safeParse(req.body);
      if (!id.success || !body.success) return res.status(400).json({ message: 'Datos inválidos' });
      try {
        return res.json({ [itemKey]: await service.update(id.data, body.data, req.user) });
      } catch (error) {
        return handleError(error, res);
      }
    },

    async remove(req, res) {
      const id = idSchema.safeParse(req.params.id);
      if (!id.success) return res.status(400).json({ message: 'Datos inválidos' });
      try {
        return res.json({ [itemKey]: await service.remove(id.data, req.user) });
      } catch (error) {
        return handleError(error, res);
      }
    },
  };
}

module.exports = { createCrudController };
