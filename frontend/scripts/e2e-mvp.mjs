import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { chromium } from 'playwright-core';

const requireBackend = createRequire(new URL('../../backend/package.json', import.meta.url));
const { PrismaClient } = requireBackend('@prisma/client');
const verifyTarget = requireBackend('./scripts/verify-demo-target');
const prisma = new PrismaClient();
const apiBase = 'http://localhost:3010/api';
const frontendBase = 'http://localhost:5174';
const suffix = randomUUID().slice(0, 8);
const ids = { attendanceRecord: [], gradeRecord: [], enrollment: [], teachingAssignment: [], course: [], section: [], academicPeriod: [], grade: [], educationLevel: [], teacher: [], student: [], user: [] };
let browser;
let originalTeacherId;
let changedAssignmentId;
let adminToken;
let currentPage;

function remember(kind, id) { ids[kind].push(id); return id; }
async function api(pathname, { token, method = 'GET', body } = {}) {
  const response = await fetch(`${apiBase}${pathname}`, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const payload = await response.json().catch(() => ({}));
  return { status: response.status, payload };
}
async function login(email, password) {
  const result = await api('/auth/login', { method: 'POST', body: { email, password } });
  assert.equal(result.status, 200, `No se pudo iniciar sesión DEMO: ${email}`);
  return result.payload.token;
}
async function expectStatus(pathname, token, status, method = 'GET', body) {
  const response = await api(pathname, { token, method, body });
  assert.equal(response.status, status, `${method} ${pathname}: se esperaba ${status}, llegó ${response.status}`);
  return response.payload;
}
async function uiLogin(page, email, password) {
  await page.goto(`${frontendBase}/login`);
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await page.getByText('Bienvenido, Demo').waitFor();
}
async function uiSession(page, token) {
  await page.goto(`${frontendBase}/login`);
  await page.evaluate((value) => sessionStorage.setItem('siga_token', value), token);
  await page.goto(frontendBase);
  await page.getByText('Bienvenido, Demo').waitFor();
}
async function openModule(page, name) {
  await page.locator('aside').getByRole('link', { name }).click();
  await page.getByRole('heading', { name }).first().waitFor();
}
function watchPage(page, errors) {
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && !/401|403|409|Failed to load resource/.test(message.text())) errors.push(`Consola: ${message.text().slice(0, 120)}`);
  });
  page.on('response', (response) => {
    if (response.status() >= 500) errors.push(`HTTP ${response.status()} ${new URL(response.url()).pathname}`);
  });
  page.on('requestfailed', (request) => {
    if (!/ERR_ABORTED/.test(request.failure()?.errorText || '')) errors.push(`Petición fallida: ${new URL(request.url()).pathname}`);
  });
}
async function createFromEditor(page, pathname, kind) {
  const [response] = await Promise.all([
    page.waitForResponse((item) => new URL(item.url()).pathname === `/api${pathname}` && item.request().method() === 'POST'),
    page.locator('.resource-editor').getByRole('button', { name: 'Guardar' }).click(),
  ]);
  assert.equal(response.status(), 201, `No se creó ${kind} desde el navegador`);
  const payload = await response.json();
  const record = payload.user || payload.item || payload.data;
  remember(kind, record.id);
  await page.getByText('Registro creado.').waitFor();
  return record;
}
async function cleanup() {
  await verifyTarget(prisma, 'siga_test');
  if (changedAssignmentId && originalTeacherId) {
    await prisma.teachingAssignment.update({ where: { id: changedAssignmentId }, data: { teacherId: originalTeacherId } });
  }
  for (const kind of Object.keys(ids)) {
    if (ids[kind].length) await prisma[kind].deleteMany({ where: { id: { in: ids[kind] } } });
  }
}

try {
  await verifyTarget(prisma, 'siga_test');
  const credentials = {
    admin: ['demo-admin@siga.invalid', process.env.DEMO_ADMIN_PASSWORD],
    secretaria: ['demo-secretaria@siga.invalid', process.env.DEMO_SECRETARIA_PASSWORD],
    docenteA: ['demo-docente-a@siga.invalid', process.env.DEMO_DOCENTE_A_PASSWORD],
    docenteB: ['demo-docente-b@siga.invalid', process.env.DEMO_DOCENTE_B_PASSWORD],
    estudianteA: ['demo-estudiante-a@siga.invalid', process.env.DEMO_ESTUDIANTE_A_PASSWORD],
  };
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const errors = [];
  const desktop = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await desktop.newPage();
  currentPage = page;
  watchPage(page, errors);
  await page.goto(`${frontendBase}/login`);
  await page.screenshot({ path: path.join(os.tmpdir(), 'siga-mvp-login.png') });
  await uiLogin(page, ...credentials.admin);
  const tokens = { admin: await page.evaluate(() => sessionStorage.getItem('siga_token')) };
  for (const [key, [email, password]] of Object.entries(credentials)) {
    if (key !== 'admin') tokens[key] = await login(email, password);
  }
  adminToken = tokens.admin;

  await expectStatus('/auth/me', null, 401);
  await expectStatus('/users', tokens.secretaria, 403);
  await expectStatus('/users', tokens.estudianteA, 403);
  await expectStatus('/teachers', tokens.secretaria, 200);
  await expectStatus('/teachers', tokens.secretaria, 403, 'POST', {});
  await expectStatus('/grade-records', tokens.secretaria, 200);
  await expectStatus('/attendance-records', tokens.secretaria, 200);
  await expectStatus('/grade-records', tokens.secretaria, 403, 'POST', {});
  await expectStatus('/attendance-records', tokens.secretaria, 403, 'POST', {});

  const adminAssignments = await expectStatus('/teaching-assignments?limit=100', tokens.admin, 200);
  const demoAssignments = adminAssignments.data.filter((item) => item.course.code.startsWith('DEMO-'));
  assert.equal(demoAssignments.length, 2);
  const assignmentA = demoAssignments.find((item) => item.course.code === 'DEMO-MAT');
  const assignmentB = demoAssignments.find((item) => item.course.code === 'DEMO-COM');
  const teacherAList = await expectStatus('/teaching-assignments?limit=100', tokens.docenteA, 200);
  const teacherBList = await expectStatus('/teaching-assignments?limit=100', tokens.docenteB, 200);
  assert(teacherAList.data.some((item) => item.id === assignmentA.id));
  assert(!teacherAList.data.some((item) => item.id === assignmentB.id));
  assert(teacherBList.data.some((item) => item.id === assignmentB.id));
  await expectStatus(`/teaching-assignments/${assignmentB.id}`, tokens.docenteA, 403);
  const roster = await expectStatus(`/teaching-assignments/${assignmentA.id}/enrollments?status=ACTIVE`, tokens.docenteA, 200);
  assert.equal(roster.pagination.total, 1);
  const enrollmentA = roster.data[0];
  const recordsA = await expectStatus(`/grade-records?teachingAssignmentId=${assignmentA.id}`, tokens.docenteA, 200);
  const recordsB = await expectStatus(`/grade-records?teachingAssignmentId=${assignmentB.id}`, tokens.docenteB, 200);
  assert.equal(recordsA.pagination.total, 1);
  assert.equal(recordsB.pagination.total, 1);
  await expectStatus(`/grade-records/${recordsB.data[0].id}`, tokens.docenteA, 403);
  await expectStatus(`/grade-records/${recordsB.data[0].id}`, tokens.estudianteA, 403);
  const otherAttendance = await expectStatus(`/attendance-records?teachingAssignmentId=${assignmentB.id}`, tokens.admin, 200);
  await expectStatus(`/attendance-records/${otherAttendance.data[0].id}`, tokens.estudianteA, 403);
  const ownGrades = await expectStatus('/grade-records?limit=1&page=1', tokens.estudianteA, 200);
  assert.equal(ownGrades.pagination.total, 1);
  const ownAttendance = await expectStatus('/attendance-records', tokens.estudianteA, 200);
  assert.equal(ownAttendance.pagination.total, 1);
  const dateParts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const datePart = (type) => dateParts.find((part) => part.type === type).value;
  const limaDate = `${datePart('year')}-${datePart('month')}-${datePart('day')}`;
  assert.equal(ownAttendance.data[0].date.slice(0, 10), limaDate);
  await expectStatus('/courses', tokens.estudianteA, 403);
  await expectStatus('/courses', tokens.admin, 409, 'POST', { code: 'DEMO-MAT', name: 'Duplicado' });
  const coursePage1 = await expectStatus('/courses?limit=1&page=1', tokens.admin, 200);
  const coursePage2 = await expectStatus('/courses?limit=1&page=2', tokens.admin, 200);
  assert(coursePage1.pagination.total >= 2 && coursePage2.data.length === 1);
  assert.notEqual(coursePage1.data[0].id, coursePage2.data[0].id);

  const newGrade = await expectStatus('/grade-records', tokens.docenteA, 201, 'POST', { teachingAssignmentId: assignmentA.id, enrollmentId: enrollmentA.id, term: 2, value: 'AD' });
  remember('gradeRecord', newGrade.data.id);
  await expectStatus(`/grade-records/${newGrade.data.id}`, tokens.docenteA, 200, 'PATCH', { value: 'A' });
  const yesterday = new Date(`${limaDate}T00:00:00.000Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const attendanceDate = yesterday.toISOString().slice(0, 10);
  const newAttendance = await expectStatus('/attendance-records', tokens.docenteA, 201, 'POST', { teachingAssignmentId: assignmentA.id, enrollmentId: enrollmentA.id, date: attendanceDate, status: 'LATE' });
  remember('attendanceRecord', newAttendance.data.id);
  await expectStatus(`/attendance-records/${newAttendance.data.id}`, tokens.docenteA, 200, 'PATCH', { status: 'JUSTIFIED' });

  await page.screenshot({ path: path.join(os.tmpdir(), 'siga-mvp-admin-panel.png') });
  await page.reload();
  await page.getByText('Bienvenido, Demo').waitFor();
  await openModule(page, 'Usuarios');
  await page.getByRole('button', { name: 'Crear registro' }).click();
  const newEmail = `demo-e2e-${suffix}@siga.invalid`;
  await page.getByLabel('Correo').fill(newEmail);
  await page.getByLabel('Contraseña').fill(process.env.DEMO_ESTUDIANTE_A_PASSWORD);
  await page.getByLabel('Nombre').fill('Demo');
  await page.getByLabel('Apellido').fill('E2E');
  await page.getByLabel('Rol').selectOption('ESTUDIANTE');
  const newUser = await createFromEditor(page, '/users', 'user');
  const allUsers = await expectStatus('/users', tokens.admin, 200);
  assert(allUsers.users.some((item) => item.id === newUser.id && item.email === newEmail));

  await openModule(page, 'Estudiantes');
  await page.getByRole('button', { name: 'Registrar estudiante' }).click();
  await page.getByLabel('Código', { exact: true }).fill(`DEMO-E2E-${suffix}`);
  await page.getByLabel('Nombres').fill('Demo');
  await page.getByLabel('Apellidos').fill('E2E');
  await page.getByLabel('Fecha de nacimiento').fill('2015-05-15');
  await page.getByLabel('Cuenta ESTUDIANTE (opcional)').selectOption(newUser.id);
  await page.screenshot({ path: path.join(os.tmpdir(), 'siga-mvp-students-desktop.png') });
  const newStudent = await createFromEditor(page, '/students', 'student');
  const createdStudents = await expectStatus(`/students?search=DEMO-E2E-${suffix}`, tokens.admin, 200);
  assert.equal(createdStudents.pagination.total, 1);
  assert.equal(createdStudents.data[0].id, newStudent.id);
  await page.getByLabel('Buscar por código o nombre').fill(`DEMO-E2E-${suffix}`);
  const [filteredStudents] = await Promise.all([
    page.waitForResponse((response) => new URL(response.url()).pathname === '/api/students' && new URL(response.url()).searchParams.has('search')),
    page.getByRole('button', { name: 'Aplicar filtros' }).click(),
  ]);
  assert.equal((await filteredStudents.json()).pagination.total, 1);

  await openModule(page, 'Usuarios');
  await page.getByRole('button', { name: 'Crear registro' }).click();
  const teacherEmail = `demo-e2e-teacher-${suffix}@siga.invalid`;
  await page.getByLabel('Correo').fill(teacherEmail);
  await page.getByLabel('Contraseña').fill(process.env.DEMO_DOCENTE_A_PASSWORD);
  await page.getByLabel('Nombre').fill('Demo');
  await page.getByLabel('Apellido').fill('Docente E2E');
  await page.getByLabel('Rol').selectOption('DOCENTE');
  const teacherUser = await createFromEditor(page, '/users', 'user');
  assert((await expectStatus('/users', tokens.admin, 200)).users.some((item) => item.id === teacherUser.id && item.email === teacherEmail));

  await openModule(page, 'Docentes');
  await page.getByRole('button', { name: 'Crear registro' }).click();
  await page.getByLabel('Cuenta docente').selectOption(teacherUser.id);
  const teacherProfile = await createFromEditor(page, '/teachers', 'teacher');
  assert((await expectStatus(`/teachers?search=${encodeURIComponent(teacherEmail)}`, tokens.admin, 200)).data.some((item) => item.id === teacherProfile.id));

  await openModule(page, 'Periodos');
  await page.getByRole('button', { name: 'Crear registro' }).click();
  const periodName = `DEMO-E2E-${suffix}`;
  await page.getByLabel('Nombre').fill(periodName);
  await page.getByLabel('Inicio').fill(`${limaDate.slice(0, 4)}-01-01`);
  await page.getByLabel('Fin').fill(`${limaDate.slice(0, 4)}-12-31`);
  const newPeriod = await createFromEditor(page, '/academic-periods', 'academicPeriod');
  assert((await expectStatus('/academic-periods', tokens.admin, 200)).items.some((item) => item.id === newPeriod.id && item.name === periodName));

  const grade = (await expectStatus('/grades', tokens.admin, 200)).items.find((item) => item.educationLevelId === assignmentA.section.grade.educationLevel.id && item.order === 1);
  assert(grade);
  await openModule(page, 'Secciones');
  await page.getByRole('button', { name: 'Crear registro' }).click();
  await page.locator('.resource-editor').getByLabel('Grado', { exact: true }).selectOption(grade.id);
  await page.locator('.resource-editor').getByLabel('Periodo', { exact: true }).selectOption(newPeriod.id);
  await page.locator('.resource-editor').getByLabel('Sección').fill(`DEMO-E2E-${suffix}`);
  const newSection = await createFromEditor(page, '/sections', 'section');
  assert((await expectStatus(`/sections?academicPeriodId=${newPeriod.id}`, tokens.admin, 200)).items.some((item) => item.id === newSection.id && item.name === `DEMO-E2E-${suffix.toUpperCase()}`));

  await openModule(page, 'Cursos');
  await page.getByRole('button', { name: 'Crear registro' }).click();
  await page.getByLabel('Código', { exact: true }).fill('DEMO-MAT');
  await page.getByLabel('Nombre').fill('DEMO duplicado');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await page.getByRole('alert').filter({ hasText: 'duplicado' }).waitFor();
  const courseCode = `DEMO-E2E-${suffix}`;
  await page.getByLabel('Código', { exact: true }).fill(courseCode);
  await page.getByLabel('Nombre').fill('DEMO Curso E2E');
  const newCourse = await createFromEditor(page, '/courses', 'course');
  assert((await expectStatus(`/courses?search=${courseCode}`, tokens.admin, 200)).data.some((item) => item.id === newCourse.id));

  await openModule(page, 'Asignaciones');
  await page.getByRole('button', { name: 'Crear registro' }).click();
  await page.locator('.resource-editor').getByLabel('Curso', { exact: true }).selectOption(newCourse.id);
  await page.locator('.resource-editor').getByLabel('Sección', { exact: true }).selectOption(newSection.id);
  await page.locator('.resource-editor').getByLabel('Docente', { exact: true }).selectOption(teacherProfile.id);
  const newAssignment = await createFromEditor(page, '/teaching-assignments', 'teachingAssignment');
  assert((await expectStatus(`/teaching-assignments?courseId=${newCourse.id}`, tokens.admin, 200)).data.some((item) => item.id === newAssignment.id && item.sectionId === newSection.id));

  await openModule(page, 'Matrículas');
  await page.getByRole('button', { name: 'Crear registro' }).click();
  await page.locator('.resource-editor').getByLabel('Estudiante', { exact: true }).selectOption(newStudent.id);
  await page.locator('.resource-editor').getByLabel('Sección', { exact: true }).selectOption(newSection.id);
  const newEnrollment = await createFromEditor(page, '/enrollments', 'enrollment');
  assert((await expectStatus(`/enrollments?studentId=${newStudent.id}`, tokens.admin, 200)).data.some((item) => item.id === newEnrollment.id && item.sectionId === newSection.id));

  await openModule(page, 'Calificaciones');
  await page.getByRole('button', { name: 'Crear registro' }).click();
  await page.locator('.resource-editor').getByLabel('Asignación', { exact: true }).selectOption(newAssignment.id);
  await page.locator('.resource-editor').getByLabel('Matrícula', { exact: true }).selectOption(newEnrollment.id);
  await page.locator('.resource-editor').getByLabel('Bimestre').selectOption('1');
  await page.locator('.resource-editor').getByLabel('Nota').selectOption('A');
  const adminRecord = await createFromEditor(page, '/grade-records', 'gradeRecord');
  assert((await expectStatus(`/grade-records?teachingAssignmentId=${newAssignment.id}`, tokens.admin, 200)).data.some((item) => item.id === adminRecord.id && item.enrollmentId === newEnrollment.id));
  await page.locator('tbody tr').filter({ hasText: 'DEMO Curso E2E' }).getByRole('button', { name: 'Editar' }).click();
  await page.locator('.resource-editor').getByLabel('Nota').selectOption('AD');
  const [adminPatch] = await Promise.all([
    page.waitForResponse((item) => new URL(item.url()).pathname === `/api/grade-records/${adminRecord.id}` && item.request().method() === 'PATCH'),
    page.locator('.resource-editor').getByRole('button', { name: 'Guardar' }).click(),
  ]);
  assert.equal(adminPatch.status(), 200);
  await page.getByText('Cambios guardados.').waitFor();
  assert.equal((await expectStatus(`/grade-records/${adminRecord.id}`, tokens.admin, 200)).data.value, 'AD');

  await page.getByRole('button', { name: 'Salir' }).click();
  await page.goto(`${frontendBase}/users`);
  await page.getByRole('button', { name: 'Ingresar' }).waitFor();

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 1 });
  const mobilePage = await mobile.newPage();
  watchPage(mobilePage, errors);
  await uiSession(mobilePage, tokens.secretaria);
  await mobilePage.getByRole('button', { name: 'Abrir menú' }).click();
  await mobilePage.screenshot({ path: path.join(os.tmpdir(), 'siga-mvp-menu-mobile.png') });
  await mobilePage.locator('.mobile-nav').getByRole('link', { name: 'Estudiantes' }).click();
  await mobilePage.getByRole('button', { name: 'Registrar estudiante' }).click();
  await mobilePage.screenshot({ path: path.join(os.tmpdir(), 'siga-mvp-students-mobile.png'), fullPage: true });
  assert.equal(await mobilePage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'Desbordamiento horizontal móvil');
  assert.equal(await mobilePage.getByRole('link', { name: 'Usuarios' }).count(), 0);
  await mobilePage.getByLabel('Código', { exact: true }).fill(`DEMO-E2E-SEC-${suffix}`);
  await mobilePage.getByLabel('Nombres').fill('Demo');
  await mobilePage.getByLabel('Apellidos').fill('Secretaria E2E');
  await mobilePage.getByLabel('Fecha de nacimiento').fill('2015-06-15');
  const secretaryStudent = await createFromEditor(mobilePage, '/students', 'student');
  await mobilePage.getByRole('button', { name: 'Abrir menú' }).click();
  await mobilePage.locator('.mobile-nav').getByRole('link', { name: 'Matrículas' }).click();
  await mobilePage.getByRole('button', { name: 'Crear registro' }).click();
  await mobilePage.locator('.resource-editor').getByLabel('Estudiante', { exact: true }).selectOption(secretaryStudent.id);
  await mobilePage.locator('.resource-editor').getByLabel('Sección', { exact: true }).selectOption(assignmentB.sectionId);
  await createFromEditor(mobilePage, '/enrollments', 'enrollment');
  await mobile.close();

  const teacherPage = await desktop.newPage();
  watchPage(teacherPage, errors);
  await uiSession(teacherPage, tokens.docenteA);
  await teacherPage.locator('aside').getByRole('link', { name: 'Mi aula' }).click();
  await teacherPage.getByRole('heading', { name: 'Mis asignaciones' }).waitFor();
  await teacherPage.getByText('DEMO Matemática').first().click();
  await teacherPage.getByText('Estudiantes matriculados').waitFor();
  await teacherPage.screenshot({ path: path.join(os.tmpdir(), 'siga-mvp-mi-aula.png') });
  await teacherPage.locator('form').getByLabel('Estudiante').selectOption(enrollmentA.id);
  await teacherPage.locator('form').getByLabel('Bimestre').selectOption('3');
  await teacherPage.locator('form').getByLabel('Nota').selectOption('B');
  const [teacherGradeResponse] = await Promise.all([
    teacherPage.waitForResponse((item) => new URL(item.url()).pathname === '/api/grade-records' && item.request().method() === 'POST'),
    teacherPage.locator('form').getByRole('button', { name: 'Guardar' }).click(),
  ]);
  assert.equal(teacherGradeResponse.status(), 201);
  const teacherGrade = (await teacherGradeResponse.json()).data;
  remember('gradeRecord', teacherGrade.id);
  const [teacherGradePatch] = await Promise.all([
    teacherPage.waitForResponse((item) => new URL(item.url()).pathname === `/api/grade-records/${teacherGrade.id}` && item.request().method() === 'PATCH'),
    teacherPage.locator('tbody tr').filter({ hasText: '3' }).getByRole('combobox', { name: /Corregir/ }).selectOption('A'),
  ]);
  assert.equal(teacherGradePatch.status(), 200);
  assert.equal((await expectStatus(`/grade-records/${teacherGrade.id}`, tokens.admin, 200)).data.value, 'A');
  await teacherPage.getByRole('button', { name: 'Asistencia' }).click();
  const twoDaysEarlier = new Date(`${limaDate}T00:00:00.000Z`);
  twoDaysEarlier.setUTCDate(twoDaysEarlier.getUTCDate() - 2);
  const secondAttendanceDate = twoDaysEarlier.toISOString().slice(0, 10);
  await teacherPage.locator('form').getByLabel('Estudiante').selectOption(enrollmentA.id);
  await teacherPage.locator('form').getByLabel('Fecha').fill(secondAttendanceDate);
  await teacherPage.locator('form').getByLabel('Estado').selectOption('ABSENT');
  const [teacherAttendanceResponse] = await Promise.all([
    teacherPage.waitForResponse((item) => new URL(item.url()).pathname === '/api/attendance-records' && item.request().method() === 'POST'),
    teacherPage.locator('form').getByRole('button', { name: 'Guardar' }).click(),
  ]);
  assert.equal(teacherAttendanceResponse.status(), 201);
  const teacherAttendance = (await teacherAttendanceResponse.json()).data;
  remember('attendanceRecord', teacherAttendance.id);
  const [teacherAttendancePatch] = await Promise.all([
    teacherPage.waitForResponse((item) => new URL(item.url()).pathname === `/api/attendance-records/${teacherAttendance.id}` && item.request().method() === 'PATCH'),
    teacherPage.locator('tbody tr').filter({ hasText: secondAttendanceDate }).getByRole('combobox', { name: /Corregir/ }).selectOption('JUSTIFIED'),
  ]);
  assert.equal(teacherAttendancePatch.status(), 200);
  assert.equal((await expectStatus(`/attendance-records/${teacherAttendance.id}`, tokens.admin, 200)).data.status, 'JUSTIFIED');
  await teacherPage.goto(`${frontendBase}/users`);
  await teacherPage.getByText('Sin permisos').waitFor();

  const studentPage = await desktop.newPage();
  watchPage(studentPage, errors);
  await uiSession(studentPage, tokens.estudianteA);
  await studentPage.locator('aside').getByRole('link', { name: 'Mis calificaciones' }).click();
  await studentPage.getByText('DEMO Matemática').first().waitFor();
  await studentPage.locator('aside').getByRole('link', { name: 'Mi asistencia' }).click();
  await studentPage.getByText(limaDate).first().waitFor();
  await studentPage.goto(`${frontendBase}/users`);
  await studentPage.getByText('Sin permisos').waitFor();

  originalTeacherId = assignmentA.teacherId;
  changedAssignmentId = assignmentA.id;
  await expectStatus(`/teaching-assignments/${assignmentA.id}`, tokens.admin, 200, 'PATCH', { teacherId: assignmentB.teacherId });
  await expectStatus(`/teaching-assignments/${assignmentA.id}`, tokens.docenteA, 403);
  await expectStatus(`/teaching-assignments/${assignmentA.id}`, tokens.docenteB, 200);
  await expectStatus(`/grade-records/${recordsA.data[0].id}`, tokens.docenteA, 403);
  await expectStatus(`/grade-records/${recordsA.data[0].id}`, tokens.docenteB, 200);
  assert.deepEqual(errors, []);
  console.log('E2E real: API, PostgreSQL, Edge escritorio/móvil, seis cuentas DEMO y revocación por cambio de docente: OK.');
} catch (error) {
  console.error(`E2E falló: ${error.message}`);
  if (currentPage) {
    const listText = await currentPage.locator('.resource-list').first().innerText().catch(() => 'sin listado');
    console.error(`Listado visible al fallar: ${listText.slice(0, 500)}`);
  }
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  try { await cleanup(); } catch (error) { console.error(`Limpieza E2E pendiente: ${error.code || error.name}`); process.exitCode = 1; }
  await prisma.$disconnect();
}
