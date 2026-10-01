import { assignmentLabel, attendance, dateOnly, enrollmentStatus, person, roles, sectionLabel } from '../utils/format';

export const resources = {
  users: { title: 'Usuarios', path: '/users', roles: ['ADMIN'], write: ['ADMIN'], kind: 'users',
    columns: [['email', 'Correo'], ['firstName', 'Nombre'], ['lastName', 'Apellido'], ['role', 'Rol'], ['isActive', 'Estado']],
    create: [field('email', 'Correo', 'email'), field('password', 'Contraseña', 'password'), field('firstName', 'Nombre'), field('lastName', 'Apellido'), choice('role', 'Rol', [['ADMIN', 'Administrador'], ['SECRETARIA', 'Secretaría'], ['DOCENTE', 'Docente'], ['ESTUDIANTE', 'Estudiante']])],
    edit: [field('isActive', 'Cuenta activa', 'checkbox')] },
  'education-levels': { title: 'Niveles', path: '/education-levels', roles: ['ADMIN', 'SECRETARIA'], write: ['ADMIN', 'SECRETARIA'], kind: 'items',
    columns: [['code', 'Código'], ['name', 'Nombre'], ['isActive', 'Estado']],
    create: [choice('code', 'Código', [['INICIAL', 'Inicial'], ['PRIMARIA', 'Primaria'], ['SECUNDARIA', 'Secundaria']]), field('name', 'Nombre')], edit: [field('name', 'Nombre'), field('isActive', 'Disponible', 'checkbox')] },
  grades: { title: 'Grados', path: '/grades', roles: ['ADMIN', 'SECRETARIA'], write: ['ADMIN', 'SECRETARIA'], kind: 'items',
    columns: [['educationLevel.name', 'Nivel'], ['name', 'Nombre'], ['order', 'Orden'], ['isActive', 'Estado']],
    create: [ref('educationLevelId', 'Nivel', 'education-levels'), field('name', 'Nombre'), field('order', 'Orden', 'number')], edit: [field('name', 'Nombre'), field('order', 'Orden', 'number'), field('isActive', 'Disponible', 'checkbox')], filters: [ref('educationLevelId', 'Nivel', 'education-levels')] },
  'academic-periods': { title: 'Periodos académicos', path: '/academic-periods', roles: ['ADMIN', 'SECRETARIA'], write: ['ADMIN', 'SECRETARIA'], kind: 'items',
    columns: [['name', 'Nombre'], ['startDate', 'Inicio'], ['endDate', 'Fin'], ['isActive', 'Estado']],
    create: [field('name', 'Nombre'), field('startDate', 'Inicio', 'date'), field('endDate', 'Fin', 'date')], edit: [field('name', 'Nombre'), field('startDate', 'Inicio', 'date'), field('endDate', 'Fin', 'date'), field('isActive', 'Disponible', 'checkbox')] },
  sections: { title: 'Secciones', path: '/sections', roles: ['ADMIN', 'SECRETARIA'], write: ['ADMIN', 'SECRETARIA'], kind: 'items',
    columns: [['gradeId', 'Grado'], ['academicPeriodId', 'Periodo'], ['name', 'Sección'], ['isActive', 'Estado']],
    create: [ref('gradeId', 'Grado', 'grades'), ref('academicPeriodId', 'Periodo', 'academic-periods'), field('name', 'Sección')], edit: [field('name', 'Sección'), field('isActive', 'Disponible', 'checkbox')], filters: [ref('gradeId', 'Grado', 'grades'), ref('academicPeriodId', 'Periodo', 'academic-periods')] },
  students: { title: 'Estudiantes', path: '/students', roles: ['ADMIN', 'SECRETARIA'], write: ['ADMIN', 'SECRETARIA'], kind: 'data', paginated: true, search: true,
    columns: [['studentCode', 'Código'], ['fullName', 'Nombre'], ['birthDate', 'Nacimiento'], ['user.email', 'Cuenta vinculada'], ['isActive', 'Estado']],
    create: [field('studentCode', 'Código'), field('firstName', 'Nombres'), field('lastName', 'Apellidos'), field('birthDate', 'Fecha de nacimiento', 'date'), ref('userId', 'Cuenta de estudiante (opcional)', 'student-users', true), field('isActive', 'Estado', 'checkbox')],
    edit: [field('firstName', 'Nombres'), field('lastName', 'Apellidos'), field('birthDate', 'Fecha de nacimiento', 'date'), ref('userId', 'Cuenta de estudiante (opcional)', 'student-users', true), field('isActive', 'Estado', 'checkbox')] },
  teachers: { title: 'Docentes', path: '/teachers', roles: ['ADMIN', 'SECRETARIA'], write: ['ADMIN'], kind: 'data', paginated: true, search: true,
    columns: [['user.firstName', 'Nombre'], ['user.lastName', 'Apellido'], ['user.email', 'Correo'], ['isActive', 'Estado']],
    create: [ref('userId', 'Cuenta docente', 'teacher-users')], edit: [field('isActive', 'Activo', 'checkbox')] },
  enrollments: { title: 'Matrículas', path: '/enrollments', roles: ['ADMIN', 'SECRETARIA'], write: ['ADMIN', 'SECRETARIA'], kind: 'data', paginated: true,
    columns: [['student', 'Estudiante'], ['section', 'Sección'], ['academicPeriod.name', 'Periodo'], ['status', 'Estado']],
    create: [ref('studentId', 'Estudiante', 'students'), ref('sectionId', 'Sección', 'sections')], edit: [ref('sectionId', 'Trasladar a sección', 'sections'), choice('status', 'Estado', [['ACTIVE', 'Activa'], ['CANCELLED', 'Cancelada']])],
    filters: [ref('studentId', 'Estudiante', 'students'), ref('sectionId', 'Sección', 'sections'), ref('academicPeriodId', 'Periodo', 'academic-periods'), choice('status', 'Estado', [['ACTIVE', 'Activa'], ['CANCELLED', 'Cancelada']])] },
  courses: { title: 'Cursos', path: '/courses', roles: ['ADMIN', 'SECRETARIA', 'DOCENTE'], write: ['ADMIN', 'SECRETARIA'], kind: 'data', paginated: true, search: true,
    columns: [['code', 'Código'], ['name', 'Nombre'], ['isActive', 'Estado']], create: [field('code', 'Código'), field('name', 'Nombre')], edit: [field('name', 'Nombre'), field('isActive', 'Disponible', 'checkbox')] },
  'teaching-assignments': { title: 'Asignaciones docentes', path: '/teaching-assignments', roles: ['ADMIN', 'SECRETARIA', 'DOCENTE'], write: ['ADMIN', 'SECRETARIA'], kind: 'data', paginated: true,
    columns: [['course.name', 'Curso'], ['section', 'Sección'], ['teacher.user.firstName', 'Docente'], ['isActive', 'Estado']],
    create: [ref('courseId', 'Curso', 'courses'), ref('sectionId', 'Sección', 'sections'), ref('teacherId', 'Docente', 'teachers')], edit: [ref('teacherId', 'Docente', 'teachers'), field('isActive', 'Disponible', 'checkbox')],
    filters: [ref('courseId', 'Curso', 'courses'), ref('sectionId', 'Sección', 'sections'), ref('teacherId', 'Docente', 'teachers'), ref('academicPeriodId', 'Periodo', 'academic-periods')] },
  'grade-records': { title: 'Calificaciones', path: '/grade-records', roles: ['ADMIN', 'SECRETARIA', 'DOCENTE', 'ESTUDIANTE'], write: ['ADMIN', 'DOCENTE'], kind: 'data', paginated: true,
    columns: [['teachingAssignment.course.name', 'Curso'], ['enrollment.student', 'Estudiante'], ['term', 'Bimestre'], ['value', 'Nota']],
    create: [ref('teachingAssignmentId', 'Asignación', 'teaching-assignments'), ref('enrollmentId', 'Matrícula', 'enrollments'), choice('term', 'Bimestre', [[1, '1'], [2, '2'], [3, '3'], [4, '4']]), choice('value', 'Nota', [['AD', 'AD'], ['A', 'A'], ['B', 'B'], ['C', 'C']])],
    edit: [choice('value', 'Nota', [['AD', 'AD'], ['A', 'A'], ['B', 'B'], ['C', 'C']])], filters: [ref('teachingAssignmentId', 'Asignación', 'teaching-assignments'), ref('enrollmentId', 'Matrícula', 'enrollments'), ref('academicPeriodId', 'Periodo', 'academic-periods'), choice('term', 'Bimestre', [[1, '1'], [2, '2'], [3, '3'], [4, '4']])] },
  'attendance-records': { title: 'Asistencia', path: '/attendance-records', roles: ['ADMIN', 'SECRETARIA', 'DOCENTE', 'ESTUDIANTE'], write: ['ADMIN', 'DOCENTE'], kind: 'data', paginated: true,
    columns: [['teachingAssignment.course.name', 'Curso'], ['enrollment.student', 'Estudiante'], ['date', 'Fecha'], ['status', 'Estado']],
    create: [ref('teachingAssignmentId', 'Asignación', 'teaching-assignments'), ref('enrollmentId', 'Matrícula', 'enrollments'), field('date', 'Fecha', 'date'), choice('status', 'Estado', Object.entries(attendance))],
    edit: [choice('status', 'Estado', Object.entries(attendance))], filters: [ref('teachingAssignmentId', 'Asignación', 'teaching-assignments'), ref('enrollmentId', 'Matrícula', 'enrollments'), ref('academicPeriodId', 'Periodo', 'academic-periods')] },
};

function field(key, label, type = 'text') { return { key, label, type }; }
function choice(key, label, options) { return { key, label, type: 'choice', options }; }
function ref(key, label, resource, optional = false) { return { key, label, type: 'ref', resource, optional }; }

export function listData(resource, payload) {
  return resource.kind === 'users' ? payload.users : resource.kind === 'items' ? payload.items : payload.data;
}

export function refLabel(resource, value) {
  if (resource === 'education-levels' || resource === 'academic-periods' || resource === 'courses') return value.name;
  if (resource === 'grades') return `${value.name}${value.educationLevel ? ` · ${value.educationLevel.name}` : ''}`;
  if (resource === 'sections') return sectionLabel(value);
  if (resource === 'students') return `${person(value)} · ${value.studentCode}`;
  if (resource === 'teachers') return person(value.user);
  if (resource === 'teaching-assignments') return assignmentLabel(value);
  if (resource === 'enrollments') return `${person(value.student)} · ${value.student?.studentCode || 'Sin código'} · ${sectionLabel(value.section)}`;
  return person(value);
}

export function displayValue(row, key, references = {}) {
  if (key === 'fullName') return person(row);
  if (key === 'section') return sectionLabel(row.section);
  if (key === 'enrollment.student') return person(row.enrollment?.student);
  if (key === 'teacher.user.firstName') return person(row.teacher?.user);
  if (key === 'educationLevel.name') return references['education-levels']?.find((v) => v.id === row.educationLevelId)?.name || row.educationLevel?.name || row.educationLevelId;
  if (key === 'gradeId') return references.grades?.find((v) => v.id === row.gradeId)?.name || row.gradeId;
  if (key === 'academicPeriodId') return references['academic-periods']?.find((v) => v.id === row.academicPeriodId)?.name || row.academicPeriodId;
  const value = key.split('.').reduce((item, part) => item?.[part], row);
  if (key === 'status') return attendance[value] || enrollmentStatus[value] || value;
  if (key === 'role') return roles[value] || value;
  if (typeof value === 'boolean') return value ? 'Activo' : 'Inactivo';
  if (key.endsWith('Date') || key === 'date') return dateOnly(value);
  return value ?? '—';
}
