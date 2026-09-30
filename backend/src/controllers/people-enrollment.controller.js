const schemas = require('../validators/people-enrollment.validator');
const profiles = require('../services/profile.service');
const enrollments = require('../services/enrollment.service');
const { respond } = require('../utils/module-error');

const services = {
  student: { list: profiles.listStudents, get: profiles.getStudent, create: profiles.createStudent, update: profiles.updateStudent },
  teacher: { list: profiles.listTeachers, get: profiles.getTeacher, create: profiles.createTeacher, update: profiles.updateTeacher },
  enrollment: enrollments,
};

function controllerFor(kind) {
  const schema = schemas[kind];
  const service = services[kind];
  return {
    async list(req, res) {
      const query = schema.filters.safeParse(req.query);
      if (!query.success) return res.status(400).json({ message: 'Datos inválidos' });
      try { return res.json(await service.list(query.data)); }
      catch (error) { return respond(error, res); }
    },
    async get(req, res) {
      const id = schemas.id.safeParse(req.params.id);
      if (!id.success) return res.status(400).json({ message: 'Datos inválidos' });
      try { return res.json({ data: await service.get(id.data) }); }
      catch (error) { return respond(error, res); }
    },
    async create(req, res) {
      const body = schema.create.safeParse(req.body);
      if (!body.success) return res.status(400).json({ message: 'Datos inválidos' });
      try { return res.status(201).json({ data: await service.create(body.data) }); }
      catch (error) { return respond(error, res); }
    },
    async update(req, res) {
      const id = schemas.id.safeParse(req.params.id);
      const body = schema.patch.safeParse(req.body);
      if (!id.success || !body.success) return res.status(400).json({ message: 'Datos inválidos' });
      try { return res.json({ data: await service.update(id.data, body.data) }); }
      catch (error) { return respond(error, res); }
    },
  };
}

module.exports = controllerFor;
