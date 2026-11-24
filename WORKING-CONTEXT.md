# SIGA – Working Context

## Descripción del sistema
Sistema de Información de Gestión Académica (SIGA). Aplicación web fullstack para una institución educativa peruana (niveles INICIAL, PRIMARIA, SECUNDARIA). Gestiona usuarios por rol, estructura académica, estudiantes, docentes, matrículas, cursos, calificaciones y asistencia.

## Stack tecnológico
| Capa       | Tecnología                                      |
|------------|-------------------------------------------------|
| Frontend   | React 18, React Router v7, Vite, Tailwind CSS   |
| Backend    | Node.js, Express, Prisma ORM                    |
| Base datos | PostgreSQL                                      |
| Tests FE   | Vitest + jsdom, Playwright (e2e)                |

## Estructura de directorios relevante
```
SIGA/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma          ← esquema completo
│   │   └── migrations/            ← 5 migraciones (sprint1 → session_revocation)
│   └── src/
│       ├── app.js                 ← Express app factory
│       ├── server.js
│       ├── config/                ← env.js, prisma.js
│       ├── middlewares/           ← auth, error, not-found
│       ├── routes/                ← index.js (router raíz bajo /api)
│       ├── shared/                ← crud.js, errors.js, pagination.js, user-projection.js, academic-helpers.js, record-access.js, academic-records.js
│       └── modules/               ← 1 carpeta directa por entidad (routes, controller, service, validator)
│           ├── health/
│           ├── auth/
│           ├── users/
│           ├── education-levels/
│           ├── grades/
│           ├── academic-periods/
│           ├── sections/
│           ├── students/
│           ├── teachers/
│           ├── enrollments/
│           ├── courses/
│           ├── teaching-assignments/
│           ├── grade-records/
│           └── attendance-records/
└── frontend/
    ├── public/images/
    └── src/
        ├── App.jsx                ← BrowserRouter + AuthProvider + rutas protegidas
        ├── main.jsx
        ├── styles.css
        ├── auth/AuthContext.jsx   ← token en sessionStorage, api factory, login/logout/changePassword/updateProfile
        ├── components/            ← Brand, Icon, Layout, Ui
        ├── pages/                 ← Login, Dashboard, ResourcePage, TeacherClassroom, ChangePassword, Profile
        ├── services/
        │   ├── api.js             ← createApi(getToken, onUnauth)
        │   └── resources.js       ← definición declarativa de todos los recursos (columnas, formularios, filtros, roles)
        └── utils/                 ← buildVersion.js, format.js
```

## Modelos de datos (schema.prisma)
| Modelo              | Descripción                                             |
|---------------------|---------------------------------------------------------|
| User                | Cuenta del sistema (roles: ADMIN, SECRETARIA, DOCENTE, ESTUDIANTE) |
| EducationLevel      | Nivel educativo (INICIAL, PRIMARIA, SECUNDARIA)         |
| Grade               | Grado dentro de un nivel                                |
| AcademicPeriod      | Año/período académico                                   |
| Section             | Sección (grado + período + nombre)                      |
| Student             | Perfil del estudiante (puede o no tener User vinculado) |
| Teacher             | Perfil del docente (siempre vinculado a User)           |
| Enrollment          | Matrícula de estudiante en sección+período              |
| Course              | Curso (código + nombre)                                 |
| TeachingAssignment  | Asignación docente–curso–sección                        |
| GradeRecord         | Calificación por bimestre (AD/A/B/C)                   |
| AttendanceRecord    | Asistencia por fecha (PRESENT/ABSENT/LATE/JUSTIFIED)    |

## API Routes montadas en `/api`
| Prefijo                    | Router                 |
|----------------------------|------------------------|
| `/auth`                    | auth.routes            |
| `/users`                   | user.routes            |
| `/education-levels`        | academic (educationLevel) |
| `/grades`                  | academic (grade)       |
| `/academic-periods`        | academic (academicPeriod) |
| `/sections`                | academic (section)     |
| `/students`                | people-enrollment (student) |
| `/teachers`                | people-enrollment (teacher) |
| `/enrollments`             | people-enrollment (enrollment) |
| `/courses`                 | course-record (course) |
| `/teaching-assignments`    | course-record (assignment) |
| `/grade-records`           | course-record (gradeRecord) |
| `/attendance-records`      | course-record (attendanceRecord) |

## Auth & seguridad
- JWT almacenado en `sessionStorage` (key: `siga_token`).
- `tokenVersion` en User para revocación de sesiones.
- CORS restringido a `CORS_ORIGIN` del .env.
- Helmet + trust proxy configurado.
- `clearSession()` se llama automáticamente en 401.

## Frontend – ResourcePage
Página genérica que consume la configuración de `resources.js` para renderizar tablas, formularios de creación/edición y filtros de cualquier recurso, sin código duplicado.

## Roles y permisos (frontend resources.js & backend)
| Recurso            | Puede ver                          | Puede escribir / eliminar (FE) |
|--------------------|-------------------------------------|--------------------------------|
| education-levels   | ADMIN, SECRETARIA                   | ADMIN, SECRETARIA              |
| grades             | ADMIN, SECRETARIA                   | ADMIN, SECRETARIA              |
| academic-periods   | ADMIN, SECRETARIA                   | ADMIN, SECRETARIA              |
| sections           | ADMIN, SECRETARIA                   | ADMIN, SECRETARIA              |
| students           | ADMIN, SECRETARIA                   | ADMIN, SECRETARIA              |
| teachers           | ADMIN, SECRETARIA                   | ADMIN                          |
| enrollments        | ADMIN, SECRETARIA                   | ADMIN, SECRETARIA              |
| courses            | ADMIN, SECRETARIA, DOCENTE          | ADMIN, SECRETARIA              |
| teaching-assignments | ADMIN, SECRETARIA, DOCENTE        | ADMIN, SECRETARIA              |
| grade-records      | ADMIN, SECRETARIA, ESTUDIANTE (DOCENTE en Mi aula) | ADMIN en ResourcePage / DOCENTE en Mi aula (incluye DELETE) |
| attendance-records | ADMIN, SECRETARIA, ESTUDIANTE (DOCENTE en Mi aula) | ADMIN en ResourcePage / DOCENTE en Mi aula (incluye DELETE) |

## Migraciones existentes
1. `202609290001_sprint1_users_auth` – Users, Auth
2. `202609290002_academic_structure` – EducationLevel, Grade, AcademicPeriod, Section
3. `202609290003_students_teachers_enrollments` – Student, Teacher, Enrollment
4. `202609290004_courses_grades_attendance` – Course, TeachingAssignment, GradeRecord, AttendanceRecord
5. `202609300001_session_revocation` – tokenVersion en User

## Patrones conocidos
- Routers genéricos de backend: `academicRouter(resource)`, `peopleEnrollmentRouter(resource)`, `courseRecordRouter(resource)`.
- `module-error.js`: clase de error personalizada para respuestas estructuradas.
- `resources.js` en frontend: configuración declarativa con helpers `field()`, `choice()`, `ref()`.
- `displayValue()` y `refLabel()` en resources.js manejan la presentación de todos los valores.
- Sincronización bidireccional `User` ↔ `Student`: actualizar `firstName`/`lastName` en `auth.service`, `user.service` o `profile.service` sincroniza el par vinculado dentro de `$transaction`.
- Operación docente unificada en `TeacherClassroom.jsx` (`Mi aula`): filtro de asignaciones activas/inactivas, registro grupal en lote (POST/PATCH), filtro por bimestre/fecha y `DELETE` de registros erróneos.
- `ReferenceField` soporta `extraParams`, `requireParam` (ej. `Asignación → Matrícula` en notas/asistencia y filtro por `academicPeriodId` en traslados de matrícula) y filtra activos por defecto.

## Reglas / convenciones del proyecto
- Calificaciones peruanas: AD, A, B, C (enum GradeValue).
- Asistencia: PRESENT, ABSENT, LATE, JUSTIFIED.
- Matrículas: una por estudiante por período (@@unique([studentId, academicPeriodId])).
- Fechas: `db.Date` para birthDate, startDate, endDate, date (sin componente de hora).
- UUIDs como PK en todos los modelos.

## Notas de entorno
- `.env` no está en git. Variables críticas: `DATABASE_URL`, `CORS_ORIGIN`, `TRUST_PROXY_HOPS`.
- Frontend usa Vite; tests con Vitest (unit) y Playwright (e2e).
