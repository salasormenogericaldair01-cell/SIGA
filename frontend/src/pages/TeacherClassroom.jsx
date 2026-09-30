import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { Notice, PageHeader, Pager, Spinner, StatusBadge } from '../components/Ui';
import { assignmentLabel, attendance, dateOnly, person } from '../utils/format';

const kinds = {
  grades: { path: '/grade-records', title: 'Calificaciones', value: 'value', choices: [['AD', 'AD'], ['A', 'A'], ['B', 'B'], ['C', 'C']] },
  attendance: { path: '/attendance-records', title: 'Asistencia', value: 'status', choices: Object.entries(attendance) },
};

export default function TeacherClassroom() {
  const { api } = useAuth();
  const [assignments, setAssignments] = useState([]);
  const [assignment, setAssignment] = useState(null);
  const [assignmentPage, setAssignmentPage] = useState(1);
  const [assignmentPagination, setAssignmentPagination] = useState(null);
  const [roster, setRoster] = useState([]);
  const [rosterPage, setRosterPage] = useState(1);
  const [rosterPagination, setRosterPagination] = useState(null);
  const [kind, setKind] = useState('grades');
  const [records, setRecords] = useState([]);
  const [recordPage, setRecordPage] = useState(1);
  const [recordPagination, setRecordPagination] = useState(null);
  const [enrollmentId, setEnrollmentId] = useState('');
  const [term, setTerm] = useState('1');
  const [day, setDay] = useState('');
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const config = kinds[kind];
  useEffect(() => {
    let live = true; setLoading(true);
    api('/teaching-assignments', { params: { page: assignmentPage, limit: 20 } }).then((result) => {
      if (live) { setAssignments(result.data); setAssignmentPagination(result.pagination); }
    }).catch((failure) => { if (live) setError(failure.message); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [api, assignmentPage, revision]);
  useEffect(() => {
    if (!assignment) return;
    let live = true;
    api(`/teaching-assignments/${assignment.id}/enrollments`, { params: { status: 'ACTIVE', page: rosterPage, limit: 100 } }).then((result) => {
      if (live) { setRoster(result.data); setRosterPagination(result.pagination); }
    }).catch((failure) => { if (live) setError(failure.message); });
    return () => { live = false; };
  }, [api, assignment, rosterPage, revision]);
  useEffect(() => {
    if (!assignment) return;
    let live = true; setLoading(true);
    api(config.path, { params: { teachingAssignmentId: assignment.id, page: recordPage, limit: 20 } }).then((result) => {
      if (live) { setRecords(result.data); setRecordPagination(result.pagination); }
    }).catch((failure) => { if (live) setError(failure.message); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [api, assignment, config.path, recordPage, revision]);
  async function save(event) {
    event.preventDefault(); setError(''); setSuccess('');
    if (!assignment?.isActive) { setError('La asignación está inactiva.'); return; }
    if (!enrollmentId || !value || (kind === 'attendance' && !day)) { setError('Completa los campos obligatorios.'); return; }
    setBusy(true);
    try {
      await api(config.path, { method: 'POST', body: { teachingAssignmentId: assignment.id, enrollmentId, ...(kind === 'grades' ? { term: Number(term), value } : { date: day, status: value }) } });
      setSuccess('Registro guardado.'); setValue(''); setRevision((n) => n + 1);
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  async function correct(record, next) {
    if (!next || next === record[config.value]) return;
    setError(''); setBusy(true);
    try { await api(`${config.path}/${record.id}`, { method: 'PATCH', body: { [config.value]: next } }); setSuccess('Corrección guardada.'); setRevision((n) => n + 1); }
    catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  return <div className="space-y-5"><PageHeader title="Mi aula" subtitle="Consulta tus asignaciones y registra notas o asistencia individuales." /><Notice message={error} /><Notice message={success} kind="success" />
    <section className="panel"><h2 className="mb-3 text-xl font-bold">Mis asignaciones</h2>{loading && !assignment ? <Spinner /> : assignments.length === 0 ? <p>No tienes asignaciones en esta página.</p> : <div className="grid gap-3 md:grid-cols-2">{assignments.map((item) => <button key={item.id} className={`module-card text-left ${assignment?.id === item.id ? 'border-[#C2410C] bg-orange-50' : ''}`} onClick={() => { setAssignment(item); setRosterPage(1); setRecordPage(1); setError(''); }}><span className="module-copy"><strong>{assignmentLabel(item)}</strong><small>{item.isActive ? 'Activa' : 'Inactiva · solo consulta'}</small></span></button>)}</div>}<Pager pagination={assignmentPagination} onPage={setAssignmentPage} /></section>
    {assignment && <><section className="panel"><h2 className="text-xl font-bold">{assignmentLabel(assignment)}</h2><p className="mt-2 text-sm text-slate-600">Periodo: {assignment.section?.academicPeriod?.name} · Docente: {person(assignment.teacher?.user)}</p></section>
      <section className="panel"><h2 className="mb-3 text-xl font-bold">Estudiantes matriculados</h2>{roster.length === 0 ? <p className="text-slate-600">No hay matrículas activas en esta página.</p> : <table className="data-table"><thead><tr><th>Código</th><th>Estudiante</th><th>Estado</th></tr></thead><tbody>{roster.map((item) => <tr key={item.id}><td data-label="Código">{item.student.studentCode}</td><td data-label="Estudiante">{person(item.student)}</td><td data-label="Estado"><StatusBadge value="ACTIVE" /></td></tr>)}</tbody></table>}<Pager pagination={rosterPagination} onPage={setRosterPage} /></section>
      <section className="panel space-y-4"><div className="flex flex-wrap gap-2">{Object.entries(kinds).map(([key, option]) => <button key={key} className={kind === key ? 'btn-primary' : 'btn-secondary'} onClick={() => { setKind(key); setRecordPage(1); setValue(''); }}>{option.title}</button>)}</div>
        <h2 className="text-xl font-bold">Registrar {config.title.toLowerCase()}</h2>
        {assignment.isActive ? <form onSubmit={save} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><div><label className="label" htmlFor="roster-student">Estudiante</label><select id="roster-student" className="input" value={enrollmentId} onChange={(e) => setEnrollmentId(e.target.value)}><option value="">Selecciona</option>{roster.map((item) => <option key={item.id} value={item.id}>{item.student.studentCode} · {person(item.student)}</option>)}</select></div>
          {kind === 'grades' ? <div><label className="label" htmlFor="term">Bimestre</label><select id="term" className="input" value={term} onChange={(e) => setTerm(e.target.value)}>{[1, 2, 3, 4].map((number) => <option key={number} value={number}>{number}</option>)}</select></div> : <div><label className="label" htmlFor="attendance-day">Fecha</label><input id="attendance-day" className="input" type="date" value={day} onChange={(e) => setDay(e.target.value)} /></div>}
          <div><label className="label" htmlFor="record-value">{kind === 'grades' ? 'Nota' : 'Estado'}</label><select id="record-value" className="input" value={value} onChange={(e) => setValue(e.target.value)}><option value="">Selecciona</option>{config.choices.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div><div className="flex items-end"><button className="btn-primary w-full" disabled={busy || roster.length === 0}>{busy ? 'Guardando…' : 'Guardar'}</button></div></form> : <p className="text-slate-600">La asignación inactiva permite consultar registros históricos, pero no escribir.</p>}
        <h3 className="border-t pt-4 text-lg font-bold">Registros</h3>{loading ? <Spinner /> : records.length === 0 ? <p className="text-slate-600">Todavía no hay registros.</p> : <table className="data-table"><thead><tr><th>Estudiante</th><th>{kind === 'grades' ? 'Bimestre' : 'Fecha'}</th><th>{kind === 'grades' ? 'Nota' : 'Estado'}</th><th>Corregir</th></tr></thead><tbody>{records.map((record) => <tr key={record.id}><td data-label="Estudiante">{person(record.enrollment?.student)}</td><td data-label={kind === 'grades' ? 'Bimestre' : 'Fecha'}>{kind === 'grades' ? record.term : dateOnly(record.date)}</td><td data-label={kind === 'grades' ? 'Nota' : 'Estado'}>{kind === 'grades' ? record.value : attendance[record.status]}</td><td data-label="Corregir"><select aria-label={`Corregir ${person(record.enrollment?.student)}`} className="input max-w-36" value={record[config.value]} disabled={busy || !assignment.isActive} onChange={(e) => correct(record, e.target.value)}>{config.choices.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></td></tr>)}</tbody></table>}<Pager pagination={recordPagination} onPage={setRecordPage} />
      </section></>}
  </div>;
}
