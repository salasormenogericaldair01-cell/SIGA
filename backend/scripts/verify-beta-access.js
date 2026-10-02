const fs = require('node:fs');
const { credentials } = require('./beta-data-transition');
const { DATABASE, ControlledError, ROLES, targetFromEnvironment, outsideRepository, backupReceipt, emailDigest } = require('./beta-transition-core');

const API = 'https://siga-lud0.onrender.com/api';

async function verifyOne(key, account) {
  const login = await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: account.email, password: account.password }),
  });
  if (!login.ok) throw new ControlledError(`No se comprobó login para ${key}; HTTP ${login.status}`);
  const response = await login.json();
  if (Object.hasOwn(response, 'password') || Object.hasOwn(response, 'passwordHash')
    || Object.hasOwn(response.user || {}, 'password') || Object.hasOwn(response.user || {}, 'passwordHash')) {
    throw new ControlledError(`La respuesta de login incluye datos sensibles para ${key}`);
  }
  if (typeof response.token !== 'string' || response.user?.email !== account.email || response.user?.role !== ROLES[key][2]) {
    throw new ControlledError(`La respuesta de login no coincide para ${key}`);
  }
  const me = await fetch(`${API}/auth/me`, { headers: { authorization: `Bearer ${response.token}` } });
  if (!me.ok) throw new ControlledError(`No se comprobó /auth/me para ${key}; HTTP ${me.status}`);
  const body = await me.json();
  if (Object.hasOwn(body, 'password') || Object.hasOwn(body, 'passwordHash') || Object.hasOwn(body, 'token')
    || Object.hasOwn(body.user || {}, 'password') || Object.hasOwn(body.user || {}, 'passwordHash')) {
    throw new ControlledError(`La respuesta de /auth/me incluye datos sensibles para ${key}`);
  }
  if (body.user?.id !== response.user.id || body.user?.email !== account.email || body.user?.role !== ROLES[key][2]) {
    throw new ControlledError(`La sesión no coincide para ${key}`);
  }
  return { id: body.user.id, role: body.user.role, emailSha256: emailDigest(account.email), verifiedAt: new Date().toISOString(), loginHttp: login.status, meHttp: me.status };
}

async function main() {
  const mode = process.argv[2];
  if (!['admin', 'other-roles'].includes(mode)) throw new ControlledError('Indica admin u other-roles');
  const target = targetFromEnvironment(process.env);
  const backup = backupReceipt(process.env.BETA_BACKUP_FILE, target.hostname);
  const accounts = credentials(process.env);
  const file = outsideRepository(process.env.BETA_ACCESS_PROOF_FILE);
  if (mode === 'admin') {
    const admin = await verifyOne('ADMIN', accounts.ADMIN);
    fs.writeFileSync(file, JSON.stringify({ database: DATABASE, archiveSha256: backup.archiveSha256, verifiedAt: new Date().toISOString(), roles: { ADMIN: admin } }), { mode: 0o600 });
    console.log('Login y /auth/me del nuevo ADMIN comprobados; el ADMIN anterior sigue intacto.');
    return;
  }
  const proof = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (proof.database !== DATABASE || proof.archiveSha256 !== backup.archiveSha256
    || proof.roles?.ADMIN?.emailSha256 !== emailDigest(accounts.ADMIN.email)) {
    throw new ControlledError('Verifica primero el nuevo ADMIN');
  }
  for (const key of ['SECRETARIA', 'DOCENTE_A', 'DOCENTE_B', 'ESTUDIANTE_A', 'ESTUDIANTE_B']) {
    proof.roles[key] = await verifyOne(key, accounts[key]);
  }
  proof.verifiedAt = new Date().toISOString();
  fs.writeFileSync(file, JSON.stringify(proof), { mode: 0o600 });
  console.log('Login y /auth/me de los otros cinco roles comprobados.');
}

if (require.main === module) main().catch((error) => {
  console.error(error instanceof ControlledError ? error.message : 'No se pudo comprobar el acceso; revisa API y red.');
  process.exitCode = 1;
});
