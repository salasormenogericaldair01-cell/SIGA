const { PrismaClient } = require('@prisma/client');

async function verifyTarget(prisma, expected = process.env.DEMO_TARGET) {
  if (!['siga', 'siga_test', 'siga_demo_egx3'].includes(expected)) {
    throw new Error('DEMO_TARGET debe ser siga, siga_test o siga_demo_egx3');
  }
  let url;
  try {
    url = new URL(process.env.DATABASE_URL);
  } catch {
    throw new Error('DATABASE_URL no es una URL PostgreSQL válida');
  }
  if (!['postgresql:', 'postgres:'].includes(url.protocol)
    || decodeURIComponent(url.pathname) !== `/${expected}`) {
    throw new Error('DATABASE_URL no coincide con la base DEMO declarada');
  }
  const cloud = expected === 'siga_demo_egx3';
  if (cloud) {
    // El host debe declararse por separado para evitar sembrar otra base por accidente.
    if (!process.env.DEMO_DATABASE_HOST
      || url.hostname !== process.env.DEMO_DATABASE_HOST
      || ['127.0.0.1', 'localhost'].includes(url.hostname)
      || (url.port && url.port !== '5432')) {
      throw new Error('El host o puerto no coincide con la base DEMO de Render declarada');
    }
  } else if (url.hostname !== '127.0.0.1' || url.port !== '5433') {
    throw new Error('DATABASE_URL no coincide con el destino local declarado');
  }
  const [row] = await prisma.$queryRaw`SELECT current_database() AS name, inet_server_port() AS port`;
  if (row.name !== expected || row.port !== (cloud ? 5432 : 5433)) {
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
