const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const DATABASE = 'siga_demo_egx3';
class ControlledError extends Error {}
const FORBIDDEN = /demo|prueba|test|referencial|borrador|beta/i;
const ROLES = Object.freeze({
  ADMIN: ['Administrador', 'general', 'ADMIN'],
  SECRETARIA: ['Secretaría', 'académica', 'SECRETARIA'],
  DOCENTE_A: ['Docente', 'de Matemática', 'DOCENTE'],
  DOCENTE_B: ['Docente', 'de Comunicación', 'DOCENTE'],
  ESTUDIANTE_A: ['Estudiante', '01', 'ESTUDIANTE'],
  ESTUDIANTE_B: ['Estudiante', '02', 'ESTUDIANTE'],
});

function targetFromEnvironment(env) {
  if (env.BETA_TARGET !== DATABASE || !env.BETA_DATABASE_HOST) throw new ControlledError('Destino beta no declarado exactamente');
  let url;
  try { url = new URL(env.DATABASE_URL); } catch { throw new ControlledError('URL PostgreSQL inválida'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)
    || !url.username || !url.password
    || decodeURIComponent(url.pathname) !== `/${DATABASE}`
    || url.port !== '5432'
    || url.hostname !== env.BETA_DATABASE_HOST
    || ['localhost', '127.0.0.1', '::1'].includes(url.hostname.toLowerCase())
    || url.searchParams.get('sslmode') !== 'require') {
    throw new ControlledError('Host, puerto, base o TLS no coinciden con el destino beta declarado');
  }
  return { hostname: url.hostname, username: decodeURIComponent(url.username), password: decodeURIComponent(url.password), database: DATABASE };
}

async function verifyDatabase(prisma, env) {
  const target = targetFromEnvironment(env);
  const [row] = await prisma.$queryRaw`SELECT current_database() AS name, inet_server_port() AS port`;
  if (row?.name !== DATABASE || row?.port !== 5432) throw new ControlledError('El servidor PostgreSQL no coincide con el destino beta');
  return target;
}

function outsideRepository(file) {
  if (!file || !path.isAbsolute(file)) throw new ControlledError('Indica una ruta absoluta de respaldo fuera del repositorio');
  const worktree = fs.realpathSync(path.resolve(__dirname, '../..')).toLowerCase();
  const repository = path.basename(path.dirname(worktree)).toLowerCase() === '.worktrees'
    ? fs.realpathSync(path.resolve(worktree, '../..')).toLowerCase()
    : worktree;
  const parent = path.dirname(path.resolve(file));
  if (!fs.existsSync(parent)) throw new ControlledError('El directorio externo no existe');
  const resolved = path.join(fs.realpathSync(parent), path.basename(file)).toLowerCase();
  if (resolved === repository || resolved.startsWith(`${repository}${path.sep}`)) throw new ControlledError('El respaldo debe estar fuera de Git');
  return path.resolve(file);
}

function archiveReadable(file, executable = process.env.PG_RESTORE || 'pg_restore') {
  const result = spawnSync(executable, ['--list', file], { encoding: 'utf8', windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
  if (result.status !== 0 || !result.stdout?.trim()) throw new ControlledError('El respaldo no es legible por pg_restore');
}

function digest(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }
function hostDigest(host) { return crypto.createHash('sha256').update(host).digest('hex'); }

function backupReceipt(file, hostname) {
  const archive = outsideRepository(file);
  if (!fs.existsSync(archive) || fs.statSync(archive).size === 0) throw new ControlledError('Falta el respaldo');
  archiveReadable(archive);
  const receipt = JSON.parse(fs.readFileSync(`${archive}.receipt.json`, 'utf8'));
  if (receipt.database !== DATABASE || receipt.hostSha256 !== hostDigest(hostname)
    || receipt.archiveSha256 !== digest(archive)) throw new ControlledError('El respaldo no corresponde al destino o cambió');
  return receipt;
}

function assertCleanLabels(values) {
  if (values.some((value) => typeof value !== 'string' || FORBIDDEN.test(value))) {
    throw new ControlledError('Un dato visible contiene una etiqueta no permitida');
  }
}

function requireConfirmation(env, stage) {
  if (env.BETA_TRANSITION_CONFIRM !== `siga_demo_egx3:${stage}`) {
    throw new ControlledError(`Falta la confirmación explícita para ${stage}`);
  }
}

function checkAccessProof(proof, expectedEmailHashes, adminId, now = Date.now()) {
  const proofTime = Date.parse(proof.verifiedAt);
  if (proof.database !== DATABASE || !proof.roles || !Number.isFinite(proofTime)
    || now - proofTime > 24 * 60 * 60 * 1000
    || proofTime > now) throw new ControlledError('Comprobación API ausente o vencida');
  for (const [key, hash] of Object.entries(expectedEmailHashes)) {
    const entry = proof.roles[key];
    if (!entry || entry.emailSha256 !== hash || entry.role !== ROLES[key][2]) {
      throw new ControlledError('No están comprobados todos los roles por API');
    }
    const verifiedTime = Date.parse(entry.verifiedAt);
    if (!Number.isFinite(verifiedTime) || now - verifiedTime > 24 * 60 * 60 * 1000
      || verifiedTime > now) throw new ControlledError('Una comprobación API venció');
  }
  if (proof.roles.ADMIN.id !== adminId) throw new ControlledError('El ADMIN comprobado no coincide');
}

function emailDigest(email) { return crypto.createHash('sha256').update(email).digest('hex'); }

module.exports = {
  DATABASE, ControlledError, FORBIDDEN, ROLES, targetFromEnvironment, verifyDatabase,
  outsideRepository, archiveReadable, digest, hostDigest, backupReceipt,
  assertCleanLabels, requireConfirmation, checkAccessProof, emailDigest,
};
