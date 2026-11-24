export const roles = { ADMIN: 'Administrador', SECRETARIA: 'Secretaría', DOCENTE: 'Docente', ESTUDIANTE: 'Estudiante' };
export const attendance = { PRESENT: 'Presente', ABSENT: 'Ausente', LATE: 'Tardanza', JUSTIFIED: 'Justificada' };
export const enrollmentStatus = { ACTIVE: 'Activa', CANCELLED: 'Cancelada' };
export const levelCode = { INICIAL: 'Inicial', PRIMARIA: 'Primaria', SECUNDARIA: 'Secundaria' };
export const dateOnly = (value) => value ? String(value).slice(0, 10) : '';
export const person = (value) => value ? `${value.firstName} ${value.lastName}` : '—';
export const sectionLabel = (section) => {
  if (!section) return '—';
  const grade = section.grade?.name || 'Grado';
  const level = section.grade?.educationLevel?.name;
  const group = section.name?.toLocaleUpperCase('es') === 'ÚNICA' ? '' : ` · Sección ${section.name}`;
  return `${grade}${level ? ` de ${level}` : ''}${group}${section.academicPeriod ? ` · ${section.academicPeriod.name}` : ''}`;
};
export const assignmentLabel = (assignment) => assignment ? `${assignment.course?.name || 'Curso'} · ${sectionLabel(assignment.section)}` : '—';
export function todayLimaISO() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const part = (type) => parts.find((value) => value.type === type).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
