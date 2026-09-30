import { Link } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import Icon from '../components/Icon';
import { PageHeader } from '../components/Ui';
import { resources } from '../services/resources';

const groups = [
  { title: 'Administración', keys: ['users', 'students', 'teachers'] },
  { title: 'Estructura académica', keys: ['education-levels', 'grades', 'academic-periods', 'sections'] },
  { title: 'Gestión académica', keys: ['enrollments', 'courses', 'teaching-assignments', 'grade-records', 'attendance-records'] },
];
const descriptions = {
  users: 'Cuentas, accesos y estado.', students: 'Expedientes y datos del estudiante.', teachers: 'Perfiles docentes vinculados.',
  'education-levels': 'Inicial, Primaria y Secundaria.', grades: 'Grados y orden por nivel.', 'academic-periods': 'Fechas y periodos académicos.', sections: 'Aulas, grados y periodos.',
  enrollments: 'Inscripción y traslado permitido.', courses: 'Catálogo de cursos.', 'teaching-assignments': 'Cursos asignados a docentes.',
  'grade-records': 'Consulta y registro de notas.', 'attendance-records': 'Registro y consulta de asistencia.',
};

export default function Dashboard() {
  const { user } = useAuth();
  const titleFor = (key) => user.role === 'ESTUDIANTE' ? key === 'grade-records' ? 'Mis calificaciones' : 'Mi asistencia' : resources[key].title;
  return <div>
    <PageHeader title={`Bienvenido, ${user.firstName}`} subtitle="Accede a los módulos disponibles para tu cuenta." />
    {user.role === 'DOCENTE' && <section className="dashboard-group"><h2>Mi aula</h2><div className="module-grid"><Link className="module-card" to="/mi-aula"><span className="module-icon"><Icon name="teachers" size={20} /></span><span className="module-copy"><strong>Mi aula</strong><small>Asignaciones, estudiantes, notas y asistencia.</small></span></Link></div></section>}
    {groups.map((group) => {
      const keys = group.keys.filter((key) => resources[key].roles.includes(user.role));
      if (!keys.length) return null;
      return <section className="dashboard-group" key={group.title}><h2>{group.title}</h2><div className="module-grid">{keys.map((key) => <Link className="module-card" key={key} to={`/${key}`}><span className="module-icon"><Icon name={key} size={20} /></span><span className="module-copy"><strong>{titleFor(key)}</strong><small>{descriptions[key]}</small></span></Link>)}</div></section>;
    })}
  </div>;
}
