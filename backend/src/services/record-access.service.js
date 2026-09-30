const prisma = require('../config/prisma');
const { ModuleError } = require('../utils/module-error');

async function scopeFor(user, db = prisma) {
  if (user.role === 'DOCENTE') {
    const teacher = await db.teacher.findUnique({ where: { userId: user.id }, select: { id: true } });
    if (!teacher) throw new ModuleError(403, 'Perfil docente requerido');
    return { role: user.role, teacherId: teacher.id };
  }
  if (user.role === 'ESTUDIANTE') {
    const student = await db.student.findUnique({ where: { userId: user.id }, select: { id: true } });
    if (!student) throw new ModuleError(403, 'Perfil estudiante requerido');
    return { role: user.role, studentId: student.id };
  }
  return { role: user.role };
}

function assignmentWhere(scope) {
  return scope.role === 'DOCENTE' ? { teacherId: scope.teacherId } : {};
}

function recordWhere(scope) {
  if (scope.role === 'DOCENTE') return { teachingAssignment: { is: { teacherId: scope.teacherId } } };
  if (scope.role === 'ESTUDIANTE') return { enrollment: { is: { studentId: scope.studentId } } };
  return {};
}

function assertAssignment(scope, assignment) {
  if (scope.role === 'DOCENTE' && assignment.teacherId !== scope.teacherId) {
    throw new ModuleError(403, 'Asignación fuera de alcance');
  }
}

function assertRecord(scope, record) {
  if (scope.role === 'DOCENTE' && record.teachingAssignment.teacherId !== scope.teacherId) {
    throw new ModuleError(403, 'Registro fuera de alcance');
  }
  if (scope.role === 'ESTUDIANTE' && record.enrollment.studentId !== scope.studentId) {
    throw new ModuleError(403, 'Registro fuera de alcance');
  }
}

function assertWriter(scope) {
  if (!['ADMIN', 'DOCENTE'].includes(scope.role)) throw new ModuleError(403, 'Sin permiso de escritura');
}

module.exports = { scopeFor, assignmentWhere, recordWhere, assertAssignment, assertRecord, assertWriter };
