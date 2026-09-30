const prisma = require('../config/prisma');

class AcademicError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const missing = (resource) => new AcademicError(404, `${resource} no encontrado`);
const invalid = (message) => new AcademicError(400, message);

async function requireActive(model, id, label) {
  const record = await prisma[model].findUnique({ where: { id } });
  if (!record) throw missing(label);
  if (!record.isActive) throw invalid(`${label} inactivo`);
  return record;
}

function assertOrder(code, order) {
  const allowed = code === 'INICIAL' ? [3, 4, 5] : code === 'PRIMARIA' ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5];
  if (!allowed.includes(order)) throw invalid('Orden inválido para el nivel');
}

function assertDates(startDate, endDate) {
  if (startDate >= endDate) throw invalid('La fecha inicial debe ser anterior a la final');
}

async function list(model, filters) {
  return prisma[model].findMany({ where: filters, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
}

async function get(model, id) {
  const record = await prisma[model].findUnique({ where: { id } });
  if (!record) throw missing(model);
  return record;
}

async function create(model, data) {
  if (model === 'grade') {
    const level = await requireActive('educationLevel', data.educationLevelId, 'Nivel');
    assertOrder(level.code, data.order);
  } else if (model === 'academicPeriod') {
    assertDates(data.startDate, data.endDate);
  } else if (model === 'section') {
    const grade = await requireActive('grade', data.gradeId, 'Grado');
    await requireActive('educationLevel', grade.educationLevelId, 'Nivel');
    await requireActive('academicPeriod', data.academicPeriodId, 'Periodo');
  }
  return prisma[model].create({ data });
}

async function update(model, id, data) {
  const current = await get(model, id);
  if (model === 'grade' && data.order !== undefined) {
    const level = await prisma.educationLevel.findUnique({ where: { id: current.educationLevelId } });
    assertOrder(level.code, data.order);
  } else if (model === 'academicPeriod') {
    assertDates(data.startDate || current.startDate, data.endDate || current.endDate);
  }
  return prisma[model].update({ where: { id }, data });
}

module.exports = { AcademicError, list, get, create, update };
