const { z } = require('zod');
const { uuidSchema, activeFilterSchema, nonemptySchema } = require('../../shared/pagination');

const name = z.string().trim().min(1).max(100);

module.exports = {
  create: z.strictObject({
    educationLevelId: uuidSchema,
    name,
    order: z.number().int(),
    isActive: z.boolean().optional(),
  }),
  patch: nonemptySchema(z.strictObject({
    name: name.optional(),
    order: z.number().int().optional(),
    isActive: z.boolean().optional(),
  })),
  filters: z.strictObject({
    educationLevelId: uuidSchema.optional(),
    isActive: activeFilterSchema,
  }),
};
