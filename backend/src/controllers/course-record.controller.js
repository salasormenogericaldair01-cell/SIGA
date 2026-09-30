const schemas = require('../validators/course-record.validator');
const courses = require('../services/course-assignment.service');
const records = require('../services/academic-record.service');
const { respond } = require('../utils/module-error');

const services = {
  course: {
    list: (filters) => courses.listCourses(filters), get: (id) => courses.getCourse(id),
    create: (data) => courses.createCourse(data), update: (id, data) => courses.updateCourse(id, data),
  },
  assignment: {
    list: courses.listAssignments, get: courses.getAssignment,
    create: (data) => courses.createAssignment(data), update: (id, data) => courses.updateAssignment(id, data),
  },
  gradeRecord: {
    list: (filters, user) => records.list('gradeRecord', filters, user),
    get: (id, user) => records.get('gradeRecord', id, user),
    create: (data, user) => records.create('gradeRecord', data, user),
    update: (id, data, user) => records.update('gradeRecord', id, data, user),
  },
  attendanceRecord: {
    list: (filters, user) => records.list('attendanceRecord', filters, user),
    get: (id, user) => records.get('attendanceRecord', id, user),
    create: (data, user) => records.create('attendanceRecord', data, user),
    update: (id, data, user) => records.update('attendanceRecord', id, data, user),
  },
};

function controllerFor(kind) {
  const schema = schemas[kind];
  const service = services[kind];
  return {
    async list(req, res) {
      const query = schema.filters.safeParse(req.query);
      if (!query.success) return res.status(400).json({ message: 'Datos inválidos' });
      try { return res.json(await service.list(query.data, req.user)); }
      catch (error) { return respond(error, res); }
    },
    async get(req, res) {
      const id = schemas.id.safeParse(req.params.id);
      if (!id.success) return res.status(400).json({ message: 'Datos inválidos' });
      try { return res.json({ data: await service.get(id.data, req.user) }); }
      catch (error) { return respond(error, res); }
    },
    async create(req, res) {
      const body = schema.create.safeParse(req.body);
      if (!body.success) return res.status(400).json({ message: 'Datos inválidos' });
      try { return res.status(201).json({ data: await service.create(body.data, req.user) }); }
      catch (error) { return respond(error, res); }
    },
    async update(req, res) {
      const id = schemas.id.safeParse(req.params.id);
      const body = schema.patch.safeParse(req.body);
      if (!id.success || !body.success) return res.status(400).json({ message: 'Datos inválidos' });
      try { return res.json({ data: await service.update(id.data, body.data, req.user) }); }
      catch (error) { return respond(error, res); }
    },
    async assignmentEnrollments(req, res) {
      const id = schemas.id.safeParse(req.params.id);
      const query = schemas.assignment.enrollments.safeParse(req.query);
      if (!id.success || !query.success) return res.status(400).json({ message: 'Datos inválidos' });
      try { return res.json(await courses.assignmentEnrollments(id.data, query.data, req.user)); }
      catch (error) { return respond(error, res); }
    },
  };
}

module.exports = controllerFor;
