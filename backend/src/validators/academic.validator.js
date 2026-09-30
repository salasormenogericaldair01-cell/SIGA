const { z } = require('zod');

const uuid = z.uuid();
const name = z.string().trim().min(1).max(100);
const sectionName = name.transform((value) => value.toUpperCase());
const date = z.iso.date().transform((value) => new Date(`${value}T00:00:00.000Z`));
const active = z.boolean();
const nonemptyPatch = (schema) => schema.refine((value) => Object.keys(value).length > 0);

const definitions = {
  educationLevel: {
    create: z.strictObject({ code: z.enum(['INICIAL', 'PRIMARIA', 'SECUNDARIA']), name, isActive: active.optional() }),
    patch: nonemptyPatch(z.strictObject({ name: name.optional(), isActive: active.optional() })),
    filters: z.strictObject({ isActive: z.enum(['true', 'false']).transform((v) => v === 'true').optional() }),
  },
  grade: {
    create: z.strictObject({ educationLevelId: uuid, name, order: z.number().int(), isActive: active.optional() }),
    patch: nonemptyPatch(z.strictObject({ name: name.optional(), order: z.number().int().optional(), isActive: active.optional() })),
    filters: z.strictObject({ educationLevelId: uuid.optional(), isActive: z.enum(['true', 'false']).transform((v) => v === 'true').optional() }),
  },
  academicPeriod: {
    create: z.strictObject({ name, startDate: date, endDate: date, isActive: active.optional() }),
    patch: nonemptyPatch(z.strictObject({ name: name.optional(), startDate: date.optional(), endDate: date.optional(), isActive: active.optional() })),
    filters: z.strictObject({ isActive: z.enum(['true', 'false']).transform((v) => v === 'true').optional() }),
  },
  section: {
    create: z.strictObject({ gradeId: uuid, academicPeriodId: uuid, name: sectionName, isActive: active.optional() }),
    patch: nonemptyPatch(z.strictObject({ name: sectionName.optional(), isActive: active.optional() })),
    filters: z.strictObject({ gradeId: uuid.optional(), academicPeriodId: uuid.optional(), isActive: z.enum(['true', 'false']).transform((v) => v === 'true').optional() }),
  },
};

module.exports = { uuid, definitions };
