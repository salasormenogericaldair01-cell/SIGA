const { Grade, EducationLevel } = require('../../models');
const { assertGradeOrder, missingAcademic, requireActiveAcademic } = require('../../shared/academic-helpers');

const include = [
  { model: EducationLevel, as: 'educationLevel', attributes: ['id', 'code', 'name', 'isActive'] },
];

async function list(filters) {
  return Grade.findAll({
    where: filters,
    order: [
      [{ model: EducationLevel, as: 'educationLevel' }, 'code', 'ASC'],
      ['order', 'ASC'],
      ['id', 'ASC'],
    ],
    include,
  });
}

async function get(id) {
  const record = await Grade.findByPk(id, { include });
  if (!record) throw missingAcademic('grade');
  return record;
}

async function create(data) {
  const level = await requireActiveAcademic('educationLevel', data.educationLevelId, 'Nivel');
  assertGradeOrder(level.code, data.order);
  const created = await Grade.create(data);
  return get(created.id);
}

async function update(id, data) {
  const current = await get(id);
  if (data.order !== undefined) {
    const level = await EducationLevel.findByPk(current.educationLevelId);
    assertGradeOrder(level.code, data.order);
  }
  await current.update(data);
  return get(id);
}

module.exports = { list, get, create, update };
