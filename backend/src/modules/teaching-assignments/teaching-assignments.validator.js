const { z } = require('zod');
const { uuidSchema, activeFilterSchema, pageSchema, limitSchema, nonemptySchema } = require('../../shared/pagination');

module.exports = {
  create: z.strictObject({
    courseId: uuidSchema,
    sectionId: uuidSchema,
    teacherId: uuidSchema,
  }),
  patch: nonemptySchema(z.strictObject({
    teacherId: uuidSchema.optional(),
    isActive: z.boolean().optional(),
  })),
  filters: z.strictObject({
    courseId: uuidSchema.optional(),
    sectionId: uuidSchema.optional(),
    teacherId: uuidSchema.optional(),
    academicPeriodId: uuidSchema.optional(),
    isActive: activeFilterSchema,
    page: pageSchema,
    limit: limitSchema,
  }),
  enrollments: z.strictObject({
    status: z.enum(['ACTIVE', 'CANCELLED']).optional(),
    page: pageSchema,
    limit: limitSchema,
  }),
};
