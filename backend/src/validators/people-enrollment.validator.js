const { z } = require('zod');

const id = z.uuid();
const name = z.string().trim().min(1).max(100);
const code = z.string().trim().min(1).max(50)
  .transform((value) => value.toUpperCase())
  .pipe(z.string().regex(/^[A-Z0-9][A-Z0-9_-]*$/));
const birthDate = z.iso.date()
  .refine((value) => {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    return value <= today;
  })
  .transform((value) => new Date(`${value}T00:00:00.000Z`));
const isActiveFilter = z.enum(['true', 'false']).transform((value) => value === 'true').optional();
const page = z.coerce.number().int().min(1).default(1);
const limit = z.coerce.number().int().min(1).max(100).default(20);
const search = name.optional();
const nonempty = (schema) => schema.refine((value) => Object.keys(value).length > 0);

const student = {
  create: z.strictObject({ studentCode: code, firstName: name, lastName: name, birthDate, userId: id.nullable().optional(), isActive: z.boolean().optional() }),
  patch: nonempty(z.strictObject({ firstName: name.optional(), lastName: name.optional(), birthDate: birthDate.optional(), userId: id.nullable().optional(), isActive: z.boolean().optional() })),
  filters: z.strictObject({ search, isActive: isActiveFilter, page, limit }),
};

const teacher = {
  create: z.strictObject({ userId: id, isActive: z.boolean().optional() }),
  patch: z.strictObject({ isActive: z.boolean() }),
  filters: z.strictObject({ search, isActive: isActiveFilter, page, limit }),
};

const enrollment = {
  create: z.strictObject({ studentId: id, sectionId: id }),
  patch: nonempty(z.strictObject({ sectionId: id.optional(), status: z.enum(['ACTIVE', 'CANCELLED']).optional() })),
  filters: z.strictObject({ studentId: id.optional(), sectionId: id.optional(), academicPeriodId: id.optional(), status: z.enum(['ACTIVE', 'CANCELLED']).optional(), page, limit }),
};

module.exports = { id, student, teacher, enrollment };
