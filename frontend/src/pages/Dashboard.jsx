import { Link } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import Icon from '../components/Icon';
import { resources } from '../services/resources';
import { roles } from '../utils/format';

const groups = [
  { title: 'Administración', keys: ['users', 'students', 'teachers'] },
  { title: 'Estructura académica', keys: ['education-levels', 'grades', 'academic-periods', 'sections'] },
  { title: 'Gestión académica', keys: ['enrollments', 'courses', 'teaching-assignments', 'grade-records', 'attendance-records'] },
];
const descriptions = {
  users: 'Crea cuentas y administra su estado.', students: 'Consulta y actualiza los datos de estudiantes.', teachers: 'Consulta los perfiles docentes.',
  'education-levels': 'Inicial, Primaria y Secundaria.', grades: 'Grados y orden por nivel.', 'academic-periods': 'Fechas y periodos académicos.', sections: 'Aulas, grados y periodos.',
  enrollments: 'Registra matrículas y gestiona traslados.', courses: 'Consulta y organiza los cursos.', 'teaching-assignments': 'Consulta los cursos asignados a cada docente.',
  'grade-records': 'Consulta las calificaciones por bimestre.', 'attendance-records': 'Consulta la asistencia por fecha.',
};
const startingPoints = {
  ADMIN: { to: '/students', label: 'Ir a estudiantes', description: 'Gestiona estudiantes, cuentas y actividades académicas desde un solo lugar.' },
  SECRETARIA: { to: '/students', label: 'Ir a estudiantes', description: 'Registra estudiantes y mantén al día su matrícula y estructura académica.' },
  DOCENTE: { to: '/mi-aula', label: 'Abrir mi aula', description: 'Consulta tus secciones y registra calificaciones o asistencia.' },
  ESTUDIANTE: { to: '/grade-records', label: 'Ver mis calificaciones', description: 'Consulta tus calificaciones y tu asistencia en un espacio personal.' },
};

export default function Dashboard() {
  const { user } = useAuth();
  const start = startingPoints[user.role];
  const titleFor = (key) => user.role === 'ESTUDIANTE' ? key === 'grade-records' ? 'Mis calificaciones' : 'Mi asistencia' : resources[key].title;
  return <div className="dashboard-page">
    <section className="dashboard-hero" aria-labelledby="welcome-title">
      <img className="dashboard-hero-image" src="/images/campus-illustration.png" alt="" />
      <div className="dashboard-hero-content"><p className="hero-eyebrow">Tu espacio · {roles[user.role]}</p><h1 id="welcome-title">Bienvenido, {user.firstName}</h1><p>{start.description}</p><Link className="hero-action" to={start.to}>{start.label}<Icon name="chevronRight" size={18} /></Link></div>
    </section>
    <div className="dashboard-intro"><div><p className="page-eyebrow">Accesos rápidos</p><h2>¿Qué necesitas hacer?</h2></div><p>Elige un módulo para continuar con tus actividades.</p></div>
    {user.role === 'DOCENTE' && <section className="dashboard-group"><h2>Mi aula</h2><div className="module-grid"><Link className="module-card" to="/mi-aula"><span className="module-icon"><Icon name="teachers" size={20} /></span><span className="module-copy"><strong>Mi aula</strong><small>Asignaciones, estudiantes, notas y asistencia.</small></span><Icon name="chevronRight" size={16} className="module-arrow" /></Link></div></section>}
    {groups.map((group) => {
      const keys = group.keys.filter((key) => resources[key].roles.includes(user.role));
      if (!keys.length) return null;
      return <section className="dashboard-group" key={group.title}><h2>{group.title}</h2><div className="module-grid">{keys.map((key) => <Link className="module-card" key={key} to={`/${key}`}><span className="module-icon"><Icon name={key} size={20} /></span><span className="module-copy"><strong>{titleFor(key)}</strong><small>{descriptions[key]}</small></span><Icon name="chevronRight" size={16} className="module-arrow" /></Link>)}</div></section>;
    })}
  </div>;
}
