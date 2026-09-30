import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { Notice, Spinner } from './components/Ui';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ResourcePage from './pages/ResourcePage';
import TeacherClassroom from './pages/TeacherClassroom';
import { resources } from './services/resources';

function Protected({ children, roles }) {
  const { token, user, loading, retrySession } = useAuth();
  const location = useLocation();
  if (loading) return <div className="m-8"><Spinner /></div>;
  if (!token) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!user) return <main className="mx-auto max-w-md p-8"><Notice message="No se pudo verificar la sesión. Revisa tu conexión e inténtalo de nuevo." /><button className="btn-primary mt-4" onClick={retrySession}>Reintentar</button></main>;
  if (roles && !roles.includes(user.role)) return <Navigate to="/sin-permiso" replace />;
  return children;
}

function AppRoutes() {
  const { token, user, loading, retrySession } = useAuth();
  return <Routes>
    <Route path="/login" element={loading ? <div className="m-8"><Spinner /></div> : token && !user ? <main className="mx-auto max-w-md p-8"><Notice message="No se pudo verificar la sesión. Revisa tu conexión e inténtalo de nuevo." /><button className="btn-primary mt-4" onClick={retrySession}>Reintentar</button></main> : <Login />} />
    <Route path="/sin-permiso" element={<Protected><div className="mx-auto max-w-xl p-8"><h1 className="text-2xl font-bold">Sin permisos</h1><p>No tienes acceso a este módulo.</p></div></Protected>} />
    <Route element={<Protected><Layout /></Protected>}><Route index element={<Dashboard />} />
      <Route path="mi-aula" element={<Protected roles={['DOCENTE']}><TeacherClassroom /></Protected>} />
      {Object.entries(resources).map(([key, resource]) => <Route key={key} path={key} element={<Protected roles={resource.roles}><ResourcePage resourceKey={key} /></Protected>} />)}
      <Route path="*" element={<div><h1 className="text-2xl font-bold">Página no encontrada</h1><p>Vuelve al inicio desde el menú.</p></div>} />
    </Route>
  </Routes>;
}

export default function App() { return <BrowserRouter><AuthProvider><AppRoutes /></AuthProvider></BrowserRouter>; }
