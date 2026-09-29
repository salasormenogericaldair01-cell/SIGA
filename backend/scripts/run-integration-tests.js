const path = require('node:path');
const { spawnSync } = require('node:child_process');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env'), quiet: true });

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) {
  console.error('Falta TEST_DATABASE_URL: usa una base de pruebas separada llamada siga_test.');
  process.exit(1);
}

let databaseName;
let hostAndPortValid = false;
try {
  const url = new URL(testUrl);
  databaseName = decodeURIComponent(url.pathname.slice(1));
  hostAndPortValid = ['127.0.0.1', 'localhost'].includes(url.hostname) && url.port === '5433';
  if (!['postgresql:', 'postgres:'].includes(url.protocol)) throw new Error('Protocolo inválido');
} catch {
  console.error('TEST_DATABASE_URL no es una URL PostgreSQL válida.');
  process.exit(1);
}

if (databaseName !== 'siga_test' || !hostAndPortValid || testUrl === process.env.DATABASE_URL) {
  console.error('TEST_DATABASE_URL debe apuntar exclusivamente a siga_test en localhost:5433, distinta de desarrollo.');
  process.exit(1);
}

const result = spawnSync(process.execPath, [
  require.resolve('jest/bin/jest'),
  '--runInBand',
  '--testRegex=\\.integration\\.js$',
], {
  stdio: 'inherit',
  cwd: path.join(__dirname, '..'),
  env: { ...process.env, NODE_ENV: 'test', DATABASE_URL: testUrl },
});

process.exit(result.status === null ? 1 : result.status);
