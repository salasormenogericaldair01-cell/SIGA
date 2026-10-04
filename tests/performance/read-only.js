import http from 'k6/http';
import { Counter } from 'k6/metrics';
import { check, sleep } from 'k6';

const serverErrors = new Counter('server_errors');
const base = 'http://127.0.0.1:3000/api';
if (__ENV.K6_BASE_URL !== base) {
  throw new Error('Carga permitida únicamente contra http://127.0.0.1:3000/api');
}
for (const key of ['K6_ADMIN_TOKEN', 'K6_TEACHER_TOKEN', 'K6_STUDENT_TOKEN', 'K6_ASSIGNMENT_ID']) {
  if (!__ENV[key]) throw new Error(`Falta ${key} local`);
}
if (!/^[0-9a-f-]{36}$/i.test(__ENV.K6_ASSIGNMENT_ID)) throw new Error('ID de asignación inválido');

const tokens = [__ENV.K6_ADMIN_TOKEN, __ENV.K6_TEACHER_TOKEN, __ENV.K6_STUDENT_TOKEN];
const thresholds = {
  http_req_failed: [{ threshold: 'rate<0.01', abortOnFail: true, delayAbortEval: '10s' }],
  http_req_duration: [{ threshold: 'p(95)<1000', abortOnFail: true, delayAbortEval: '10s' }],
  checks: [{ threshold: 'rate>0.99', abortOnFail: true, delayAbortEval: '10s' }],
  server_errors: [{ threshold: 'count==0', abortOnFail: true, delayAbortEval: '1s' }],
};
const summaryTrendStats = ['avg', 'min', 'med', 'max', 'p(50)', 'p(95)', 'p(99)'];

export function profile(vus, duration) {
  if (!__ENV.K6_STAGES) return { vus, duration, thresholds, summaryTrendStats };
  if (__ENV.K6_STAGES.split(',').length > 8) throw new Error('Máximo 8 escalones');
  const stages = __ENV.K6_STAGES.split(',').map((item) => {
    const match = /^(\d+[smh]):(\d+)$/.exec(item.trim());
    if (!match || Number(match[2]) > 30) throw new Error('K6_STAGES debe ser duración:VUs, máximo 30 VUs');
    return { duration: match[1], target: Number(match[2]) };
  });
  const totalSeconds = stages.reduce((total, stage) => {
    const unit = stage.duration.slice(-1);
    return total + Number(stage.duration.slice(0, -1)) * (unit === 'h' ? 3600 : unit === 'm' ? 60 : 1);
  }, 0);
  if (totalSeconds > 600) throw new Error('Los escalones no pueden superar 10 minutos');
  return { stages, thresholds, summaryTrendStats };
}

export default function run() {
  const role = (__VU + __ITER) % 3;
  const reads = role === 0 ? [
    '/auth/me', '/education-levels', '/grades', '/academic-periods', '/sections',
    '/courses?page=1&limit=20', '/teaching-assignments?page=1&limit=20',
    '/enrollments?page=1&limit=20', '/grade-records?page=1&limit=20', '/attendance-records?page=1&limit=20',
  ] : role === 1 ? [
    '/auth/me', '/courses?page=1&limit=20', '/teaching-assignments?page=1&limit=20',
    `/teaching-assignments/${__ENV.K6_ASSIGNMENT_ID}/enrollments?status=ACTIVE&page=1&limit=20`,
    `/grade-records?teachingAssignmentId=${__ENV.K6_ASSIGNMENT_ID}&page=1&limit=20`,
    `/attendance-records?teachingAssignmentId=${__ENV.K6_ASSIGNMENT_ID}&page=1&limit=20`,
  ] : ['/auth/me', '/grade-records?page=1&limit=20', '/attendance-records?page=1&limit=20'];
  for (const path of ['/health', ...reads]) {
    const response = http.get(`${base}${path}`, {
      headers: path === '/health' ? {} : { Authorization: `Bearer ${tokens[role]}` },
      timeout: '10s',
      tags: { endpoint: path.split('?')[0] },
    });
    serverErrors.add(response.status >= 500 ? 1 : 0);
    check(response, { 'HTTP 200': (result) => result.status === 200 });
  }
  sleep(1);
}

export function handleSummary(data) {
  const requests = data.metrics.http_reqs?.values || {};
  const latency = data.metrics.http_req_duration?.values || {};
  const failures = data.metrics.http_req_failed?.values || {};
  const errors = data.metrics.server_errors?.values || {};
  const connecting = data.metrics.http_req_connecting?.values || {};
  const checks = data.metrics.checks?.values || {};
  return { stdout: `solicitudes=${requests.count ?? 0} RPS=${requests.rate ?? 'n/a'} p50=${latency['p(50)'] ?? 'n/a'}ms p95=${latency['p(95)'] ?? 'n/a'}ms p99=${latency['p(99)'] ?? 'n/a'}ms máximo=${latency.max ?? 'n/a'}ms conexión_p95=${connecting['p(95)'] ?? 'n/a'}ms errores=${failures.passes ?? 0} comprobaciones=${checks.rate ?? 'n/a'} HTTP_5xx=${errors.count ?? 0}\n` };
}
