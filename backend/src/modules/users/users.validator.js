const { z } = require('zod');
const { emailSchema, passwordSchema, profileNameSchema } = require('../auth/auth.validator');
const { activeFilterSchema, uuidSchema } = require('../../shared/pagination');

const createUserSchema = z.strictObject({
  email: emailSchema,
  password: passwordSchema,
  firstName: profileNameSchema,
  lastName: profileNameSchema,
  role: z.enum(['ADMIN', 'SECRETARIA', 'DOCENTE', 'ESTUDIANTE']),
});

const updateUserSchema = z.strictObject({
  email: emailSchema.optional(),
  firstName: profileNameSchema.optional(),
  lastName: profileNameSchema.optional(),
}).refine((value) => Object.keys(value).length > 0);

const listUsersSchema = z.strictObject({
  search: z.string().trim().max(100).optional(),
  role: z.enum(['ADMIN', 'SECRETARIA', 'DOCENTE', 'ESTUDIANTE']).optional(),
  isActive: activeFilterSchema,
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

const statusSchema = z.strictObject({ isActive: z.boolean() });
const idSchema = uuidSchema.transform((id) => id.toLowerCase());

module.exports = {
  emailSchema,
  passwordSchema,
  createUserSchema,
  updateUserSchema,
  listUsersSchema,
  statusSchema,
  idSchema,
};
