const { z } = require('zod');
const { uuidSchema, activeFilterSchema, pageSchema, limitSchema } = require('../../shared/pagination');

const search = z.string().trim().min(1).max(100).optional();

module.exports = {
  create: z.strictObject({
    userId: uuidSchema,
    isActive: z.boolean().optional(),
  }),
  patch: z.strictObject({
    isActive: z.boolean(),
  }),
  filters: z.strictObject({
    search,
    isActive: activeFilterSchema,
    page: pageSchema,
    limit: limitSchema,
  }),
};
