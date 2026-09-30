class ModuleError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function respond(error, res) {
  if (error instanceof ModuleError) return res.status(error.status).json({ message: error.message });
  if (error.code === 'P2002') return res.status(409).json({ message: 'Registro duplicado' });
  if (error.code === 'P2003') {
    const composite = String(error.meta?.field_name || '').includes('Enrollment_sectionId_academicPeriodId_fkey');
    return res.status(composite ? 409 : 404).json({ message: composite ? 'Conflicto de asociación' : 'Referencia no encontrada' });
  }
  if (error.code === 'P2025') return res.status(404).json({ message: 'Recurso no encontrado' });
  if (error.code === 'P2004') return res.status(409).json({ message: 'Conflicto de asociación' });
  if (error.code === 'P2034') return res.status(409).json({ message: 'Conflicto concurrente; vuelve a intentar' });
  throw error;
}

module.exports = { ModuleError, respond };
