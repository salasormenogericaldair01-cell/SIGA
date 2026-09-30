const service = require('../services/academic.service');
const { definitions, uuid } = require('../validators/academic.validator');

function academicController(model) {
  const schema = definitions[model];
  const sendError = (error, res) => {
    if (error instanceof service.AcademicError) return res.status(error.status).json({ message: error.message });
    if (error.code === 'P2002') return res.status(409).json({ message: 'Registro duplicado' });
    if (error.code === 'P2003') return res.status(404).json({ message: 'Referencia no encontrada' });
    if (error.code === 'P2004') return res.status(400).json({ message: 'Datos inválidos' });
    if (error.code === 'P2025') return res.status(404).json({ message: 'Recurso no encontrado' });
    throw error;
  };
  return {
    async list(req, res) {
      const parsed = schema.filters.safeParse(req.query);
      if (!parsed.success) return res.status(400).json({ message: 'Datos inválidos' });
      return res.json({ items: await service.list(model, parsed.data) });
    },
    async get(req, res) {
      const id = uuid.safeParse(req.params.id);
      if (!id.success) return res.status(400).json({ message: 'Datos inválidos' });
      try { return res.json({ item: await service.get(model, id.data) }); }
      catch (error) { return sendError(error, res); }
    },
    async create(req, res) {
      const parsed = schema.create.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: 'Datos inválidos' });
      try { return res.status(201).json({ item: await service.create(model, parsed.data) }); }
      catch (error) { return sendError(error, res); }
    },
    async update(req, res) {
      const id = uuid.safeParse(req.params.id);
      const parsed = schema.patch.safeParse(req.body);
      if (!id.success || !parsed.success) return res.status(400).json({ message: 'Datos inválidos' });
      try { return res.json({ item: await service.update(model, id.data, parsed.data) }); }
      catch (error) { return sendError(error, res); }
    },
  };
}

module.exports = academicController;
