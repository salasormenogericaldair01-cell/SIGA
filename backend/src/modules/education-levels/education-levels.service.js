const { EducationLevel } = require('../../models');
const { missingAcademic } = require('../../shared/academic-helpers');

async function list(filters) {
  return EducationLevel.findAll({
    where: filters,
    order: [['code', 'ASC'], ['id', 'ASC']],
  });
}

async function get(id) {
  const record = await EducationLevel.findByPk(id);
  if (!record) throw missingAcademic('educationLevel');
  return record;
}

async function create(data) {
  return EducationLevel.create(data);
}

async function update(id, data) {
  const record = await get(id);
  return record.update(data);
}

module.exports = { list, get, create, update };
