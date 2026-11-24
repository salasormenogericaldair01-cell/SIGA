const { z } = require('zod');
const { uuidSchema, activeFilterSchema, pageSchema, limitSchema, nonemptySchema } = require('../../shared/pagination');

const name = z.string().trim().min(1).max(100);
const code = z.string().trim().min(1).max(50)
  .transform((value) => value.toUpperCase())
  .pipe(z.string().regex(/^[A-Z0-9][A-Z0-9_-]*$/));
const birthDate = z.iso.date()
  .refine((value) => {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    return value <= today;
  })
  .transform((value) => new Date(`${value}T00:00:00.000Z`));

module.exports = {
  create: z.strictObject({
    studentCode: code,
    firstName: name,
    lastName: name,
    birthDate,
    userId: uuidSchema.nullable().optional(),
    isActive: z.boolean().optional(),
  }),
  patch: nonemptySchema(z.strictObject({
    firstName: name.optional(),
    lastName: name.optional(),
    birthDate: birthDate.optional(),
    userId: uuidSchema.nullable().optional(),
    isActive: z.boolean().optional(),
  })),
  filters: z.strictObject({
    search: name.optional(),
    isActive: activeFilterSchema,
    page: pageSchema,
    limit: limitSchema,
  }),
};
