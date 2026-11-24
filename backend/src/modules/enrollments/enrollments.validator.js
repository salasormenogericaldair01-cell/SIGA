const { z } = require('zod');
const { uuidSchema, pageSchema, limitSchema, nonemptySchema } = require('../../shared/pagination');

const status = z.enum(['ACTIVE', 'CANCELLED']);

const createSchema = z.strictObject({
  studentId: uuidSchema,
  sectionId: uuidSchema,
});

const patchSchema = nonemptySchema(z.strictObject({
  sectionId: uuidSchema.optional(),
  status: status.optional(),
}));

const filtersSchema = z.strictObject({
  studentId: uuidSchema.optional(),
  sectionId: uuidSchema.optional(),
  academicPeriodId: uuidSchema.optional(),
  status: status.optional(),
  page: pageSchema,
  limit: limitSchema,
});

module.exports = { id: uuidSchema, create: createSchema, patch: patchSchema, filters: filtersSchema };
