const prisma = require('../src/config/prisma');

const levels = [
  { code: 'INICIAL', name: 'Inicial', grades: [3, 4, 5].map((order) => ({ order, name: `${order} años` })) },
  { code: 'PRIMARIA', name: 'Primaria', grades: [1, 2, 3, 4, 5, 6].map((order) => ({ order, name: `${order}.º` })) },
  { code: 'SECUNDARIA', name: 'Secundaria', grades: [1, 2, 3, 4, 5].map((order) => ({ order, name: `${order}.º` })) },
];

async function seedAcademic(db) {
  for (const entry of levels) {
    const level = await db.educationLevel.upsert({
      where: { code: entry.code },
      create: { code: entry.code, name: entry.name },
      update: {},
    });
    for (const grade of entry.grades) {
      await db.grade.upsert({
        where: { educationLevelId_order: { educationLevelId: level.id, order: grade.order } },
        create: { educationLevelId: level.id, ...grade },
        update: {},
      });
    }
  }
}

if (require.main === module) {
  (async () => {
    const url = new URL(process.env.DATABASE_URL);
    const target = await prisma.$queryRaw`SELECT current_database() AS name, inet_server_addr()::text AS host, inet_server_port() AS port`;
    if (target[0].name !== 'siga' || target[0].port !== 5433 || !['127.0.0.1', 'localhost'].includes(url.hostname) || url.pathname !== '/siga') {
      throw new Error('El seed manual requiere siga en localhost:5433');
    }
    await seedAcademic(prisma);
    console.log('Datos académicos iniciales verificados');
  })().catch((error) => {
    console.error(error.code || error.message);
    process.exitCode = 1;
  }).finally(() => prisma.$disconnect());
}

module.exports = { seedAcademic, levels };
