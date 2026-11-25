class AppError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function isUniqueConstraintError(error) {
  const pgCode = error?.parent?.code || error?.original?.code || error?.code;
  return error?.name === 'SequelizeUniqueConstraintError' || pgCode === '23505' || pgCode === 'P2002';
}

function respondError(error, res, { conflict2034Message = 'Conflicto concurrente; vuelve a intentar' } = {}) {
  if (error instanceof AppError) {
    return res.status(error.status).json({ message: error.message });
  }
  const pgCode = error.parent?.code || error.original?.code || error.code;
  if (isUniqueConstraintError(error)) {
    return res.status(409).json({ message: 'Registro duplicado' });
  }
  if (error.name === 'SequelizeForeignKeyConstraintError' || pgCode === '23503' || pgCode === 'P2003') {
    const constraint = String(error.parent?.constraint || error.original?.constraint || error.index || error.meta?.field_name || '');
    const composite = constraint.includes('Enrollment_sectionId_academicPeriodId_fkey')
      || /^(GradeRecord|AttendanceRecord)_(enrollmentId|teachingAssignmentId)_sectionId_fkey/.test(constraint);
    return res.status(composite ? 409 : 404).json({
      message: composite ? 'Conflicto de asociación' : 'Referencia no encontrada',
    });
  }
  if (error.name === 'SequelizeValidationError') {
    return res.status(400).json({ message: 'Datos inválidos' });
  }
  if (pgCode === '40001' || pgCode === 'P2034') {
    return res.status(409).json({ message: conflict2034Message });
  }
  if (pgCode === 'P2025') {
    return res.status(404).json({ message: 'Recurso no encontrado' });
  }
  if (pgCode === 'P2004') {
    return res.status(409).json({ message: 'Conflicto de asociación' });
  }
  if (typeof error.message === 'string'
    && /(?:GradeRecord|AttendanceRecord)_enrollmentId_sectionId_fkey/.test(error.message)) {
    return res.status(409).json({ message: 'La matrícula tiene registros académicos asociados' });
  }
  throw error;
}

module.exports = { AppError, isUniqueConstraintError, respondError };
