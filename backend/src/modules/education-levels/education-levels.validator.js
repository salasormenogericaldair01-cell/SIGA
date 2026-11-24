const { z } = require('zod');
const { activeFilterSchema, nonemptySchema } = require('../../shared/pagination');

const name = z.string().trim().min(1).max(100);

module.exports = {
  create: z.strictObject({
    code: z.enum(['INICIAL', 'PRIMARIA', 'SECUNDARIA']),
    name,
    isActive: z.boolean().optional(),
  }),
  patch: nonemptySchema(z.strictObject({
    name: name.optional(),
    isActive: z.boolean().optional(),
  })),
  filters: z.strictObject({
    isActive: activeFilterSchema,
  }),
};
