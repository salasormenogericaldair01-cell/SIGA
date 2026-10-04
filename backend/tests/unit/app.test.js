const request = require('supertest');
const app = require('../../src/app');

describe('GET /api/health', () => {
  test('devuelve HTTP 200', async () => {
    await request(app).get('/api/health').expect(200);
  });

  test('devuelve status ok y el nombre del servicio', async () => {
    const response = await request(app).get('/api/health');

    expect(response.body).toMatchObject({
      status: 'ok',
      service: 'sistema-gestion-academica-api',
    });
    expect(response.body.version).toMatch(/^(unknown|[0-9a-f]{8})$/);
  });

  test('solo publica un SHA corto válido, sin información interna', async () => {
    const previous = process.env.BUILD_SHA;
    const previousRender = process.env.RENDER_GIT_COMMIT;
    try {
      delete process.env.BUILD_SHA;
      delete process.env.RENDER_GIT_COMMIT;
      expect((await request(app).get('/api/health').expect(200)).body.version).toBe('unknown');
      process.env.BUILD_SHA = 'abcdef1234567890';
      expect((await request(app).get('/api/health').expect(200)).body).toEqual({
        status: 'ok', service: 'sistema-gestion-academica-api', version: 'abcdef12',
      });
      process.env.BUILD_SHA = 'host=internal;secret=value';
      expect((await request(app).get('/api/health').expect(200)).body.version).toBe('unknown');
      process.env.RENDER_GIT_COMMIT = '1234567abcdef';
      expect((await request(app).get('/api/health').expect(200)).body.version).toBe('1234567a');
    } finally {
      if (previous === undefined) delete process.env.BUILD_SHA;
      else process.env.BUILD_SHA = previous;
      if (previousRender === undefined) delete process.env.RENDER_GIT_COMMIT;
      else process.env.RENDER_GIT_COMMIT = previousRender;
    }
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
  const other = await request(app).get('/api/health').set('Origin', 'https://otro-sitio.invalid').expect(403);
  expect(allowed.headers['access-control-allow-origin']).toBe(process.env.CORS_ORIGIN);
  expect(other.headers).not.toHaveProperty('access-control-allow-origin');
  expect(other.body).toEqual({ message: 'Origen no permitido' });
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
