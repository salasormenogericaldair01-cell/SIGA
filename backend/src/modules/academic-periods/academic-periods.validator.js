const { z } = require('zod');
const { activeFilterSchema, nonemptySchema } = require('../../shared/pagination');

const name = z.string().trim().min(1).max(100);
const date = z.iso.date().transform((value) => new Date(`${value}T00:00:00.000Z`));

module.exports = {
  create: z.strictObject({
    name,
    startDate: date,
    endDate: date,
    isActive: z.boolean().optional(),
  }),
  patch: nonemptySchema(z.strictObject({
    name: name.optional(),
    startDate: date.optional(),
    endDate: date.optional(),
    isActive: z.boolean().optional(),
  })),
  filters: z.strictObject({
    isActive: activeFilterSchema,
  }),
};
