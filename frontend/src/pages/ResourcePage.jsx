import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import Icon from '../components/Icon';
import { Button, ConfirmDialog, DataTable, EmptyState, FilterPanel, FormField, Notice, PageHeader, Pager, ReferenceField, Spinner, StatusBadge, StudentIdentity } from '../components/Ui';
import { displayValue, listData, resources } from '../services/resources';
import { dateOnly } from '../utils/format';

const singularNames = {
  users: 'usuario', 'education-levels': 'nivel', grades: 'grado', 'academic-periods': 'periodo académico',
  sections: 'sección', students: 'estudiante', teachers: 'perfil docente', enrollments: 'matrícula',
  courses: 'curso', 'teaching-assignments': 'asignación docente', 'grade-records': 'calificación',
  'attendance-records': 'asistencia',
};
const descriptions = {
  users: 'Crea cuentas y administra su estado de acceso.',
  'education-levels': 'Consulta y organiza los niveles educativos.',
  grades: 'Consulta los grados de cada nivel educativo.',
  'academic-periods': 'Define las fechas de cada periodo académico.',
  sections: 'Organiza las secciones por grado y periodo.',
  students: 'Busca estudiantes por código o nombre y actualiza sus datos.',
  teachers: 'Consulta los perfiles docentes vinculados a una cuenta.',
  enrollments: 'Consulta matrículas y gestiona los traslados permitidos.',
  courses: 'Consulta y organiza el catálogo de cursos.',
  'teaching-assignments': 'Consulta los cursos asignados a cada docente.',
  'grade-records': 'Consulta las calificaciones registradas por bimestre.',
  'attendance-records': 'Consulta la asistencia registrada por fecha.',
};

function initialValue(field, item) {
  const value = item?.[field.key];
  if (field.type === 'date') return dateOnly(value);
  if (field.type === 'checkbox') return item ? Boolean(value) : true;
  return value === null ? '' : value ?? field.defaultValue ?? '';
}

function validate(fields, values, edit) {
  const errors = {};
  fields.forEach((field) => {
    const value = values[field.key];
    if (!edit && !field.optional && field.type !== 'checkbox' && !String(value ?? '').trim()) errors[field.key] = 'Este campo es obligatorio.';
    if (field.type === 'password' && value && (value.length < 12 || new TextEncoder().encode(value).length > 72)) errors[field.key] = 'Usa entre 12 caracteres y 72 bytes UTF-8.';
    if (field.type === 'date' && value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) errors[field.key] = 'Usa una fecha válida.';
    if (field.type === 'number' && value && !Number.isInteger(Number(value))) errors[field.key] = 'Ingresa un número entero.';
  });
  return errors;
}

function Editor({ resource, item, mode = 'data', onClose, onSaved, user }) {
  const { api } = useAuth();
  const isEdit = Boolean(item);
  const isStudent = resource.path === '/students';
  const fields = (isEdit ? mode === 'status' ? resource.statusEdit : resource.edit : resource.create).filter((field) => !(field.key === 'userId' && isStudent && user.role !== 'ADMIN'));
  const [values, setValues] = useState(() => Object.fromEntries(fields.map((field) => [field.key, initialValue(field, item)])));
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(null);
  const editorRef = useRef(null);
  useEffect(() => { editorRef.current?.querySelector('input, select')?.focus(); }, []);

  async function send(body) {
    setBusy(true);
    try {
      const path = isEdit ? resource.path + `/${item.id}${mode === 'status' ? '/status' : ''}` : resource.path;
      await api(path, { method: isEdit ? 'PATCH' : 'POST', body });
      onSaved(isEdit ? 'Cambios guardados.' : 'Registro creado.');
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }

  function save(event) {
    event.preventDefault(); setError('');
    const invalid = validate(fields, values, isEdit);
    if (Object.keys(invalid).length) { setErrors(invalid); return; }
    setErrors({});
    const body = {};
    fields.forEach((field) => {
      const value = values[field.key];
      if (isEdit && value === initialValue(field, item)) return;
      if (!isEdit && field.optional && !value) return;
      body[field.key] = field.type === 'number' || field.key === 'term' ? Number(value) : field.optional && value === '' ? null : value;
    });
    if (isEdit && Object.keys(body).length === 0) { setError('No hay cambios para guardar.'); return; }
    if (isEdit && ((body.isActive === false && item.isActive) || (body.status === 'CANCELLED' && item.status !== 'CANCELLED'))) {
      setPending(body); return;
    }
    send(body);
  }

  const name = singularNames[resource.path.slice(1)];
  const title = isEdit ? resource.path === '/users' ? mode === 'status' ? 'Cambiar estado de cuenta' : 'Editar datos de cuenta' : `Editar ${name}` : name === 'estudiante' || name === 'matrícula' || name === 'calificación' || name === 'asistencia' ? `Registrar ${name}` : `Crear ${name}`;
  return <section ref={editorRef} className="panel resource-editor" aria-label={title}>
    <div className="resource-editor-heading"><h2>{title}</h2><button type="button" className="icon-button" aria-label="Cerrar formulario" onClick={onClose}><Icon name="close" size={16} /></button></div>
    {isEdit && resource.path === '/enrollments' && <p className="enrollment-editor-student"><StudentIdentity student={item.student} /></p>}
    {isEdit && isStudent && <p className="form-help">Cuenta vinculada: {item.user ? `${item.user.firstName} ${item.user.lastName} · ${item.user.email}` : 'Sin cuenta vinculada'}</p>}
    <form onSubmit={save}><div className="editor-fields">
      {fields.map((field) => <FormField key={field.key} field={field} value={values[field.key]} onChange={(value) => setValues((current) => ({ ...current, [field.key]: value }))} error={errors[field.key]} disabled={busy} />)}
      {isStudent && !isEdit && <p className="form-help"><Icon name="info" size={16} />Puedes registrar al estudiante sin vincular una cuenta de acceso.</p>}
      <div className="editor-footer"><Notice message={error} /><div className="form-actions"><Button variant="secondary" onClick={onClose} disabled={busy}>Cancelar</Button><Button type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</Button></div></div>
    </div></form>
    {pending && <ConfirmDialog title={pending.status === 'CANCELLED' ? 'Cancelar matrícula' : 'Desactivar registro'} message={pending.status === 'CANCELLED' ? '¿Cancelar esta matrícula? Los datos históricos se conservarán.' : '¿Desactivar este registro? Sus datos se conservarán.'} busy={busy} onCancel={() => setPending(null)} onConfirm={() => { const body = pending; setPending(null); send(body); }} />}
  </section>;
}

export default function ResourcePage({ resourceKey }) {
  const { api, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const resource = resources[resourceKey];
  const isStudent = resourceKey === 'students';
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState({});
  const [draft, setDraft] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editor, setEditor] = useState(undefined);
  const [editMode, setEditMode] = useState('data');
  const [detail, setDetail] = useState(null);
  const requestGeneration = useRef(0);
  const [referenceRows, setReferenceRows] = useState({});
  const [revision, setRevision] = useState(0);
  const allowedFilters = useMemo(() => (resource.filters || []).filter((field) => field.type !== 'ref' || resources[field.resource]?.roles.includes(user.role)), [resource, user.role]);
  const canWrite = resource.write.includes(user.role);
  const canCreateHere = canWrite && user.role !== 'DOCENTE';
  const reload = useCallback(() => setRevision((n) => n + 1), []);

  useEffect(() => {
    let live = true; const generation = ++requestGeneration.current; setLoading(true); setError('');
    api(resource.path, { params: { ...(resource.paginated ? { page, limit: 20 } : {}), ...filter } })
      .then((payload) => { if (live && generation === requestGeneration.current) { setRows(listData(resource, payload)); setPagination(payload.pagination || null); } })
      .catch((failure) => { if (live && generation === requestGeneration.current) setError(failure.status === 403 && user.role === 'ESTUDIANTE' ? 'No tienes un perfil de estudiante vinculado a esta cuenta.' : failure.message); })
      .finally(() => { if (live && generation === requestGeneration.current) setLoading(false); });
    return () => { live = false; };
  }, [api, resource, page, filter, revision, user.role]);

  useEffect(() => {
    const id = resourceKey === 'users' ? searchParams.get('edit') : null;
    if (!id) return;
    let live = true;
    api(`/users/${id}`).then(({ user: account }) => {
      if (live) { setEditor(account); setEditMode('data'); setError(''); }
    }).catch((failure) => { if (live) setError(failure.message); });
    return () => { live = false; };
  }, [api, resourceKey, searchParams]);

  useEffect(() => {
    if (resourceKey !== 'sections' && resourceKey !== 'grades') return;
    let live = true;
    const refs = resourceKey === 'sections' ? ['grades', 'academic-periods', 'education-levels'] : ['education-levels'];
    Promise.all(refs.map(async (key) => [key, listData(resources[key], await api(resources[key].path))])).then((entries) => { if (live) setReferenceRows(Object.fromEntries(entries)); }).catch(() => {});
    return () => { live = false; };
  }, [api, resourceKey]);

  async function showDetail(row) {
    setError(''); setSuccess('');
    try { const result = await api(`${resource.path}/${row.id}`); setDetail(result.item || result.data || result.user || row); }
    catch (failure) { setError(failure.message); }
  }
  function invalidateList() { requestGeneration.current += 1; setRows([]); setPagination(null); setLoading(true); setDetail(null); setError(''); }
  function applyFilters(event) { event.preventDefault(); invalidateList(); setPage(1); setFilter(Object.fromEntries(Object.entries(draft).filter(([, value]) => value !== ''))); }
  function clearFilters() { invalidateList(); setDraft({}); setFilter({}); setPage(1); }
  function changePage(nextPage) { invalidateList(); setPage(nextPage); }
  function closeEditor() { setEditor(undefined); if (resourceKey === 'users' && searchParams.has('edit')) setSearchParams({}, { replace: true }); }
  function saved(message) { closeEditor(); setDetail(null); setError(''); setSuccess(message); reload(); }
  const readableTitle = user.role === 'ESTUDIANTE' ? resourceKey === 'grade-records' ? 'Mis calificaciones' : 'Mi asistencia' : resource.title;
  const createLabel = ['students', 'enrollments', 'grade-records', 'attendance-records'].includes(resourceKey) ? `Registrar ${singularNames[resourceKey]}` : `Crear ${singularNames[resourceKey]}`;
  const subtitle = user.role === 'ESTUDIANTE' ? resourceKey === 'grade-records' ? 'Consulta tus calificaciones por curso y bimestre.' : 'Consulta tu asistencia por curso y fecha.' : descriptions[resourceKey];
  const emptyMessage = Object.keys(filter).length ? 'No se encontraron resultados. Ajusta o limpia los filtros.' : user.role === 'ESTUDIANTE' ? resourceKey === 'grade-records' ? 'Aún no tienes calificaciones registradas.' : 'Aún no tienes asistencia registrada.' : 'Aún no hay registros disponibles.';
  const activeFilter = ['users', 'education-levels', 'grades', 'academic-periods', 'sections', 'students', 'teachers', 'courses', 'teaching-assignments'].includes(resourceKey);
  const renderCell = (row, key) => resourceKey === 'enrollments' && key === 'student'
    ? <StudentIdentity student={row.student} />
    : resourceKey === 'students' && key === 'user' ? <span className="account-identity">{row.user ? <><strong>{row.user.firstName} {row.user.lastName}</strong><span>{row.user.email}</span></> : 'Sin cuenta vinculada'}</span>
    : resourceKey === 'sections' && key === 'name' && row.name?.toLocaleUpperCase('es') === 'ÚNICA' ? 'Sin división'
    : key === 'isActive' || (resourceKey === 'enrollments' && key === 'status') ? <StatusBadge value={row[key]} /> : displayValue(row, key, referenceRows);

  return <div>
    <PageHeader eyebrow={user.role === 'ESTUDIANTE' ? 'Mi información' : 'Gestión académica'} title={readableTitle} subtitle={subtitle} action={canCreateHere && <Button icon="plus" onClick={() => { setEditor(null); setEditMode('data'); setError(''); setSuccess(''); }}>{createLabel}</Button>} />
    <Notice message={success} kind="success" /><Notice message={error} />
    {user.role === 'SECRETARIA' && isStudent && <Notice kind="info" message="Puedes registrar estudiantes sin cuenta. La vinculación de una cuenta requiere un administrador." />}
    {(resource.search || resource.filters || resource.paginated || activeFilter) && <FilterPanel onSubmit={applyFilters} onClear={Object.values(draft).some((value) => value !== '') || Object.keys(filter).length ? clearFilters : undefined}>
      {resource.search && <div className="filter-search"><label className="label" htmlFor="search">{isStudent ? 'Buscar por código o nombre' : resourceKey === 'users' ? 'Buscar por nombre o correo' : 'Buscar'}</label><div className="filter-search-field"><Icon name="search" size={16} className="filter-search-icon" /><input id="search" className="input" placeholder={isStudent ? 'Código o nombre' : resourceKey === 'users' ? 'Nombre, apellido o correo' : 'Buscar'} value={draft.search || ''} onChange={(e) => setDraft((v) => ({ ...v, search: e.target.value }))} /></div></div>}
      {activeFilter && <div><label className="label" htmlFor="active-filter">Estado</label><select id="active-filter" className="input" value={draft.isActive || ''} onChange={(e) => setDraft((v) => ({ ...v, isActive: e.target.value }))}><option value="">Todos</option><option value="true">Activos</option><option value="false">{resourceKey === 'academic-periods' ? 'Históricos' : 'Inactivos'}</option></select></div>}
      {allowedFilters.map((field) => <div key={field.key}><label className="label" htmlFor={`filter-${field.key}`}>{field.label}</label>{field.type === 'ref' ? <ReferenceField field={{ ...field, filter: true }} id={`filter-${field.key}`} value={draft[field.key] || ''} onChange={(value) => { setDraft((current) => ({ ...current, [field.key]: value })); if (resourceKey === 'grades' && field.key === 'educationLevelId') { invalidateList(); setPage(1); setFilter((current) => { const next = { ...current }; if (value) next.educationLevelId = value; else delete next.educationLevelId; return next; }); } }} /> : <select id={`filter-${field.key}`} className="input" value={draft[field.key] || ''} onChange={(event) => setDraft((current) => ({ ...current, [field.key]: event.target.value }))}><option value="">Todos</option>{field.options.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>}</div>)}
    </FilterPanel>}
    {detail && <section className="panel panel-pad mb-4"><div className="resource-editor-heading"><h2>Detalle</h2><button type="button" className="icon-button" aria-label="Cerrar detalle" onClick={() => setDetail(null)}><Icon name="close" size={16} /></button></div><dl className="grid gap-3 sm:grid-cols-2">{resource.columns.map(([key, label]) => <div key={key}><dt className="label">{label}</dt><dd>{renderCell(detail, key)}</dd></div>)}</dl>{isStudent && user.role === 'ADMIN' && detail.user && <Link className="text-link" to={`/users?edit=${detail.user.id}`}>Editar cuenta vinculada</Link>}</section>}
    <div className={`resource-body ${editor !== undefined ? 'has-editor' : ''} ${resourceKey === 'users' ? 'resource-body-users' : ''}`}>
      <section className="panel resource-list"><div className="resource-list-heading"><h2>Resultados</h2><span>{pagination ? `Mostrando ${rows.length} de ${pagination.total}` : `${rows.length} registros`}</span></div>
        {loading ? <Spinner /> : rows.length === 0 ? <EmptyState message={emptyMessage} /> : <DataTable columns={resource.columns} rows={rows} renderCell={renderCell} renderActions={(row) => <><button type="button" className="text-link" onClick={() => showDetail(row)}>Ver</button>{canWrite && user.role !== 'DOCENTE' && <button type="button" className="text-link" onClick={() => { setEditor(row); setEditMode('data'); setError(''); setSuccess(''); }}>{resourceKey === 'users' ? 'Editar cuenta' : 'Editar'}</button>}{resourceKey === 'users' && row.id !== user.id && <button type="button" className="text-link" onClick={() => { setEditor(row); setEditMode('status'); setError(''); setSuccess(''); }}>Cambiar estado</button>}</>} />}
        <Pager pagination={pagination} onPage={changePage} />
      </section>
      {editor !== undefined && <Editor key={`${resourceKey}-${editor?.id || 'new'}-${editMode}`} resource={resource} item={editor} mode={editMode} user={user} onClose={closeEditor} onSaved={saved} />}
    </div>
  </div>;
}
