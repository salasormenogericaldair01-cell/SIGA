const { z } = require('zod');

const id = z.uuid();
const name = z.string().trim().min(1).max(100);
const code = z.string().trim().min(1).max(50)
  .transform((value) => value.toUpperCase())
  .pipe(z.string().regex(/^[A-Z0-9][A-Z0-9_-]*$/));
const activeFilter = z.enum(['true', 'false']).transform((value) => value === 'true').optional();
const page = z.coerce.number().int().min(1).default(1);
const limit = z.coerce.number().int().min(1).max(100).default(20);
const nonempty = (schema) => schema.refine((value) => Object.keys(value).length > 0);

function todayLimaISO() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const part = (type) => parts.find((value) => value.type === type).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

const attendanceDate = z.iso.date()
  .refine((value) => value <= todayLimaISO())
  .transform((value) => new Date(`${value}T00:00:00.000Z`));

const course = {
  create: z.strictObject({ code, name, isActive: z.boolean().optional() }),
  patch: nonempty(z.strictObject({ name: name.optional(), isActive: z.boolean().optional() })),
  filters: z.strictObject({ search: name.optional(), isActive: activeFilter, page, limit }),
};
const assignment = {
  create: z.strictObject({ courseId: id, sectionId: id, teacherId: id }),
  patch: nonempty(z.strictObject({ teacherId: id.optional(), isActive: z.boolean().optional() })),
  filters: z.strictObject({ courseId: id.optional(), sectionId: id.optional(), teacherId: id.optional(), academicPeriodId: id.optional(), isActive: activeFilter, page, limit }),
  enrollments: z.strictObject({ status: z.enum(['ACTIVE', 'CANCELLED']).optional(), page, limit }),
};
const gradeRecord = {
  create: z.strictObject({ teachingAssignmentId: id, enrollmentId: id, term: z.number().int().min(1).max(4), value: z.enum(['AD', 'A', 'B', 'C']) }),
  patch: z.strictObject({ value: z.enum(['AD', 'A', 'B', 'C']) }),
  filters: z.strictObject({ teachingAssignmentId: id.optional(), enrollmentId: id.optional(), academicPeriodId: id.optional(), term: z.coerce.number().int().min(1).max(4).optional(), page, limit }),
};
const attendanceRecord = {
  create: z.strictObject({ teachingAssignmentId: id, enrollmentId: id, date: attendanceDate, status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'JUSTIFIED']) }),
  patch: z.strictObject({ status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'JUSTIFIED']) }),
  filters: z.strictObject({ teachingAssignmentId: id.optional(), enrollmentId: id.optional(), academicPeriodId: id.optional(), page, limit }),
};

module.exports = { id, todayLimaISO, course, assignment, gradeRecord, attendanceRecord };
