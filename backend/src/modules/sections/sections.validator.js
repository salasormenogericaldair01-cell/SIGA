const { z } = require('zod');
const { uuidSchema, activeFilterSchema, nonemptySchema } = require('../../shared/pagination');

const sectionName = z.string().trim().min(1).max(100).transform((value) => value.toUpperCase());

module.exports = {
  create: z.strictObject({
    gradeId: uuidSchema,
    academicPeriodId: uuidSchema,
    name: sectionName,
    isActive: z.boolean().optional(),
  }),
  patch: nonemptySchema(z.strictObject({
    name: sectionName.optional(),
    isActive: z.boolean().optional(),
  })),
  filters: z.strictObject({
    gradeId: uuidSchema.optional(),
    academicPeriodId: uuidSchema.optional(),
    isActive: activeFilterSchema,
  }),
};
