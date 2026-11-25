# SIGA – Guía Ordenada para Exposición

Guía paso a paso para entender y explicar **SIGA** de forma sencilla, conectando **React (Frontend)** → **Express (Backend en JS)** → **PostgreSQL**.

---

## 1. Mapa en una frase
- **Frontend (`frontend/src/`)**: Pantallas en **React** que muestran formularios y tablas según el rol del usuario.
- **Backend (`backend/src/`)**: API en **Node.js + Express** organizada con **1 carpeta por tabla/recurso**, igual que un CRUD clásico.
- **Base de datos (`PostgreSQL`)**: **12 tablas relacionales** en PostgreSQL conectadas con **Sequelize** (`backend/src/config/db.js` + `backend/src/models/*.js`).

---

## 2. Orden exacto del Backend (`backend/src/`) — Qué abrir si el profe pregunta

```text
backend/src/
├── server.js                      ← 1. Verifica PostgreSQL (sequelize.authenticate) y arranca en puerto 3000
├── app.js                         ← 2. Configura Express (CORS, Helmet, JSON, /api)
├── routes/index.js                ← 3. Índice de las 14 rutas del sistema
├── config/
│   ├── env.js                     ← Variables .env validadas
│   └── db.js                      ← Conexión Sequelize a PostgreSQL (new Sequelize)
├── models/                        ← 12 modelos Sequelize (*.js) + index.js con relaciones (belongsTo/hasMany)
├── middlewares/
│   ├── auth.middleware.js         ← Verifica el token JWT y el rol del usuario
│   └── error.middleware.js        ← Atrapa errores inesperados sin filtrar datos
├── shared/                        ← Código común para no repetir en cada módulo
│   ├── crud.js                    ← Controlador CRUD estándar (list, get, create, update, remove)
│   ├── errors.js                  ← Traduce errores de PostgreSQL/Sequelize a HTTP (400, 404, 409)
│   ├── pagination.js              ← Paginación, fecha Lima y validaciones base
│   ├── user-projection.js         ← Oculta passwordHash y tokenVersion
│   ├── academic-helpers.js        ← Reglas de grados y fechas de periodos
│   ├── record-access.js           ← Control de alcance (DOCENTE solo lo suyo, ESTUDIANTE solo lo suyo)
│   └── academic-records.js        ← Lógica compartida de notas y asistencia
└── modules/                       ← 1 carpeta directa por cada módulo (siempre en el mismo orden)
    ├── health/                    ← GET /api/health
    ├── auth/                      ← Login, perfil (/me) y cambio de contraseña
    ├── users/                     ← Cuentas de usuario (solo ADMIN)
    ├── education-levels/          ← Niveles (Inicial, Primaria, Secundaria)
    ├── grades/                    ← Grados
    ├── academic-periods/          ← Periodos / Años académicos
    ├── sections/                  ← Secciones
    ├── students/                  ← Estudiantes
    ├── teachers/                  ← Docentes
    ├── enrollments/               ← Matrículas
    ├── courses/                   ← Cursos
    ├── teaching-assignments/      ← Asignaciones (Curso + Sección + Docente)
    ├── grade-records/             ← Calificaciones (AD, A, B, C)
    └── attendance-records/        ← Asistencia (Presente, Ausente, Tardanza, Justificada)
```

### Dentro de cada carpeta de `modules/<nombre>/` siempre hay lo mismo:
1. **`*.routes.js`** → Qué URLs atiende (`GET`, `POST`, `PATCH`, `DELETE`) y qué roles pueden entrar.
2. **`*.validator.js`** → Revisa que el JSON del formulario venga completo y válido antes de tocar la BD.
3. **`*.controller.js`** → Recibe la petición HTTP y llama al servicio.
4. **`*.service.js`** → Ejecuta las reglas de negocio y la consulta a PostgreSQL con Sequelize (`Model.findAll`, `Model.findAndCountAll`, `Model.create`, `record.update`, `record.destroy`).

---

## 3. Cómo explicar la Base de Datos en PostgreSQL con Sequelize

Si el profesor pregunta por las tablas y relaciones, muéstrale **pgAdmin 4** con estas ideas claras:

1. **Seguridad y acceso**:
   - `"User"` guarda las cuentas (`email`, `passwordHash` con `bcrypt`, `role`, `isActive`).
   - `"Teacher"` se vincula `1:1` a `"User"`.
   - `"Student"` puede vincularse `1:1` a `"User"` (opcional, porque un alumno menor puede matricularse sin tener cuenta web; si tiene cuenta, los nombres se sincronizan automáticamente).
2. **Estructura del colegio (jerarquía `1:N`)**:
   - `"EducationLevel"` → `"Grade"` → `"Section"` ← `"AcademicPeriod"`.
3. **Tablas intermedias (`N:M`)**:
   - `"Enrollment"` une a `"Student"` con `"Section"` y `"AcademicPeriod"` (regla: 1 sola matrícula por estudiante en cada periodo).
   - `"TeachingAssignment"` une `"Course"` + `"Section"` + `"Teacher"`.
4. **Registros académicos**:
   - `"GradeRecord"` (bimestres 1–4, nota `AD/A/B/C`) y `"AttendanceRecord"` (fecha y estado) apuntan tanto a `"TeachingAssignment"` como a `"Enrollment"`, garantizando en PostgreSQL (con llaves foráneas compuestas que incluyen `sectionId`) que no se pueda mezclar un estudiante de una sección con el curso de otra.

### Consultas SQL listas para mostrar en pgAdmin 4:
```sql
SELECT id, email, "firstName", "lastName", role, "isActive" FROM "User";

SELECT s."studentCode", s."firstName", s."lastName", sec.name AS seccion, ap.name AS periodo, e.status
FROM "Enrollment" e
JOIN "Student" s ON s.id = e."studentId"
JOIN "Section" sec ON sec.id = e."sectionId"
JOIN "AcademicPeriod" ap ON ap.id = e."academicPeriodId";

SELECT s."firstName" || ' ' || s."lastName" AS estudiante, c.name AS curso, gr.term AS bimestre, gr.value AS nota
FROM "GradeRecord" gr
JOIN "Enrollment" e ON e.id = gr."enrollmentId"
JOIN "Student" s ON s.id = e."studentId"
JOIN "TeachingAssignment" ta ON ta.id = gr."teachingAssignmentId"
JOIN "Course" c ON c.id = ta."courseId";
```

---

## 4. Guion de demo en vivo (4 minutos en pantalla)

1. **`ADMIN` (`demo-admin@siga.invalid` / `SigaLocal2026!`)**:
   - Muestra el panel, entra a **Secciones** (grado + periodo legibles) y **Calificaciones → Registrar calificación** (demuestra que `Matrícula` se habilita solo después de elegir `Asignación`).
   - Muestra **Matrículas → Editar** en Sofía Vega (el sistema bloquea el traslado de sección porque ya tiene notas).
2. **`SECRETARÍA` (`demo-secretaria@siga.invalid` / `SigaLocal2026!`)**:
   - Señala que no ve **Usuarios**, que **Docentes** y **Calificaciones** son de solo lectura, y que puede registrar estudiantes y matrículas.
3. **`DOCENTE` (`demo-docente-a@siga.invalid` / `SigaLocal2026!`)**:
   - Entra directo a **Mi aula**, elige su curso asignado, abre **Registro grupal** en Asistencia o Calificaciones, registra/corrige o elimina un dato de prueba y explica que solo ve sus propias secciones.
4. **`ESTUDIANTE` (`demo-estudiante-a@siga.invalid` / `SigaLocal2026!`)**:
   - Entra a **Mis calificaciones** y **Mi asistencia** (filtra por bimestre o fecha) y demuestra que si intenta entrar a `/users` por URL, el sistema lo bloquea.
