const prisma = require('../../src/config/prisma');
const { seedAcademic, levels } = require('../../scripts/seed-academic');

test('seed académico en siga_test: dos ejecuciones conservan cambios, usuarios y no duplican', async () => {
  const url = new URL(process.env.DATABASE_URL);
  const target = await prisma.$queryRaw`SELECT current_database() AS name, inet_server_port() AS port`;
  if (target[0].name !== 'siga_test' || target[0].port !== 5433 ||
      !['127.0.0.1', 'localhost'].includes(url.hostname) || url.pathname !== '/siga_test') {
    throw new Error('La prueba del seed requiere siga_test en localhost:5433');
  }

  const usersBefore = await prisma.user.findMany({ select: { id: true, email: true, role: true, isActive: true }, orderBy: { id: 'asc' } });
  const rollback = new Error('rollback de datos temporales del seed');
  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.educationLevel.findUnique({ where: { code: 'INICIAL' } });
      const level = existing
        ? await tx.educationLevel.update({ where: { id: existing.id }, data: { name: 'Inicial editado', isActive: false } })
        : await tx.educationLevel.create({ data: { code: 'INICIAL', name: 'Inicial editado', isActive: false } });
      const grade = await tx.grade.upsert({
        where: { educationLevelId_order: { educationLevelId: level.id, order: 3 } },
        create: { educationLevelId: level.id, order: 3, name: 'Tres editado', isActive: false },
        update: { name: 'Tres editado', isActive: false },
      });

      await seedAcademic(tx);
      const firstLevels = await tx.educationLevel.findMany({ orderBy: { code: 'asc' } });
      const firstGrades = await tx.grade.findMany({ orderBy: [{ educationLevelId: 'asc' }, { order: 'asc' }] });
      expect(firstLevels).toHaveLength(3);
      for (const entry of levels) {
        const current = firstLevels.find((item) => item.code === entry.code);
        expect(current).toBeDefined();
        for (const expected of entry.grades) {
          expect(firstGrades.some((item) => item.educationLevelId === current.id && item.order === expected.order)).toBe(true);
        }
      }

      await seedAcademic(tx);
      expect(await tx.educationLevel.findMany({ orderBy: { code: 'asc' } })).toEqual(firstLevels);
      expect(await tx.grade.findMany({ orderBy: [{ educationLevelId: 'asc' }, { order: 'asc' }] })).toEqual(firstGrades);
      expect(await tx.educationLevel.findUnique({ where: { id: level.id } })).toMatchObject({ name: 'Inicial editado', isActive: false });
      expect(await tx.grade.findUnique({ where: { id: grade.id } })).toMatchObject({ name: 'Tres editado', isActive: false });
      expect(await tx.user.findMany({ select: { id: true, email: true, role: true, isActive: true }, orderBy: { id: 'asc' } })).toEqual(usersBefore);
      throw rollback;
    }, { timeout: 20000 });
  } catch (error) {
    if (error !== rollback) throw error;
  } finally {
    expect(await prisma.user.findMany({ select: { id: true, email: true, role: true, isActive: true }, orderBy: { id: 'asc' } })).toEqual(usersBefore);
    await prisma.$disconnect();
  }
});
