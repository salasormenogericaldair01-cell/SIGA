const fs = require('node:fs');
const path = require('node:path');
const { backendRequire, models, sequelize, verifyLocalTestDatabase } = require('./target.cjs');

const { Op } = backendRequire('sequelize');
const { User, Student, AcademicPeriod, Course } = models;

async function main() {
  await verifyLocalTestDatabase();
  const [rows] = await sequelize.query(`
    SELECT current_database() AS database, inet_server_port() AS port,
      current_setting('max_connections')::int AS max_connections,
      (SELECT count(*)::int FROM pg_stat_activity WHERE datname = current_database()) AS current_connections
  `);
  const [row] = rows;
  const temporaryRecords = {
    users: await User.count({ where: { email: { [Op.startsWith]: 'perf-' } } }),
    students: await Student.count({ where: { studentCode: { [Op.startsWith]: 'PERF-' } } }),
    periods: await AcademicPeriod.count({ where: { name: { [Op.startsWith]: 'PERF-' } } }),
    courses: await Course.count({ where: { code: { [Op.startsWith]: 'PERF-' } } }),
  };
  const result = { database: row.database, port: row.port, maxConnections: row.max_connections, currentConnections: row.current_connections, temporaryRecords, checkedAt: new Date().toISOString() };
  const output = path.resolve(__dirname, 'results');
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, 'database-after.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
}

main().catch((error) => { console.error(error.code || error.name); process.exitCode = 1; })
  .finally(() => sequelize.close());
