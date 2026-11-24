const { z } = require('zod');

const uuidSchema = z.uuid();
const activeFilterSchema = z.enum(['true', 'false']).transform((v) => v === 'true').optional();
const pageSchema = z.coerce.number().int().min(1).default(1);
const limitSchema = z.coerce.number().int().min(1).max(100).default(20);
const nonemptySchema = (schema) => schema.refine((value) => Object.keys(value).length > 0);

function paginated(data, total, page, limit) {
  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

function todayLimaISO() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const part = (type) => parts.find((value) => value.type === type).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

module.exports = {
  uuidSchema,
  activeFilterSchema,
  pageSchema,
  limitSchema,
  nonemptySchema,
  paginated,
  todayLimaISO,
};
