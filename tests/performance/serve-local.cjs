const { backendRequire, prisma, verifyLocalTestDatabase } = require('./target.cjs');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const proofFile = path.resolve(__dirname, 'results/server-proof.json');

async function main() {
  if (process.env.PORT !== '3000') throw new Error('La API de carga solo admite PORT=3000');
  await verifyLocalTestDatabase();
  if (fs.existsSync(proofFile)) throw new Error('Existe un comprobante de servidor previo; revísalo antes de arrancar');
  const app = backendRequire('./src/app');
  const nonce = randomUUID();
  const server = http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/__performance-target') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ database: 'siga_test', nonce }));
      return;
    }
    app(req, res);
  });
  server.listen(3000, '127.0.0.1', () => {
    fs.mkdirSync(path.dirname(proofFile), { recursive: true });
    fs.writeFileSync(proofFile, JSON.stringify({ database: 'siga_test', nonce, pid: process.pid }), { flag: 'wx', mode: 0o600 });
    console.log('API de rendimiento local lista en 127.0.0.1:3000 con siga_test');
  });
  server.on('error', (error) => { console.error(`No se pudo abrir la API local: ${error.code || 'error'}`); process.exitCode = 1; });
  process.on('SIGINT', () => server.close(async () => {
    if (fs.existsSync(proofFile)) fs.unlinkSync(proofFile);
    await prisma.$disconnect();
  }));
}

main().catch(async (error) => { console.error(error.message); process.exitCode = 1; await prisma.$disconnect(); });
