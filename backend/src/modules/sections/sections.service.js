const { Section, Grade, EducationLevel, AcademicPeriod } = require('../../models');
const { missingAcademic, requireActiveAcademic } = require('../../shared/academic-helpers');

const include = [
  {
    model: Grade,
    as: 'grade',
    attributes: ['id', 'name', 'order', 'isActive'],
    include: [{ model: EducationLevel, as: 'educationLevel', attributes: ['id', 'code', 'name', 'isActive'] }],
  },
  {
    model: AcademicPeriod,
    as: 'academicPeriod',
    attributes: ['id', 'name', 'startDate', 'endDate', 'isActive'],
  },
];

async function list(filters) {
  return Section.findAll({
    where: filters,
    order: [
      [{ model: AcademicPeriod, as: 'academicPeriod' }, 'startDate', 'ASC'],
      [{ model: Grade, as: 'grade' }, { model: EducationLevel, as: 'educationLevel' }, 'code', 'ASC'],
      [{ model: Grade, as: 'grade' }, 'order', 'ASC'],
      ['name', 'ASC'],
      ['id', 'ASC'],
    ],
    include,
  });
}

async function get(id) {
  const record = await Section.findByPk(id, { include });
  if (!record) throw missingAcademic('section');
  return record;
}

async function create(data) {
  const grade = await requireActiveAcademic('grade', data.gradeId, 'Grado');
  await requireActiveAcademic('educationLevel', grade.educationLevelId, 'Nivel');
  await requireActiveAcademic('academicPeriod', data.academicPeriodId, 'Periodo');
  const created = await Section.create(data);
  return get(created.id);
}

async function update(id, data) {
  const current = await get(id);
  await current.update(data);
  return get(id);
}

module.exports = { list, get, create, update };
