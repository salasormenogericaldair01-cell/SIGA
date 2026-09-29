const { z } = require('zod');
const bcrypt = require('bcrypt');
const prisma = require('../src/config/prisma');
const env = require('../src/config/env');
const { createUserSchema } = require('../src/validators/user.validator');

async function main() {
  const input = z.object({
    ADMIN_EMAIL: z.string(),
    ADMIN_PASSWORD: z.string(),
    ADMIN_FIRST_NAME: z.string(),
    ADMIN_LAST_NAME: z.string(),
  }).safeParse(process.env);

  if (!input.success) {
    throw new Error('Faltan variables ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_FIRST_NAME o ADMIN_LAST_NAME');
  }

  const data = createUserSchema.parse({
    email: input.data.ADMIN_EMAIL,
    password: input.data.ADMIN_PASSWORD,
    firstName: input.data.ADMIN_FIRST_NAME,
    lastName: input.data.ADMIN_LAST_NAME,
    role: 'ADMIN',
  });

  const existing = await prisma.user.findUnique({ where: { email: data.email }, select: { id: true } });
  if (existing) {
    console.log('El email ya existe; no se modificó la cuenta.');
    return;
  }

  try {
    await prisma.user.create({
      data: {
        email: data.email,
        passwordHash: await bcrypt.hash(data.password, env.BCRYPT_ROUNDS),
        firstName: data.firstName,
        lastName: data.lastName,
        role: 'ADMIN',
      },
      select: { id: true },
    });
    console.log('Primer ADMIN creado.');
  } catch (error) {
    if (error.code === 'P2002') {
      console.log('El email ya existe; no se modificó la cuenta.');
      return;
    }
    throw error;
  }
}

main()
  .catch((error) => {
    console.error('No se pudo crear el ADMIN:', error.name || 'Error');
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
