const { Teacher, Student } = require('../models');
const { AppError } = require('./errors');

async function scopeFor(user, transaction) {
  if (user.role === 'DOCENTE') {
    const teacher = await Teacher.findOne({
      where: { userId: user.id },
      attributes: ['id'],
      ...(transaction ? { transaction } : {}),
    });
    if (!teacher) throw new AppError(403, 'Perfil docente requerido');
    return { role: user.role, teacherId: teacher.id };
  }
  if (user.role === 'ESTUDIANTE') {
    const student = await Student.findOne({
      where: { userId: user.id },
      attributes: ['id'],
      ...(transaction ? { transaction } : {}),
    });
    if (!student) throw new AppError(403, 'Perfil estudiante requerido');
    return { role: user.role, studentId: student.id };
  }
  return { role: user.role };
}

function assignmentWhere(scope) {
  return scope.role === 'DOCENTE' ? { teacherId: scope.teacherId } : {};
}

function assertAssignment(scope, assignment) {
  if (scope.role === 'DOCENTE' && assignment.teacherId !== scope.teacherId) {
    throw new AppError(403, 'Asignación fuera de alcance');
  }
}

function assertRecord(scope, record) {
  if (scope.role === 'DOCENTE' && record.teachingAssignment?.teacherId !== scope.teacherId) {
    throw new AppError(403, 'Registro fuera de alcance');
  }
  if (scope.role === 'ESTUDIANTE' && record.enrollment?.studentId !== scope.studentId) {
    throw new AppError(403, 'Registro fuera de alcance');
  }
}

function assertWriter(scope) {
  if (!['ADMIN', 'DOCENTE'].includes(scope.role)) throw new AppError(403, 'Sin permiso de escritura');
}

module.exports = {
  scopeFor,
  assignmentWhere,
  assertAssignment,
  assertRecord,
  assertWriter,
};
