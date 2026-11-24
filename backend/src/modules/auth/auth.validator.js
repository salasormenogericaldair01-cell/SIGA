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

const profileNameSchema = z.string().trim().min(1).max(100);
const updateProfileSchema = z.strictObject({
  firstName: profileNameSchema,
  lastName: profileNameSchema,
}).partial().refine((value) => Object.keys(value).length > 0);

module.exports = {
  emailSchema,
  passwordSchema,
  profileNameSchema,
  loginSchema,
  changePasswordSchema,
  updateProfileSchema,
};
