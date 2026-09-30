const { PrismaClient } = require('@prisma/client');

async function verifyTarget(prisma, expected = process.env.DEMO_TARGET) {
  if (!['siga', 'siga_test'].includes(expected)) {
    throw new Error('DEMO_TARGET debe ser siga o siga_test');
  }
  const url = new URL(process.env.DATABASE_URL);
  if (!['postgresql:', 'postgres:'].includes(url.protocol)
    || url.hostname !== '127.0.0.1' || url.port !== '5433'
    || decodeURIComponent(url.pathname) !== `/${expected}`) {
    throw new Error('DATABASE_URL no coincide con el destino local declarado');
  }
  const [row] = await prisma.$queryRaw`SELECT current_database() AS name, inet_server_port() AS port`;
  if (row.name !== expected || row.port !== 5433) {
    throw new Error('La conexión PostgreSQL no coincide con el destino declarado');
  }
  return { name: row.name, port: row.port };
}

if (require.main === module) {
  const prisma = new PrismaClient();
  verifyTarget(prisma)
    .then(({ name, port }) => console.log(`Destino verificado: ${name} en puerto ${port}`))
    .catch((error) => { console.error(error.message); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
}

module.exports = verifyTarget;
