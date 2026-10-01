const { z } = require('zod');

const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254));
const passwordSchema = z.string().min(12).refine(
  (password) => Buffer.byteLength(password, 'utf8') <= 72,
  'La contraseña no puede superar 72 bytes UTF-8',
);
const loginPasswordSchema = z.string().min(1).refine(
  (password) => Buffer.byteLength(password, 'utf8') <= 72,
  'La contraseña no puede superar 72 bytes UTF-8',
);

const loginSchema = z.strictObject({
  email: emailSchema,
  password: loginPasswordSchema,
});

const changePasswordSchema = z.strictObject({
  currentPassword: loginPasswordSchema,
  newPassword: passwordSchema,
});

const createUserSchema = z.strictObject({
  email: emailSchema,
  password: passwordSchema,
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  role: z.enum(['ADMIN', 'SECRETARIA', 'DOCENTE', 'ESTUDIANTE']),
});

const statusSchema = z.strictObject({ isActive: z.boolean() });
const idSchema = z.uuid().transform((id) => id.toLowerCase());

module.exports = {
  emailSchema,
  passwordSchema,
  loginSchema,
  changePasswordSchema,
  createUserSchema,
  statusSchema,
  idSchema,
};
