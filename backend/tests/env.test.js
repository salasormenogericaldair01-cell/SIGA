const { spawnSync } = require('node:child_process');
const path = require('node:path');

test.each([
  ['JWT_SECRET', { JWT_SECRET: 'demasiado-corto' }],
  ['JWT_EXPIRES_IN', { JWT_EXPIRES_IN: 'nunca' }],
  ['BCRYPT_ROUNDS', { BCRYPT_ROUNDS: '9' }],
  ['CORS_ORIGIN', { CORS_ORIGIN: '*' }],
  ['DATABASE_URL', { DATABASE_URL: 'sqlite://localhost/siga' }],
])('rechaza configuración inválida de %s sin revelar valores', (field, overrides) => {
  const result = spawnSync(process.execPath, ['-e', "require('./src/config/env')"], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, ...overrides },
    encoding: 'utf8',
  });

  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain(field);
  for (const value of Object.values(overrides)) {
    if (value.length > 3) expect(result.stderr).not.toContain(value);
  }
});
