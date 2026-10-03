const express = require('express');
const request = require('supertest');
const errorHandler = require('../../src/middlewares/error.middleware');

describe('Manejo de errores', () => {
  test('devuelve 500 sin exponer detalles internos ni stack traces', async () => {
    const app = express();
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});

    app.get('/error', () => {
      throw new Error('Detalle interno que no debe llegar al cliente');
    });
    app.use(errorHandler);

    try {
      const response = await request(app).get('/error').expect(500);

      expect(response.body).toEqual({ message: 'Error interno del servidor' });
      expect(log).toHaveBeenCalledTimes(1);
    } finally {
      log.mockRestore();
    }
  });

  test('devuelve 400 para JSON inválido sin exponer el cuerpo recibido', async () => {
    const app = require('../../src/app');
    const response = await request(app)
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send('{"dato":')
      .expect(400);

    expect(response.body).toEqual({ message: 'JSON inválido' });
  });

  test('rechaza cuerpos JSON superiores al límite configurado', async () => {
    const app = require('../../src/app');
    const response = await request(app)
      .post('/api/health')
      .send({ dato: 'a'.repeat(101 * 1024) })
      .expect(413);

    expect(response.body).toEqual({ message: 'Cuerpo de solicitud demasiado grande' });
  });
});
