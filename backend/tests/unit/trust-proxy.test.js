const express = require('express');
const request = require('supertest');
const app = require('../../src/app');
const env = require('../../src/config/env');

function appWithHops(hops) {
  const previous = env.TRUST_PROXY_HOPS;
  try {
    env.TRUST_PROXY_HOPS = hops;
    return app.createApp();
  } finally {
    env.TRUST_PROXY_HOPS = previous;
  }
}

function ipProbe(hops) {
  const probe = express();
  probe.set('trust proxy', hops);
  probe.get('/ip', (req, res) => res.json({ ip: req.ip }));
  return probe;
}

const loginAttempt = (target, forwardedFor) => request(target)
  .post('/api/auth/login')
  .set('X-Forwarded-For', forwardedFor)
  .send({});

test('sin proxy se ignora X-Forwarded-For y el límite agrupa por conexión', async () => {
  const probe = ipProbe(0);
  const first = await request(probe).get('/ip').set('X-Forwarded-For', '192.0.2.10').expect(200);
  const second = await request(probe).get('/ip').set('X-Forwarded-For', '203.0.113.20').expect(200);
  expect(first.body.ip).toBe(second.body.ip);
  expect(first.body.ip).not.toBe('192.0.2.10');
  expect(first.body.ip).not.toBe('203.0.113.20');

  const target = appWithHops(0);
  expect(target.get('trust proxy')).toBe(0);
  for (let count = 0; count < 5; count += 1) {
    await loginAttempt(target, count % 2 ? '192.0.2.10' : '203.0.113.20').expect(400);
  }
  await loginAttempt(target, '198.51.100.30').expect(429);
});

test('un salto toma la dirección añadida por el proxy inmediato, no valores anteriores', async () => {
  const probe = ipProbe(1);
  const first = await request(probe).get('/ip')
    .set('X-Forwarded-For', '192.0.2.10, 198.51.100.25').expect(200);
  const changedClientValue = await request(probe).get('/ip')
    .set('X-Forwarded-For', '203.0.113.20, 198.51.100.25').expect(200);
  expect(first.body.ip).toBe('198.51.100.25');
  expect(changedClientValue.body.ip).toBe(first.body.ip);

  const target = appWithHops(1);
  expect(target.get('trust proxy')).toBe(1);
  for (let count = 0; count < 5; count += 1) {
    await loginAttempt(target, `${count % 2 ? '192.0.2.10' : '203.0.113.20'}, 198.51.100.25`).expect(400);
  }
  await loginAttempt(target, '192.0.2.11, 198.51.100.25').expect(429);
  await loginAttempt(target, '192.0.2.10, 198.51.100.26').expect(400);
});
