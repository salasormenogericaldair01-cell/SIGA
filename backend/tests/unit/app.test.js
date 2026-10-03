const request = require('supertest');
const app = require('../../src/app');

describe('GET /api/health', () => {
  test('devuelve HTTP 200', async () => {
    await request(app).get('/api/health').expect(200);
  });

  test('devuelve status ok y el nombre del servicio', async () => {
    const response = await request(app).get('/api/health');

    expect(response.body).toEqual({
      status: 'ok',
      service: 'sistema-gestion-academica-api',
    });
  });
});

describe('Ruta inexistente', () => {
  test('devuelve HTTP 404', async () => {
    const response = await request(app).get('/api/ruta-inexistente').expect(404);

    expect(response.body).toEqual({ message: 'Ruta no encontrada' });
  });
});

test('CORS acepta solo el origen configurado', async () => {
  const allowed = await request(app).get('/api/health').set('Origin', process.env.CORS_ORIGIN).expect(200);
  const other = await request(app).get('/api/health').set('Origin', 'https://otro-sitio.invalid').expect(200);
  expect(allowed.headers['access-control-allow-origin']).toBe(process.env.CORS_ORIGIN);
  expect(other.headers).not.toHaveProperty('access-control-allow-origin');
});

test('un salto de proxy separa los límites de login por IP reenviada', async () => {
  const env = require('../../src/config/env');
  const previous = env.TRUST_PROXY_HOPS;
  env.TRUST_PROXY_HOPS = 1;
  const proxiedApp = app.createApp();
  env.TRUST_PROXY_HOPS = previous;
  expect(proxiedApp.get('trust proxy')).toBe(1);
  const attempt = (ip) => request(proxiedApp).post('/api/auth/login')
    .set('X-Forwarded-For', ip).send({});
  for (let count = 0; count < 5; count += 1) await attempt('192.0.2.10').expect(400);
  await attempt('192.0.2.10').expect(429);
  await attempt('192.0.2.11').expect(400);
});
