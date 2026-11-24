const { z } = require('zod');
const { uuidSchema, pageSchema, limitSchema, todayLimaISO } = require('../../shared/pagination');

const filterDate = z.iso.date().transform((value) => new Date(`${value}T00:00:00.000Z`));
const attendanceDate = filterDate
  .refine((value) => value.toISOString().slice(0, 10) <= todayLimaISO());

module.exports = {
  todayLimaISO,
  create: z.strictObject({
    teachingAssignmentId: uuidSchema,
    enrollmentId: uuidSchema,
    date: attendanceDate,
    status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'JUSTIFIED']),
  }),
  patch: z.strictObject({
    status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'JUSTIFIED']),
  }),
  filters: z.strictObject({
    teachingAssignmentId: uuidSchema.optional(),
    enrollmentId: uuidSchema.optional(),
    academicPeriodId: uuidSchema.optional(),
    date: filterDate.optional(),
    page: pageSchema,
    limit: limitSchema,
  }),
};
