const { z } = require('zod');
const { activeFilterSchema, pageSchema, limitSchema, nonemptySchema } = require('../../shared/pagination');

const name = z.string().trim().min(1).max(100);
const code = z.string().trim().min(1).max(50)
  .transform((value) => value.toUpperCase())
  .pipe(z.string().regex(/^[A-Z0-9][A-Z0-9_-]*$/));

module.exports = {
  create: z.strictObject({ code, name, isActive: z.boolean().optional() }),
  patch: nonemptySchema(z.strictObject({ name: name.optional(), isActive: z.boolean().optional() })),
  filters: z.strictObject({ search: name.optional(), isActive: activeFilterSchema, page: pageSchema, limit: limitSchema }),
};
