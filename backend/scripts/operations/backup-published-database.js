const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const { PrismaClient } = require('@prisma/client');
const {
  DATABASE, ControlledError, verifyDatabase, outsideRepository, archiveReadable, digest, hostDigest,
} = require('./data-transition-core');

async function main() {
  const prisma = new PrismaClient();
  let target;
  try { target = await verifyDatabase(prisma, process.env); }
  finally { await prisma.$disconnect(); }
  const file = outsideRepository(process.env.BETA_BACKUP_FILE);
  if (fs.existsSync(file) || fs.existsSync(`${file}.receipt.json`)) throw new ControlledError('La ruta de respaldo ya existe');
  if (!fs.existsSync(require('node:path').dirname(file))) throw new ControlledError('Crea primero el directorio externo para el respaldo');

  const result = spawnSync(process.env.PG_DUMP || 'pg_dump', [
    '--format=custom', '--no-password', '--host', target.hostname,
    '--port', '5432', '--username', target.username, '--dbname', DATABASE,
    '--file', file,
  ], {
    windowsHide: true,
    stdio: 'ignore',
    env: { ...process.env, PGPASSWORD: target.password, PGSSLMODE: 'require' },
  });
  try {
    if (result.status !== 0 || result.error) throw new ControlledError('pg_dump no pudo generar el respaldo');
    archiveReadable(file);
    const receipt = {
      database: DATABASE,
      hostSha256: hostDigest(target.hostname),
      archiveSha256: digest(file),
      createdAt: new Date().toISOString(),
    };
    fs.writeFileSync(`${file}.receipt.json`, JSON.stringify(receipt, null, 2), { flag: 'wx', mode: 0o600 });
    console.log('Respaldo creado y legible; comprobante guardado junto al archivo fuera de Git.');
  } catch (error) {
    if (fs.existsSync(file)) fs.unlinkSync(file);
    if (fs.existsSync(`${file}.receipt.json`)) fs.unlinkSync(`${file}.receipt.json`);
    throw error;
  }
}

if (require.main === module) main().catch((error) => {
  console.error(error instanceof ControlledError ? error.message : 'No se pudo generar o comprobar el respaldo.');
  process.exitCode = 1;
});
