const fs = require('node:fs');
const path = require('node:path');
const { prisma, verifyLocalTestDatabase } = require('./target.cjs');

async function main() {
  await verifyLocalTestDatabase();
  const [row] = await prisma.$queryRaw`
    SELECT current_database() AS database, inet_server_port() AS port,
      current_setting('max_connections')::int AS max_connections,
      (SELECT count(*)::int FROM pg_stat_activity WHERE datname = current_database()) AS current_connections
  `;
  const temporaryRecords = {
    users: await prisma.user.count({ where: { email: { startsWith: 'perf-' } } }),
    students: await prisma.student.count({ where: { studentCode: { startsWith: 'PERF-' } } }),
    periods: await prisma.academicPeriod.count({ where: { name: { startsWith: 'PERF-' } } }),
    courses: await prisma.course.count({ where: { code: { startsWith: 'PERF-' } } }),
  };
  const result = { database: row.database, port: row.port, maxConnections: row.max_connections, currentConnections: row.current_connections, temporaryRecords, checkedAt: new Date().toISOString() };
  const output = path.resolve(__dirname, 'results');
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, 'database-after.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
}

main().catch((error) => { console.error(error.code || error.name); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
