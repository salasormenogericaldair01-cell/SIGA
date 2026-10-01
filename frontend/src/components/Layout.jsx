import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { resources } from '../services/resources';
import { roles } from '../utils/format';
import Icon from './Icon';
import Brand from './Brand';

const groups = [
  { title: 'Administración', keys: ['users', 'students', 'teachers'] },
  { title: 'Estructura académica', keys: ['education-levels', 'grades', 'academic-periods', 'sections'] },
  { title: 'Gestión académica', keys: ['enrollments', 'courses', 'teaching-assignments', 'grade-records', 'attendance-records'] },
];
const labels = {
  'education-levels': 'Niveles', 'academic-periods': 'Periodos',
  'teaching-assignments': 'Asignaciones', 'grade-records': 'Calificaciones',
  'attendance-records': 'Asistencia',
};

function Navigation({ role, onSelect }) {
  const link = (to, label, icon, home = false) => <NavLink key={to} to={to} end={home} onClick={onSelect} className={({ isActive }) => `nav-link ${home ? 'nav-home' : ''} ${isActive ? 'nav-active' : ''}`}><Icon name={icon} size={16} /><span>{label}</span></NavLink>;
  return <nav aria-label="Navegación principal" className="nav-groups">
    <div className="nav-group">{link('/', 'Inicio', 'home', true)}{role === 'DOCENTE' && link('/mi-aula', 'Mi aula', 'teachers')}</div>
    {groups.map((group) => {
      const visible = group.keys.filter((key) => resources[key].roles.includes(role));
      if (visible.length === 0) return null;
      return <div className="nav-group" key={group.title}><p className="nav-heading">{group.title}</p>{visible.map((key) => link(`/${key}`, role === 'ESTUDIANTE' ? key === 'grade-records' ? 'Mis calificaciones' : 'Mi asistencia' : labels[key] || resources[key].title, key))}</div>;
    })}
  </nav>;
}

export default function Layout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    function closeOnEscape(event) { if (event.key === 'Escape') setOpen(false); }
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, []);
  function leave() { logout(); navigate('/login', { replace: true }); }
  const initials = `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase();
  const section = location.pathname === '/' ? 'Inicio' : location.pathname === '/mi-aula' ? 'Mi aula' : resources[location.pathname.slice(1)]?.title || 'SIGA';
  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Saltar al contenido</a>
    <aside className="sidebar"><div className="sidebar-brand"><Brand inverse /></div><div className="sidebar-scroll"><Navigation role={user.role} onSelect={() => setOpen(false)} /></div><div className="sidebar-foot"><span className="sidebar-foot-dot" />Un espacio para aprender y gestionar</div></aside>
    <div className="shell-main"><header className="topbar">
      <button type="button" aria-label={open ? 'Cerrar menú' : 'Abrir menú'} aria-expanded={open} aria-controls="mobile-navigation" className="btn-secondary menu-toggle" onClick={() => setOpen(!open)}><Icon name={open ? 'close' : 'menu'} size={19} /><span>Menú</span></button>
      <div className="topbar-context"><span className="topbar-kicker">Sistema de Gestión Académica</span><span className="topbar-title">{section}</span></div>
      <div className="topbar-user"><span className="user-avatar" aria-hidden="true">{initials}</span><span className="user-text"><strong>{user.firstName} {user.lastName}</strong><small>{roles[user.role]}</small></span><button type="button" className="logout-button" onClick={leave}><Icon name="logout" size={16} />Salir</button></div>
    </header>
    {open && <div id="mobile-navigation" className="mobile-nav"><div className="mobile-nav-brand"><Brand inverse /></div><Navigation role={user.role} onSelect={() => setOpen(false)} /></div>}
    <main id="main-content" className="content"><Outlet /></main></div>
  </div>;
}
