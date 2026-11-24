const { z } = require('zod');
const { uuidSchema, pageSchema, limitSchema } = require('../../shared/pagination');

module.exports = {
  create: z.strictObject({
    teachingAssignmentId: uuidSchema,
    enrollmentId: uuidSchema,
    term: z.number().int().min(1).max(4),
    value: z.enum(['AD', 'A', 'B', 'C']),
  }),
  patch: z.strictObject({
    value: z.enum(['AD', 'A', 'B', 'C']),
  }),
  filters: z.strictObject({
    teachingAssignmentId: uuidSchema.optional(),
    enrollmentId: uuidSchema.optional(),
    academicPeriodId: uuidSchema.optional(),
    term: z.coerce.number().int().min(1).max(4).optional(),
    page: pageSchema,
    limit: limitSchema,
  }),
};
