const { sequelize, EducationLevel, Grade, User } = require('../../src/models');
const { seedAcademic, levels } = require('../../scripts/setup/seed-academic');

test('seed académico en siga_test: dos ejecuciones conservan cambios, usuarios y no duplican', async () => {
  const url = new URL(process.env.DATABASE_URL);
  const [target] = await sequelize.query('SELECT current_database() AS name, inet_server_port() AS port');
  if (target[0].name !== 'siga_test' || target[0].port !== 5433 ||
      !['127.0.0.1', 'localhost'].includes(url.hostname) || url.pathname !== '/siga_test') {
    throw new Error('La prueba del seed requiere siga_test en localhost:5433');
  }

  const usersBefore = await User.findAll({ attributes: ['id', 'email', 'role', 'isActive'], order: [['id', 'ASC']], raw: true });
  const rollback = new Error('rollback de datos temporales del seed');
  try {
    await sequelize.transaction(async (transaction) => {
      const existing = await EducationLevel.findOne({ where: { code: 'INICIAL' }, transaction });
      const level = existing
        ? await existing.update({ name: 'Inicial editado', isActive: false }, { transaction })
        : await EducationLevel.create({ code: 'INICIAL', name: 'Inicial editado', isActive: false }, { transaction });

      const [grade, createdGrade] = await Grade.findOrCreate({
        where: { educationLevelId: level.id, order: 3 },
        defaults: { educationLevelId: level.id, order: 3, name: 'Tres editado', isActive: false },
        transaction,
      });
      if (!createdGrade) await grade.update({ name: 'Tres editado', isActive: false }, { transaction });

      const txDb = {
        EducationLevel: {
          findOrCreate: (opts) => EducationLevel.findOrCreate({ ...opts, transaction }),
        },
        Grade: {
          findOrCreate: (opts) => Grade.findOrCreate({ ...opts, transaction }),
        },
      };

      await seedAcademic(txDb);
      const firstLevels = await EducationLevel.findAll({ order: [['code', 'ASC']], raw: true, transaction });
      const firstGrades = await Grade.findAll({ order: [['educationLevelId', 'ASC'], ['order', 'ASC']], raw: true, transaction });
      expect(firstLevels).toHaveLength(3);
      for (const entry of levels) {
        const current = firstLevels.find((item) => item.code === entry.code);
        expect(current).toBeDefined();
        for (const expected of entry.grades) {
          expect(firstGrades.some((item) => item.educationLevelId === current.id && item.order === expected.order)).toBe(true);
        }
      }

      await seedAcademic(txDb);
      expect(await EducationLevel.findAll({ order: [['code', 'ASC']], raw: true, transaction })).toEqual(firstLevels);
      expect(await Grade.findAll({ order: [['educationLevelId', 'ASC'], ['order', 'ASC']], raw: true, transaction })).toEqual(firstGrades);
      expect(await EducationLevel.findByPk(level.id, { raw: true, transaction })).toMatchObject({ name: 'Inicial editado', isActive: false });
      expect(await Grade.findByPk(grade.id, { raw: true, transaction })).toMatchObject({ name: 'Tres editado', isActive: false });
      expect(await User.findAll({ attributes: ['id', 'email', 'role', 'isActive'], order: [['id', 'ASC']], raw: true, transaction })).toEqual(usersBefore);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  } finally {
    expect(await User.findAll({ attributes: ['id', 'email', 'role', 'isActive'], order: [['id', 'ASC']], raw: true })).toEqual(usersBefore);
    await sequelize.close();
  }
});
