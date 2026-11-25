const models = require('../models');
const { AppError } = require('./errors');

const modelMap = {
  educationLevel: models.EducationLevel,
  grade: models.Grade,
  academicPeriod: models.AcademicPeriod,
  section: models.Section,
};

const missingAcademic = (resource) => new AppError(404, `${resource} no encontrado`);
const invalidAcademic = (message) => new AppError(400, message);

function toDateOnlyISO(value) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

async function requireActiveAcademic(modelKey, id, label) {
  const Model = modelMap[modelKey];
  const record = await Model.findByPk(id);
  if (!record) throw missingAcademic(label);
  if (!record.isActive) throw invalidAcademic(`${label} inactivo`);
  return record;
}

function assertGradeOrder(code, order) {
  const allowed = code === 'INICIAL' ? [3, 4, 5] : code === 'PRIMARIA' ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5];
  if (!allowed.includes(order)) throw invalidAcademic('Orden inválido para el nivel');
}

function assertPeriodDates(startDate, endDate) {
  if (toDateOnlyISO(startDate) >= toDateOnlyISO(endDate)) {
    throw invalidAcademic('La fecha inicial debe ser anterior a la final');
  }
}

module.exports = {
  missingAcademic,
  invalidAcademic,
  toDateOnlyISO,
  requireActiveAcademic,
  assertGradeOrder,
  assertPeriodDates,
};
