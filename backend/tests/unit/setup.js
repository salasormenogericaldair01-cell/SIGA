process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5433/siga_test?schema=public';
process.env.JWT_SECRET = 'clave-de-prueba-siga-de-mas-de-treinta-y-dos-caracteres';
process.env.JWT_EXPIRES_IN = '1h';
process.env.BCRYPT_ROUNDS = '10';
process.env.CORS_ORIGIN = 'http://localhost:5173';
