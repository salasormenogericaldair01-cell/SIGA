const path = require('node:path');
const { createRequire } = require('node:module');

const backendRequire = createRequire(path.resolve(__dirname, '../../backend/package.json'));
const prisma = backendRequire('./src/config/prisma');
const verifyTarget = backendRequire('./scripts/operations/verify-database-target');

async function verifyLocalTestDatabase() {
  if (process.env.NODE_ENV !== 'test') throw new Error('NODE_ENV debe ser test');
  const target = await verifyTarget(prisma, 'siga_test');
  if (target.name !== 'siga_test' || target.port !== 5433) throw new Error('Destino PostgreSQL inesperado');
  return target;
}

module.exports = { backendRequire, prisma, verifyLocalTestDatabase };
