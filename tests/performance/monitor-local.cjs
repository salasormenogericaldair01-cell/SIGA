const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { prisma, verifyLocalTestDatabase } = require('./target.cjs');

const output = path.resolve(__dirname, 'results');
const proofFile = path.join(output, 'server-proof.json');
const resultsFile = path.join(output, 'steady30-observability.json');

function processStats(pid) {
  const command = `$api = Get-Process -Id ${pid} -ErrorAction SilentlyContinue; $pg = @(Get-Process -Name postgres -ErrorAction SilentlyContinue); $pgWithCpu = @($pg | Where-Object { $null -ne $_.CPU }); $pgCpu = if ($pgWithCpu.Count -gt 0) { ($pgWithCpu | Measure-Object CPU -Sum).Sum } else { $null }; [pscustomobject]@{apiCpu=$api.CPU; apiRss=$api.WorkingSet64; pgCpu=$pgCpu; pgRss=(($pg | Measure-Object WorkingSet64 -Sum).Sum); pgProcesses=$pg.Count} | ConvertTo-Json -Compress`;
  const result = spawnSync('powershell.exe', ['-NoProfile', '-Command', command], { encoding: 'utf8', timeout: 5000 });
  if (result.status !== 0) return null;
  try { return JSON.parse(result.stdout); } catch { return null; }
}

function range(values) {
  const usable = values.filter((value) => typeof value === 'number' && Number.isFinite(value));
  return usable.length ? { min: Math.min(...usable), max: Math.max(...usable) } : null;
}

async function main() {
  await verifyLocalTestDatabase();
  const proof = JSON.parse(fs.readFileSync(proofFile, 'utf8'));
  if (proof.database !== 'siga_test' || !Number.isInteger(proof.pid)) throw new Error('Comprobante local inválido');
  const response = await fetch('http://127.0.0.1:3000/__performance-target', { signal: AbortSignal.timeout(3000) });
  const target = response.status === 200 ? await response.json() : null;
  if (target?.nonce !== proof.nonce || target.database !== 'siga_test') throw new Error('API local distinta de la preparada');

  const samples = [];
  const start = Date.now();
  while (Date.now() - start < 120000) {
    const process = processStats(proof.pid);
    const [database] = await prisma.$queryRaw`
      SELECT current_database() AS name, inet_server_port() AS port,
        current_setting('max_connections')::int AS maximum,
        (SELECT count(*)::int FROM pg_stat_activity WHERE datname = current_database()) AS connections,
        (SELECT count(*)::int FROM pg_stat_activity WHERE datname = current_database() AND state = 'active') AS active
    `;
    if (database.name !== 'siga_test' || database.port !== 5433) throw new Error('Destino PostgreSQL cambió');
    samples.push({ at: new Date().toISOString(), elapsedSeconds: (Date.now() - start) / 1000,
      apiCpuSeconds: process?.apiCpu ?? null, apiRssBytes: process?.apiRss ?? null,
      pgCpuSeconds: process?.pgCpu ?? null, pgRssBytes: process?.pgRss ?? null,
      pgProcesses: process?.pgProcesses ?? null, connections: database.connections,
      activeConnections: database.active, maxConnections: database.maximum });
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  const cpuRate = (key) => samples.slice(1).map((sample, index) => {
    const previous = samples[index];
    if (typeof sample[key] !== 'number' || typeof previous[key] !== 'number') return null;
    const elapsed = (new Date(sample.at) - new Date(previous.at)) / 1000;
    return elapsed > 0 ? 100 * (sample[key] - previous[key]) / elapsed : null;
  });
  const summary = {
    sampleCount: samples.length, startedAt: samples[0]?.at, endedAt: samples.at(-1)?.at,
    apiCpuPercentOfOneCore: range(cpuRate('apiCpuSeconds')),
    apiRssBytes: range(samples.map((sample) => sample.apiRssBytes)),
    pgCpuPercentOfOneCore: range(cpuRate('pgCpuSeconds')),
    pgAggregateRssBytes: range(samples.map((sample) => sample.pgRssBytes)),
    pgProcessCount: range(samples.map((sample) => sample.pgProcesses)),
    connections: range(samples.map((sample) => sample.connections)),
    activeConnections: range(samples.map((sample) => sample.activeConnections)),
    maxConnections: samples.at(-1)?.maxConnections,
    finalConnections: samples.at(-1)?.connections,
    finalActiveConnections: samples.at(-1)?.activeConnections,
  };
  fs.writeFileSync(resultsFile, JSON.stringify({ summary, samples }, null, 2));
  console.log(JSON.stringify(summary));
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
