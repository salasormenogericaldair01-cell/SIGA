# Guía de estudio de SIGA

Esta guía sirve para explicar el software construido, no para declarar que está listo para operar con datos reales. Para profundizar, véanse [seguridad y normativa](../security/security-and-regulations.md), [auditoría externa](../security/external-security-audit.md), [rendimiento](../security/performance-results.md) y [restauración](../operations/backup-restore-runbook.md). Las rutas y permisos descritos corresponden al código de esta rama.

## A. Problema, solución y alcance

Una institución que ofrece Inicial, Primaria y Secundaria necesita relacionar cuentas, fichas, grados, periodos, secciones, matrículas, cursos y registros académicos sin mantener listas aisladas. SIGA centraliza esas operaciones en una aplicación web con permisos por rol. ADMIN administra cuentas; SECRETARIA organiza fichas y matrículas; DOCENTE trabaja sobre sus cursos; ESTUDIANTE consulta sus propias notas y asistencias. Un estudiante puede tener ficha sin cuenta de acceso.

Están implementados usuarios y perfiles, estructura académica, matrículas, cursos, asignaciones, una calificación por curso y bimestre, asistencia individual y cambio de nombres del propio perfil. No hay registro público, apoderados, pagos, vacantes, promedios automáticos, evaluación por competencias, cierre oficial de periodos ni auditoría persistente. SIGA es un proyecto académico y **no sustituye al SIAGIE**: la [norma de matrícula 2026 del MINEDU](https://www.gob.pe/institucion/minedu/normas-legales/7603336-010-2026-minedu) regula el proceso oficial y contempla su registro; SIGA no implementa ese procedimiento completo. Las normas de [evaluación de competencias](https://www.gob.pe/institucion/minedu/normas-legales/541161-094-2020-minedu) y su [modificación de 2024](https://www.gob.pe/institucion/minedu/normas-legales/5518274-048-2024-minedu) tampoco quedan representadas por una sola nota por curso y bimestre.

## B. Arquitectura y despliegue

React con Vite presenta formularios y rutas por rol. Un cliente HTTP centralizado envía peticiones JSON a Express. Las rutas aplican autenticación, autorización y validación Zod; controladores y servicios ejecutan reglas de negocio; Prisma consulta PostgreSQL. El navegador nunca recibe una conexión a la base. El frontend se aloja en Vercel y el backend en Render, con PostgreSQL separado. En desarrollo pueden ejecutarse frontend, API y PostgreSQL localmente; la base siga_test se reserva para pruebas con escritura.

~~~mermaid
flowchart LR
    N[Navegador] --> F[React y Vite<br/>Vercel o local]
    F -->|HTTPS y JSON| A[API Express<br/>Render o local]
    A --> V[Validación y servicios]
    V --> P[Prisma]
    P --> D[(PostgreSQL)]
~~~

La URL pública de la API se incorpora al build mediante VITE_API_URL; secretos como DATABASE_URL y JWT_SECRET solo pertenecen al backend. El frontend coloca un SHA corto en el metadato siga-build; la API devuelve version en GET /api/health. Ambos pueden mostrar commits distintos si un cambio solo afecta a uno. Un valor unknown indica que el build no recibió un SHA válido, no que la API esté caída. Véanse [buildVersion.js](../../frontend/src/utils/buildVersion.js), [health.controller.js](../../backend/src/controllers/health.controller.js) y la [guía de despliegue](../operations/deployment.md).

## C. Modelo de datos e integridad

Los 12 modelos usan UUID como clave primaria; todos tienen createdAt y updatedAt. Un UUID identifica una fila, pero **no concede permiso** para leerla. El [esquema Prisma](../../backend/prisma/schema.prisma) declara claves foráneas y únicas que PostgreSQL también aplica.

| Entidad | Qué representa y relaciones relevantes | Unicidad o restricción principal |
| --- | --- | --- |
| User | Cuenta con correo, rol, estado, hash y versión de token; puede vincularse a Student o Teacher. | Email único. |
| Student | Ficha con nombre, código y nacimiento; cuenta User opcional; tiene matrículas. | Código y userId, si existe, únicos. |
| Teacher | Perfil docente que usa nombre y correo de User; tiene asignaciones. | userId obligatorio y único. |
| EducationLevel | Inicial, Primaria o Secundaria; contiene grados. | code único. |
| Grade | Grado dentro de un nivel; contiene secciones. | Par (educationLevelId, order) único. |
| AcademicPeriod | Periodo con fecha inicial y final; contiene secciones y matrículas. | name único; servicio exige inicio anterior al fin. |
| Section | Grado y periodo concretos, por ejemplo A; tiene matrículas y asignaciones. | (gradeId, academicPeriodId, name) único. |
| Enrollment | Estudiante en una sección y periodo; ACTIVE o CANCELLED. | (studentId, academicPeriodId) único, incluso cancelada. |
| Course | Catálogo de cursos; participa en asignaciones. | code único. |
| TeachingAssignment | Curso, sección y docente actual; conserva registros si cambia el docente. | (courseId, sectionId) único. |
| GradeRecord | Valor AD/A/B/C de una matrícula en una asignación y bimestre 1–4. | (teachingAssignmentId, enrollmentId, term) único. |
| AttendanceRecord | Estado de asistencia para una fecha del periodo, sin hora. | (teachingAssignmentId, enrollmentId, date) único. |

La clave foránea compuesta **(sectionId, academicPeriodId)** de Enrollment apunta a Section y evita que una matrícula declare un periodo distinto del de su sección. GradeRecord y AttendanceRecord guardan el sectionId derivado en el servidor: sus dos claves foráneas compuestas enlazan simultáneamente la misma sección de Enrollment y TeachingAssignment. El cliente no elige ese sectionId. La base rechaza una incoherencia incluso si se omite accidentalmente una comprobación del servicio. Si una matrícula ya tiene notas o asistencias, cambiar su sección rompería esas referencias; la API responde 409 y no mueve ni borra registros. Las desactivaciones conservan referencias históricas y bloquean nuevas asociaciones según la regla de cada módulo.

## D. Roles y permisos

**Consultar** incluye listado y detalle dentro del alcance indicado; **editar** no implica cambiar campos inmutables. La matriz resume [rutas](../../backend/src/routes/index.js) y [alcance por recurso](../../backend/src/services/record-access.service.js).

| Recurso / acción | ADMIN | SECRETARIA | DOCENTE | ESTUDIANTE |
| --- | --- | --- | --- | --- |
| Usuarios: listar, crear, cambiar estado | Sí; no se desactiva a sí mismo | No | No | No |
| Mi perfil: consultar y editar nombres propios; contraseña propia | Sí | Sí | Sí | Sí |
| Niveles, grados, periodos, secciones: consultar, crear, editar y activar/desactivar | Sí | Sí | No | No |
| Estudiantes y matrículas: consultar, crear, editar, activar/cancelar y trasladar según reglas | Sí | Sí | No | No |
| Docentes: consultar | Sí | Sí | No | No |
| Perfil Teacher: crear y cambiar estado | Sí | No | No | No |
| Cursos: consultar | Sí | Sí | Sí | No |
| Cursos: crear, editar y cambiar estado | Sí | Sí | No | No |
| Asignaciones: consultar y ver matrículas del curso | Todas | Todas | Solo propias | No |
| Asignaciones: crear, cambiar docente o estado | Sí | Sí | No | No |
| Notas y asistencia: consultar | Todas | Todas | Solo asignaciones propias | Solo matrículas propias |
| Notas y asistencia: registrar y corregir | Sí | No | Solo asignaciones propias y referencias activas | No |

El backend devuelve 401 sin sesión, 403 si el rol o el recurso no está permitido. DOCENTE necesita un perfil Teacher vinculado; ESTUDIANTE necesita Student vinculado para ver sus registros. Los filtros no amplían el alcance: se aplican junto con la condición de propiedad **antes de contar y paginar**, y se vuelve a comprobar en detalle y edición. Al cambiar el docente de una asignación, el anterior pierde acceso aunque conserve un JWT válido. Ocultar botones o rutas en React mejora la experiencia, pero **no sustituye** estas comprobaciones del backend.

## E. Un flujo funcional de principio a fin

1. ADMIN crea una cuenta con rol apropiado. El correo se normaliza; la contraseña solo se guarda como hash.
2. ADMIN crea Teacher vinculando una cuenta DOCENTE activa; ADMIN o SECRETARIA crea Student, con cuenta ESTUDIANTE activa opcional. No se crean cuentas automáticamente desde las fichas.
3. ADMIN o SECRETARIA prepara nivel, grado, periodo con fechas válidas y sección. Los registros relacionados deben estar activos para nuevas asociaciones.
4. ADMIN o SECRETARIA crea Course y una TeachingAssignment para curso, sección y docente; el periodo viene de la sección.
5. ADMIN o SECRETARIA matricula a Student en la sección. El periodo se deriva de Section y solo hay una matrícula por estudiante y periodo. En Matrículas, el nombre de Student es principal y el código secundario, aunque no tenga User.
6. ADMIN o el DOCENTE asignado registra un GradeRecord para el bimestre y una AttendanceRecord en una fecha válida del periodo. El docente usa Mi aula para elegir una matrícula de su propia asignación.
7. ESTUDIANTE con perfil vinculado inicia sesión y ve únicamente sus calificaciones y asistencias. SECRETARIA puede consultarlas, pero no escribirlas.

Para una demostración, usar cuentas controladas y datos ficticios; evitar cambios irreversibles en la base publicada. El [guion operativo](../operations/verification-guide.md) describe la preparación local.

## F. Seguridad: mecanismo, evidencia y límite

| Control aplicado y ejemplo | Evidencia del repositorio | Límite y mejora para producción |
| --- | --- | --- |
| **bcrypt:** solo passwordHash; mínimo 12 caracteres y rechazo de más de 72 bytes UTF-8. | [auth.service.js](../../backend/src/services/auth.service.js), [validador de usuario](../../backend/src/validators/user.validator.js). | No hay MFA; exigirlo para cuentas sensibles y gestionar recuperación segura. |
| **JWT HS256:** firma, expiración, sub y tokenVersion. Cada petición protegida consulta rol y estado actuales. El cambio de contraseña incrementa la versión atómicamente y obliga a nuevo login. | [auth.middleware.js](../../backend/src/middlewares/auth.middleware.js), [prueba de revocación](../../backend/tests/integration/session-revocation.integration.js). | Logout borra solo la sesión local; no revoca un token individual todavía válido. |
| **sessionStorage:** el token dura una pestaña/sesión del navegador y sobrevive a su recarga. | [AuthContext.jsx](../../frontend/src/auth/AuthContext.jsx). | JavaScript de la misma página puede leerlo ante XSS. Evaluar cookies HttpOnly con protección CSRF y modelo de sesiones adecuado. |
| **CSP obligatoria y Helmet:** restringen recursos del documento y añaden cabeceras HTTP; CORS limita el origen de navegador configurado. | [vercel.json](../../frontend/vercel.json), [app.js](../../backend/src/app.js), [auditoría externa](../security/external-security-audit.md). | CSP y CORS no impiden por sí solos abusos de una API; revisar cada recurso nuevo y no confundir CORS con autorización. |
| **Rate limiting y trust proxy:** login y cambio de contraseña limitados; 0 saltos localmente, 1 en Render confirmado manualmente. | [auth.routes.js](../../backend/src/routes/auth.routes.js), [env.js](../../backend/src/config/env.js), [pruebas de proxy](../../backend/tests/unit/trust-proxy.test.js). | Contador en memoria se reinicia y no se comparte entre instancias; la topología pública exacta no se demostró. |
| **Zod estricto, Prisma y PostgreSQL:** rechazan campos inesperados y tipos inválidos; consultas tipadas y restricciones de base evitan varias incoherencias. | [validadores](../../backend/src/validators/), [schema.prisma](../../backend/prisma/schema.prisma), [prueba de contrato](../../backend/tests/integration/production-contract.integration.js). | Prisma no inmuniza cualquier SQL escrito a mano; revisar consultas raw y mantener pruebas de inyección. |
| **Alcance por recurso:** un UUID de otra persona no autoriza leer o editar su registro. | [record-access.service.js](../../backend/src/services/record-access.service.js), [integración de registros](../../backend/tests/integration/course-record.integration.js). | Repetir pruebas BOLA/IDOR al agregar rutas y filtros. |
| **Respuestas y secretos:** rutas /api/auth con Cache-Control: no-store; sin hash en JSON; errores 500 genéricos; Gitleaks y variables de entorno ignoradas por Git. | [auth.routes.js](../../backend/src/routes/auth.routes.js), [error.middleware.js](../../backend/src/middlewares/error.middleware.js), [auditoría externa](../security/external-security-audit.md). | No-store no borra datos ya copiados; revisar logs, alertas y custodia de secretos operativos. |
| **Transporte y base:** HTTPS/TLS observados; PostgreSQL externo limitado manualmente a la IP actual /32 y conexión interna del backend conservada. | [auditoría externa](../security/external-security-audit.md). | No se probó rechazo desde una segunda IP; la regla /32 debe actualizarse si cambia la IP autorizada. |

La [Ley 29733](https://www.gob.pe/institucion/congreso-de-la-republica/normas-legales/243470-29733) y su [reglamento de 2024](https://www.gob.pe/institucion/smv/normas-legales/6426760-016-2024-jus) establecen un marco de protección de datos personales. Elegir bcrypt, JWT, Zod o UUID es una **decisión técnica**, no una fórmula legal de cumplimiento. El proyecto carece de responsable institucional designado, aviso de privacidad, políticas de conservación e incidentes y evaluación legal completa; no se afirma cumplimiento total ni autorización del MINEDU. Véase la [matriz normativa](../security/security-and-regulations.md).

## G. Pruebas y resultados verificables

Las verificaciones aprobadas de preparación para producción registraron **75 pruebas backend**, **15 integraciones con PostgreSQL siga_test** y **32 pruebas frontend**. Son conteos de esa ejecución, no una promesa sobre futuras suites. Las pruebas de [contrato](../../backend/tests/integration/production-contract.integration.js) cubren cuatro roles, códigos HTTP, inyección, campos sensibles y control de acceso; también existen pruebas [E2E de navegador](../../frontend/tests/e2e/mvp.e2e.mjs), [revocación](../../backend/tests/integration/session-revocation.integration.js) y [alcance académico](../../backend/tests/integration/course-record.integration.js). Más tarde, **19 pruebas** específicas de trust proxy y limitador pasaron. Gitleaks con su configuración revisada dejó cero alertas sin justificar en árbol e historial; npm audit informó cero vulnerabilidades en ambos proyectos al momento de la revisión. Ninguno de esos resultados prueba ausencia universal de fallos.

En el recorrido publicado documentado, Mozilla Observatory calificó el frontend **A+** por sus cabeceras; es una prueba automatizada de ese aspecto, no una certificación. El [informe de rendimiento](../security/performance-results.md) registra una repetición local con hasta **30 VU**, **14 796 solicitudes**, **183,41 RPS globales**, **p95 18,70 ms**, **p99 30,38 ms**, **0 % fallos HTTP** y **0 respuestas 500** en los 80 segundos completos, rampas incluidas. La API y PostgreSQL estaban en la computadora de pruebas; no se midió la capacidad de Render, Vercel ni una carga de producción.

## H. Respaldo y recuperación

pg_dump produjo un respaldo PostgreSQL en formato custom. Su tamaño, SHA-256 y pg_restore --list comprobaron que el archivo era legible y contenía objetos; **listar el dump no demuestra que pueda restaurarse íntegramente**. Después se restauró de verdad en una base local nueva y aislada con pg_restore, sin --clean ni --create. Se cotejaron cinco migraciones y checksums, esquema normalizado, conteos y relaciones; una API temporal conectada a esa copia respondió 200 en health, login y /api/auth/me. Finalmente se verificó el destino y se eliminó solo la base temporal. El [runbook](../operations/backup-restore-runbook.md) explica comandos, controles y recuperación en una base nueva.

El respaldo y ensayo fueron manuales. Aún falta automatizar frecuencia, retención, almacenamiento seguro y restauraciones periódicas. La base gratuita publicada es temporal; la fecha exacta de vencimiento de la instancia debe comprobarse en el panel, sin inventarla. Debe existir un respaldo vigente antes de ese vencimiento o de cambios de datos.

## I. Limitaciones que debemos reconocer

- ZAP Baseline no se ejecutó porque Docker/ZAP no estaban operativos; las pruebas locales no lo sustituyen.
- JWT permanece en sessionStorage; hay riesgo XSS residual y logout no revoca individualmente tokens emitidos.
- No hay MFA, auditoría persistente, respaldos automatizados ni monitoreo y alertas suficientes para operación institucional.
- La base gratuita tiene vencimiento; no se probó capacidad ni continuidad de producción.
- La [auditoría externa](../security/external-security-audit.md) documenta **un 503** transitorio. También se reportó **un timeout separado** en el seguimiento del proyecto, sin traza diagnóstica conservada en este repositorio. Ninguno se reprodujo de forma controlada ni tiene causa confirmada; revisar registros del proveedor antes de atribuirlos a la aplicación, base o red.
- La evaluación por competencias, procesos oficiales SIAGIE y procedimientos completos de protección de datos están fuera del alcance actual.

## J. Antes de la exposición

- [ ] Verificar que la IP autorizada coincida con la regla externa /32 si se necesita mantenimiento; no abrir acceso general.
- [ ] Tener el respaldo privado vigente y el [runbook](../operations/backup-restore-runbook.md) disponibles, sin mostrar secretos.
- [ ] Confirmar Vercel y Render activos; comprobar /login y /api/health, y comparar versiones por directorio.
- [ ] Abrir login varios minutos antes por el posible arranque lento de Render; respetar el limitador.
- [ ] Verificar una cuenta controlada por cada rol: ADMIN, SECRETARIA, DOCENTE y ESTUDIANTE. Mantener credenciales fuera de diapositivas y consola.
- [ ] Seguir un recorrido de solo lectura o usar datos ficticios preparados; no modificar datos importantes durante la exposición.
- [ ] Tener capturas sin datos sensibles y un guion alternativo si Render tarda o falla; explicar que son evidencia anterior, no una sesión en vivo.

## Reparto preliminar para seis integrantes

Cada integrante puede preparar **dos diapositivas**, una de explicación y otra de evidencia o demostración. La asignación definitiva no requiere nombres todavía.

| Integrante | Bloque | Dos diapositivas sugeridas |
| --- | --- | --- |
| 1 | Problema, alcance y Scrum | Necesidad y alcance; trabajo por sprints y límites. |
| 2 | Arquitectura y base de datos | Flujo web/despliegue; entidades y restricciones. |
| 3 | Roles, usuarios y estructura académica | Matriz de permisos; cuentas, perfiles y estructura. |
| 4 | Matrículas, cursos y flujo académico | Matrícula por nombre y sección; curso, nota y asistencia. |
| 5 | Autenticación y seguridad | JWT y revocación; defensa por capas y pendientes. |
| 6 | Pruebas, rendimiento, recuperación y cierre | Evidencia medida; restauración, limitaciones y conclusión. |

Practicar [el banco de preguntas](software-study-questions.md) permite que cualquiera responda sobre decisiones y límites fuera de su bloque.
