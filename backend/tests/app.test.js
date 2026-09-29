const request = require('supertest');
const app = require('../src/app');

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
