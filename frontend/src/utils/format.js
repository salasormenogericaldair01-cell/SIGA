export const roles = { ADMIN: 'Administrador', SECRETARIA: 'Secretaría', DOCENTE: 'Docente', ESTUDIANTE: 'Estudiante' };
export const attendance = { PRESENT: 'Presente', ABSENT: 'Ausente', LATE: 'Tardanza', JUSTIFIED: 'Justificada' };
export const enrollmentStatus = { ACTIVE: 'Activa', CANCELLED: 'Cancelada' };
export const levelCode = { INICIAL: 'Inicial', PRIMARIA: 'Primaria', SECUNDARIA: 'Secundaria' };
export const dateOnly = (value) => value ? String(value).slice(0, 10) : '';
export const person = (value) => value ? `${value.firstName} ${value.lastName}` : '—';
export const sectionLabel = (section) => section ? `${section.grade?.educationLevel?.name || ''} · ${section.grade?.name || ''} · ${section.name}${section.academicPeriod ? ` · ${section.academicPeriod.name}` : ''}` : '—';
export const assignmentLabel = (assignment) => assignment ? `${assignment.course?.name || 'Curso'} · ${sectionLabel(assignment.section)}` : '—';
