const prisma = require('../config/prisma');
const { AppError } = require('./errors');

const missingAcademic = (resource) => new AppError(404, `${resource} no encontrado`);
const invalidAcademic = (message) => new AppError(400, message);

async function requireActiveAcademic(model, id, label) {
  const record = await prisma[model].findUnique({ where: { id } });
  if (!record) throw missingAcademic(label);
  if (!record.isActive) throw invalidAcademic(`${label} inactivo`);
  return record;
}

function assertGradeOrder(code, order) {
  const allowed = code === 'INICIAL' ? [3, 4, 5] : code === 'PRIMARIA' ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5];
  if (!allowed.includes(order)) throw invalidAcademic('Orden inválido para el nivel');
}

function assertPeriodDates(startDate, endDate) {
  if (startDate >= endDate) throw invalidAcademic('La fecha inicial debe ser anterior a la final');
}

module.exports = {
  missingAcademic,
  invalidAcademic,
  requireActiveAcademic,
  assertGradeOrder,
  assertPeriodDates,
};
