const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { prisma, verifyLocalTestDatabase } = require('./target.cjs');

const output = path.resolve(__dirname, 'results');
const base = 'http://127.0.0.1:3000/api';
const scripts = { smoke: 'smoke.js', base: 'base.js', staged: 'staged.js', steady30: 'steady30.js' };

async function verifyServer() {
  const proof = JSON.parse(fs.readFileSync(path.join(output, 'server-proof.json'), 'utf8'));
  if (proof.database !== 'siga_test' || typeof proof.nonce !== 'string') throw new Error('Comprobante de servidor inválido');
  const response = await fetch('http://127.0.0.1:3000/__performance-target', { signal: AbortSignal.timeout(3000) });
  if (response.status !== 200) throw new Error('La API local no responde con el comprobante esperado');
  const current = await response.json();
  if (current.database !== 'siga_test' || current.nonce !== proof.nonce) throw new Error('El proceso del puerto 3000 no es la API de siga_test preparada');
  const health = await fetch(`${base}/health`, { signal: AbortSignal.timeout(3000) });
  if (health.status !== 200 || (await health.json()).status !== 'ok') throw new Error('Health local no válido');
}

function metrics(summary) {
  const metric = summary.metrics || {};
  const value = (name, key) => metric[name]?.values?.[key] ?? metric[name]?.[key] ?? null;
  return {
    requests: value('http_reqs', 'count'), rps: value('http_reqs', 'rate'),
    p50Ms: value('http_req_duration', 'p(50)'), p95Ms: value('http_req_duration', 'p(95)'),
    p99Ms: value('http_req_duration', 'p(99)'), maxMs: value('http_req_duration', 'max'),
    connectionP95Ms: value('http_req_connecting', 'p(95)'), connectionMaxMs: value('http_req_connecting', 'max'),
    failedRate: value('http_req_failed', 'value') ?? value('http_req_failed', 'rate'),
    checksRate: value('checks', 'value') ?? value('checks', 'rate'),
    serverErrors: value('server_errors', 'count') ?? 0,
  };
}

async function main() {
  const scenario = process.argv[2];
  if (!['smoke', 'base', 'staged', 'steady30', 'recovery', 'report'].includes(scenario)) throw new Error('Indica smoke, base, staged, steady30, recovery o report');
  await verifyLocalTestDatabase();
  await verifyServer();
  const fixture = JSON.parse(fs.readFileSync(path.join(output, 'fixture.json'), 'utf8'));
  const tokens = JSON.parse(fs.readFileSync(path.join(output, 'tokens.json'), 'utf8'));
  if (!/^PERF-[0-9A-F]{12}$/.test(fixture.prefix) || !/^[0-9a-f-]{36}$/i.test(fixture.assignmentId)
      || ['ADMIN', 'DOCENTE', 'ESTUDIANTE'].some((role) => typeof tokens[role] !== 'string' || !tokens[role])) {
    throw new Error('Datos temporales o tokens locales incompletos');
  }
  const me = await fetch(`${base}/auth/me`, { headers: { Authorization: `Bearer ${tokens.ADMIN}` }, signal: AbortSignal.timeout(3000) });
  if (me.status !== 200) throw new Error('Consulta autenticada local falló');
  if (scenario === 'recovery') {
    const teacherMe = await fetch(`${base}/auth/me`, { headers: { Authorization: `Bearer ${tokens.DOCENTE}` }, signal: AbortSignal.timeout(3000) });
    const result = { health: 200, adminMe: me.status, teacherMe: teacherMe.status, at: new Date().toISOString() };
    fs.writeFileSync(path.join(output, 'recovery.json'), JSON.stringify(result, null, 2));
    if (teacherMe.status !== 200) throw new Error('Consulta docente no se recuperó');
    console.log('Recuperación: health, ADMIN /auth/me y DOCENTE /auth/me respondieron 200.');
    return;
  }
  if (scenario === 'report') {
    const name = process.argv[3];
    if (!Object.hasOwn(scripts, name)) throw new Error('Escenario de reporte inválido');
    const summary = JSON.parse(fs.readFileSync(path.join(output, `${name}-summary.json`), 'utf8'));
    const result = { scenario: name, at: new Date().toISOString(), exitCode: 0, ...metrics(summary) };
    fs.writeFileSync(path.join(output, `${name}-metrics.json`), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
    return;
  }
  const k6 = process.env.K6_BIN || (process.platform === 'win32' ? 'C:\\Program Files\\k6\\k6.exe' : 'k6');
  const summaryFile = path.join(output, `${scenario}-summary.json`);
  const logFile = path.join(output, `${scenario}.log`);
  const log = fs.openSync(logFile, 'w', 0o600);
  let run;
  try {
    run = spawnSync(k6, ['run', `--summary-export=${summaryFile}`, path.join(__dirname, scripts[scenario])], {
      cwd: path.resolve(__dirname, '../..'), stdio: ['ignore', log, log],
      env: { ...process.env, K6_BASE_URL: base, K6_ADMIN_TOKEN: tokens.ADMIN,
        K6_TEACHER_TOKEN: tokens.DOCENTE, K6_STUDENT_TOKEN: tokens.ESTUDIANTE,
        K6_ASSIGNMENT_ID: fixture.assignmentId, K6_NO_COLOR: 'true' },
      timeout: scenario === 'staged' ? 300000 : 120000,
    });
  } finally { fs.closeSync(log); }
  if (run.error) throw new Error(`k6 no pudo completarse: ${run.error.code || run.error.name}`);
  if (!fs.existsSync(summaryFile)) throw new Error(`k6 terminó sin resumen en ${scenario}; revisa el log local`);
  const result = { scenario, at: new Date().toISOString(), exitCode: run.status, ...metrics(JSON.parse(fs.readFileSync(summaryFile, 'utf8'))) };
  fs.writeFileSync(path.join(output, `${scenario}-metrics.json`), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
  if (run.status !== 0 || result.serverErrors > 0 || result.failedRate === null || result.failedRate >= 0.01
      || result.p95Ms === null || result.p95Ms >= 1000 || result.checksRate === null || result.checksRate <= 0.99) {
    throw new Error(`${scenario} incumplió un umbral; detén el aumento de carga`);
  }
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
