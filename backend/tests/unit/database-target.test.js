const verifyTarget = require('../../scripts/operations/verify-database-target');

const original = {
  DATABASE_URL: process.env.DATABASE_URL,
  DEMO_TARGET: process.env.DEMO_TARGET,
  DEMO_DATABASE_HOST: process.env.DEMO_DATABASE_HOST,
};
afterEach(() => {
  for (const [key, value] of Object.entries(original)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test('conserva la comprobación de la base local de pruebas', async () => {
  process.env.DATABASE_URL = 'postgresql://user:placeholder@127.0.0.1:5433/siga_test';
  const prisma = { $queryRaw: jest.fn().mockResolvedValue([{ name: 'siga_test', port: 5433 }]) };
  await expect(verifyTarget(prisma, 'siga_test')).resolves.toEqual({ name: 'siga_test', port: 5433 });
});

test('el seed de nube exige nombre y host declarados y comprueba el servidor conectado', async () => {
  process.env.DATABASE_URL = 'postgresql://user:placeholder@demo-db.render.com:5432/siga_demo_egx3';
  const prisma = { $queryRaw: jest.fn().mockResolvedValue([{ name: 'siga_demo_egx3', port: 5432 }]) };
  await expect(verifyTarget(prisma, 'siga_demo_egx3')).rejects.toThrow('host o puerto');
  expect(prisma.$queryRaw).not.toHaveBeenCalled();
  process.env.DEMO_DATABASE_HOST = 'demo-db.render.com';
  await expect(verifyTarget(prisma, 'siga_demo_egx3')).resolves.toEqual({ name: 'siga_demo_egx3', port: 5432 });
  prisma.$queryRaw.mockResolvedValueOnce([{ name: 'otra_base', port: 5432 }]);
  await expect(verifyTarget(prisma, 'siga_demo_egx3')).rejects.toThrow('destino declarado');
});

test('el seed de nube rechaza una URL local, otro nombre de base y otro host', async () => {
  process.env.DEMO_DATABASE_HOST = 'demo-db.render.com';
  const prisma = { $queryRaw: jest.fn() };
  for (const url of [
    'postgresql://user:placeholder@127.0.0.1:5432/siga_demo_egx3',
    'postgresql://user:placeholder@demo-db.render.com:5432/siga',
    'postgresql://user:placeholder@demo-db.render.com:5432/siga_demo',
    'postgresql://user:placeholder@demo-db.render.com:5432/siga_demo_egx3_extra',
    'postgresql://user:placeholder@other.render.com:5432/siga_demo_egx3',
  ]) {
    process.env.DATABASE_URL = url;
    await expect(verifyTarget(prisma, 'siga_demo_egx3')).rejects.toThrow();
  }
  expect(prisma.$queryRaw).not.toHaveBeenCalled();
});

test('rechaza el destino anterior aunque la URL tenga el nombre anterior', async () => {
  process.env.DATABASE_URL = 'postgresql://user:placeholder@demo-db.render.com:5432/siga_demo';
  process.env.DEMO_DATABASE_HOST = 'demo-db.render.com';
  const prisma = { $queryRaw: jest.fn() };
  await expect(verifyTarget(prisma, 'siga_demo')).rejects.toThrow('DEMO_TARGET');
  expect(prisma.$queryRaw).not.toHaveBeenCalled();
});
