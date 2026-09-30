import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { listData, refLabel, resources } from '../services/resources';
import Icon from './Icon';

export function Button({ children, variant = 'primary', icon, className = '', type = 'button', ...props }) {
  return <button type={type} className={`btn-${variant} ${className}`.trim()} {...props}>{icon && <Icon name={icon} size={17} />}{children}</button>;
}

export function PageHeader({ title, subtitle, action, eyebrow }) {
  return <div className="page-header"><div className="min-w-0">{eyebrow && <p className="page-eyebrow">{eyebrow}</p>}<h1>{title}</h1>{subtitle && <p className="page-subtitle">{subtitle}</p>}</div>{action && <div className="page-action">{action}</div>}</div>;
}

export function Notice({ message, kind = 'error' }) {
  if (!message) return null;
  return <p role={kind === 'error' ? 'alert' : 'status'} className={`notice notice-${kind}`}><Icon name="info" size={17} />{message}</p>;
}

export function Spinner() { return <p role="status" className="loading-state"><span className="loading-dot" />Cargando…</p>; }

export function EmptyState({ message = 'No hay registros para mostrar.' }) {
  return <div className="empty-state"><Icon name="info" size={23} /><p>{message}</p></div>;
}

export function StatusBadge({ value }) {
  const active = value === true || value === 'ACTIVE';
  const label = typeof value === 'boolean' ? value ? 'Activo' : 'Inactivo' : value === 'ACTIVE' ? 'Activa' : value === 'CANCELLED' ? 'Cancelada' : String(value);
  return <span className={`status-badge ${active ? 'status-active' : 'status-inactive'}`}>{label}</span>;
}

export function DataTable({ columns, rows, renderCell, renderActions }) {
  return <table className="data-table"><thead><tr>{columns.map(([, label]) => <th scope="col" key={label}>{label}</th>)}<th scope="col">Acciones</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}>{columns.map(([key, label]) => <td key={key} data-label={label}>{renderCell(row, key)}</td>)}<td data-label="Acciones" className="row-actions">{renderActions(row)}</td></tr>)}</tbody></table>;
}

export function FilterPanel({ children, onSubmit }) {
  return <form className="filter-panel" onSubmit={onSubmit}>{children}<Button variant="secondary" type="submit" className="filter-submit">Aplicar filtros</Button></form>;
}

export function ConfirmDialog({ title, message, onCancel, onConfirm, busy }) {
  const cancelRef = useRef(null);
  useEffect(() => { cancelRef.current?.focus(); }, []);
  useEffect(() => {
    function onKey(event) { if (event.key === 'Escape' && !busy) onCancel(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [busy, onCancel]);
  return <div className="dialog-backdrop"><section role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-message" className="confirm-dialog panel"><h2 id="confirm-title">{title}</h2><p id="confirm-message">{message}</p><div className="form-actions"><Button ref={cancelRef} variant="secondary" onClick={onCancel} disabled={busy}>Volver</Button><Button variant="danger" onClick={onConfirm} disabled={busy}>{busy ? 'Guardando…' : 'Confirmar'}</Button></div></section></div>;
}

export function Pager({ pagination, onPage }) {
  if (!pagination) return null;
  return <div className="pager">
    <span>Página {pagination.page} de {Math.max(1, pagination.totalPages)} · {pagination.total} registros</span>
    <div className="pager-actions"><Button variant="secondary" icon="chevronLeft" disabled={pagination.page <= 1} onClick={() => onPage(pagination.page - 1)}>Anterior</Button><Button variant="secondary" disabled={pagination.page >= pagination.totalPages} onClick={() => onPage(pagination.page + 1)}>Siguiente<Icon name="chevronRight" size={16} /></Button></div>
  </div>;
}

export function ReferenceField({ field, value, onChange, disabled, id }) {
  const { api } = useAuth();
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(false);
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    async function load() {
      if (field.resource === 'student-users' || field.resource === 'teacher-users') {
        const profilePath = field.resource === 'teacher-users' ? '/teachers' : '/students';
        const usersResult = await api('/users');
        const profiles = [];
        let profilePage = 1;
        let totalPages = 1;
        do {
          const result = await api(profilePath, { params: { page: profilePage, limit: 100 } });
          profiles.push(...result.data);
          totalPages = result.pagination.totalPages;
          profilePage += 1;
        } while (profilePage <= totalPages);
        const used = new Set(profiles.map((item) => item.userId).filter(Boolean));
        return { data: usersResult.users.filter((user) => user.isActive && user.role === (field.resource === 'teacher-users' ? 'DOCENTE' : 'ESTUDIANTE') && (!used.has(user.id) || user.id === value)), more: false };
      }
      const resource = resources[field.resource];
      const params = resource.paginated ? { page, limit: 100, ...(resource.search && search ? { search } : {}) } : {};
      const result = await api(resource.path, { params });
      let data = listData(resource, result);
      if (field.resource === 'sections') {
        const [grades, periods, levels] = await Promise.all([api('/grades'), api('/academic-periods'), api('/education-levels')]);
        data = data.map((section) => ({ ...section,
          grade: { ...grades.items.find((grade) => grade.id === section.gradeId), educationLevel: levels.items.find((level) => level.id === grades.items.find((grade) => grade.id === section.gradeId)?.educationLevelId) },
          academicPeriod: periods.items.find((period) => period.id === section.academicPeriodId),
        }));
      } else if (field.resource === 'grades') {
        const levels = await api('/education-levels');
        data = data.map((grade) => ({ ...grade, educationLevel: levels.items.find((level) => level.id === grade.educationLevelId) }));
      }
      return { data, more: Boolean(result.pagination && page < result.pagination.totalPages) };
    }
    load().then((result) => { if (active) { setOptions(result.data); setMore(result.more); } }).catch((e) => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [api, field.resource, page, search, value]);
  return <div className="space-y-2">
    {resources[field.resource]?.search && <input className="input" aria-label={`Buscar ${field.label.toLowerCase()}`} placeholder="Buscar opción" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />}
    <select id={id} className="input" value={value ?? ''} onChange={(e) => onChange(e.target.value)} disabled={disabled || loading}>
      <option value="">{loading ? 'Cargando opciones…' : field.filter ? 'Todos' : field.optional ? 'Sin cuenta vinculada' : 'Selecciona una opción'}</option>
      {value && !options.some((option) => option.id === value) && <option value={value}>Selección actual</option>}
      {options.map((option) => <option key={option.id} value={option.id}>{field.resource.endsWith('-users') ? `${option.firstName} ${option.lastName} · ${option.email}` : refLabel(field.resource, option)}</option>)}
    </select>
    {(page > 1 || more) && <div className="reference-pagination">
      {page > 1 && <button type="button" className="text-link" onClick={() => setPage(page - 1)}>Opciones anteriores</button>}
      {more && <button type="button" className="text-link" onClick={() => setPage(page + 1)}>Más opciones</button>}
    </div>}
    <Notice message={error} />
  </div>;
}

export function FormField({ field, value, onChange, error, disabled }) {
  const id = `field-${field.key}`;
  return <div className="form-field">
    <label htmlFor={id} className="label" data-required={!field.optional && field.type !== 'checkbox' ? 'true' : undefined}>{field.label}</label>
    {field.type === 'ref' ? <ReferenceField field={field} value={value} onChange={onChange} disabled={disabled} id={id} />
      : field.type === 'choice' ? <select id={id} className="input" value={value ?? ''} onChange={(e) => onChange(e.target.value)} disabled={disabled}><option value="">Selecciona</option>{field.options.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
        : field.type === 'checkbox' ? <select id={id} className="input" value={value ? 'true' : 'false'} onChange={(e) => onChange(e.target.value === 'true')} disabled={disabled}><option value="true">Activo</option><option value="false">Inactivo</option></select>
          : <input id={id} className="input" type={field.type} value={value ?? ''} onChange={(e) => onChange(e.target.value)} disabled={disabled} autoComplete={field.type === 'password' ? 'new-password' : undefined} />}
    {error && <p className="field-error" id={`${id}-error`}>{error}</p>}
  </div>;
}
