const prisma = require('../config/prisma');
const { publicUserSelect } = require('../utils/user');
const { ModuleError } = require('../utils/module-error');

const studentInclude = { user: { select: publicUserSelect } };
const teacherInclude = { user: { select: publicUserSelect } };
const orderBy = [{ createdAt: 'asc' }, { id: 'asc' }];

async function requireUser(db, userId, role) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, role: true, isActive: true } });
  if (!user) throw new ModuleError(404, 'Usuario no encontrado');
  if (!user.isActive || user.role !== role) throw new ModuleError(409, 'Usuario incompatible o inactivo');
}

async function listStudents({ search, isActive, page, limit }) {
  const where = {
    ...(isActive === undefined ? {} : { isActive }),
    ...(search ? { OR: [
      { studentCode: { contains: search, mode: 'insensitive' } },
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
    ] } : {}),
  };
  const [total, data] = await Promise.all([
    prisma.student.count({ where }),
    prisma.student.findMany({ where, include: studentInclude, orderBy, skip: (page - 1) * limit, take: limit }),
  ]);
  return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

async function getStudent(id) {
  const student = await prisma.student.findUnique({ where: { id }, include: studentInclude });
  if (!student) throw new ModuleError(404, 'Estudiante no encontrado');
  return student;
}

async function createStudent(data) {
  return prisma.$transaction(async (db) => {
    if (data.userId) await requireUser(db, data.userId, 'ESTUDIANTE');
    return db.student.create({ data, include: studentInclude });
  });
}

async function updateStudent(id, data) {
  return prisma.$transaction(async (db) => {
    const current = await db.student.findUnique({ where: { id }, select: { id: true } });
    if (!current) throw new ModuleError(404, 'Estudiante no encontrado');
    if (data.userId) await requireUser(db, data.userId, 'ESTUDIANTE');
    return db.student.update({ where: { id }, data, include: studentInclude });
  });
}

async function listTeachers({ search, isActive, page, limit }) {
  const where = {
    ...(isActive === undefined ? {} : { isActive }),
    ...(search ? { user: { is: { OR: [
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ] } } } : {}),
  };
  const [total, data] = await Promise.all([
    prisma.teacher.count({ where }),
    prisma.teacher.findMany({ where, include: teacherInclude, orderBy, skip: (page - 1) * limit, take: limit }),
  ]);
  return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

async function getTeacher(id) {
  const teacher = await prisma.teacher.findUnique({ where: { id }, include: teacherInclude });
  if (!teacher) throw new ModuleError(404, 'Docente no encontrado');
  return teacher;
}

async function createTeacher(data) {
  return prisma.$transaction(async (db) => {
    await requireUser(db, data.userId, 'DOCENTE');
    return db.teacher.create({ data, include: teacherInclude });
  });
}

async function updateTeacher(id, data) {
  return prisma.$transaction(async (db) => {
    const current = await db.teacher.findUnique({ where: { id }, select: { id: true } });
    if (!current) throw new ModuleError(404, 'Docente no encontrado');
    return db.teacher.update({ where: { id }, data, include: teacherInclude });
  });
}

module.exports = { listStudents, getStudent, createStudent, updateStudent, listTeachers, getTeacher, createTeacher, updateTeacher };
