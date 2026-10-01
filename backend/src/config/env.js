const path = require('node:path');
const dotenv = require('dotenv');
const { z } = require('zod');

dotenv.config({ path: path.resolve(__dirname, '../../.env'), quiet: true });

const originSchema = z.url().refine((value) => {
  if (!URL.canParse(value)) return false;
  const url = new URL(value);
  return ['http:', 'https:'].includes(url.protocol) && url.origin === value;
}, 'Debe ser un origen HTTP(S) sin ruta');

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.url().refine((value) => /^postgres(?:ql)?:\/\//.test(value), 'Debe ser una URL PostgreSQL'),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().regex(/^[1-9]\d*(?:s|m|h|d)$/).default('1h'),
  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(14).default(12),
  CORS_ORIGIN: originSchema,
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(1).default(0),
});

const result = envSchema.safeParse({
  PORT: process.env.PORT || undefined,
  NODE_ENV: process.env.NODE_ENV || undefined,
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || undefined,
  BCRYPT_ROUNDS: process.env.BCRYPT_ROUNDS || undefined,
  CORS_ORIGIN: process.env.CORS_ORIGIN,
  TRUST_PROXY_HOPS: process.env.TRUST_PROXY_HOPS || undefined,
});

if (!result.success) {
  const fields = result.error.issues.map((issue) => issue.path.join('.')).join(', ');
  throw new Error(`Configuración de entorno inválida: ${fields}`);
}

module.exports = result.data;
