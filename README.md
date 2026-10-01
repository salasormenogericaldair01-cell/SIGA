# Sistema de Gestión Académica (SIGA)

Proyecto académico del curso de Seguridad Informática. El backend incluye usuarios, roles, autenticación, estructura académica, perfiles, matrículas, cursos, asignaciones docentes, calificaciones y asistencia. El frontend React permite operar estos módulos según el rol.

## Stack y estructura

JavaScript CommonJS, Node.js 24, Express 5, PostgreSQL, Prisma 6, Zod, bcrypt y JWT. Jest y Supertest para pruebas. `backend/src/app.js` configura Express sin abrir un puerto; `server.js` inicia el servidor. Las rutas llaman a controladores, los controladores a servicios y los middlewares protegen las rutas.

## Configurar y ejecutar

Desde `backend/`:

```powershell
npm ci
Copy-Item .env.example .env
npm run prisma:generate
npm run dev
```

En PowerShell con `npm.ps1` bloqueado, utilizar `npm.cmd` en vez de `npm`. En Linux/macOS, copiar el ejemplo con `cp .env.example .env`.

Editar `.env` con una URL real de **PostgreSQL**, un `JWT_SECRET` aleatorio de al menos 32 caracteres y el origen exacto del frontend. El ejemplo de conexión usa `localhost:5433` y credenciales ficticias. `.env` está ignorado por Git. `JWT_EXPIRES_IN=1h` y `BCRYPT_ROUNDS=12` son valores recomendados; el rango admitido de bcrypt es 10–14. La aplicación valida la configuración al iniciar. `GET /api/health` permanece público.

## Bases de datos y migraciones

El esquema define usuarios, estructura académica, perfiles, matrículas, cursos, asignaciones, `GradeRecord` y `AttendanceRecord`. Las migraciones aditivas están en `backend/prisma/migrations/`. Usar `siga` para desarrollo y `siga_test` para integración; no ejecutar tests de integración sobre desarrollo.

Si se autoriza crear ambas bases nuevas en el PostgreSQL local de Windows, estos comandos solicitan la contraseña interactivamente y no la guardan en el repositorio:

```powershell
& 'C:\Program Files\PostgreSQL\18\bin\createdb.exe' -h 127.0.0.1 -p 5433 -U postgres -W siga
& 'C:\Program Files\PostgreSQL\18\bin\createdb.exe' -h 127.0.0.1 -p 5433 -U postgres -W siga_test
```

Una vez creadas las bases y configurada `DATABASE_URL` en `.env`:

```powershell
npm run prisma:validate
npm run prisma:migrate
npm run prisma:generate
```

`prisma:migrate` ejecuta `prisma migrate deploy` sobre **la base indicada por `DATABASE_URL`**. Para migrar la base de pruebas, configurar temporalmente `DATABASE_URL` con la URL de `siga_test` y ejecutar el mismo comando; comprobar el destino antes de hacerlo. No se requiere borrar ni resetear esquemas.

## Primer ADMIN

Después de aplicar la migración en desarrollo, definir `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_FIRST_NAME` y `ADMIN_LAST_NAME` en el entorno local o en `.env`. La contraseña debe tener al menos 12 caracteres y como máximo 72 bytes UTF-8. Ejecutar manualmente:

```powershell
npm run seed:admin
```

Si el email normalizado ya existe, el script termina sin cambiar contraseña, rol ni estado. No se ejecuta automáticamente con `npm ci` o las migraciones. No compartir `.env` ni pegar contraseñas o tokens en comandos versionados.

## API

| Método y ruta | Acceso | Resultado |
| --- | --- | --- |
| `GET /api/health` | Público | Estado del servicio |
| `POST /api/auth/login` | Público, limitado a 5 intentos/15 min por IP | Usuario seguro y token |
| `GET /api/auth/me` | Bearer JWT | Usuario actual |
| `POST /api/users` | ADMIN | Crear usuario (201) |
| `GET /api/users` | ADMIN | Lista sin hashes |
| `PATCH /api/users/:id/status` | ADMIN | Activar o desactivar otro usuario |
| `GET /api/education-levels`, `/api/grades`, `/api/academic-periods`, `/api/sections` | ADMIN, SECRETARIA | Listar, incluidos inactivos |
| `GET /api/{recurso}/:id` | ADMIN, SECRETARIA | Consultar detalle |
| `POST /api/{recurso}` | ADMIN, SECRETARIA | Crear (201) |
| `PATCH /api/{recurso}/:id` | ADMIN, SECRETARIA | Editar campos permitidos |
| `GET /api/students`, `/api/students/:id` | ADMIN, SECRETARIA | Listar paginado o consultar estudiante |
| `POST /api/students`, `PATCH /api/students/:id` | ADMIN, SECRETARIA | Crear o editar estudiante |
| `GET /api/teachers`, `/api/teachers/:id` | ADMIN, SECRETARIA | Listar paginado o consultar docente |
| `POST /api/teachers`, `PATCH /api/teachers/:id` | ADMIN | Crear perfil o cambiar su estado |
| `GET /api/enrollments`, `/api/enrollments/:id` | ADMIN, SECRETARIA | Listar paginado o consultar matrícula |
| `POST /api/enrollments`, `PATCH /api/enrollments/:id` | ADMIN, SECRETARIA | Matricular, trasladar, cancelar o reactivar |
| `GET /api/courses`, `/api/courses/:id` | ADMIN, SECRETARIA, DOCENTE | Catálogo paginado y detalle |
| `POST /api/courses`, `PATCH /api/courses/:id` | ADMIN, SECRETARIA | Crear o editar curso |
| `GET /api/teaching-assignments`, `/api/teaching-assignments/:id` | ADMIN, SECRETARIA; DOCENTE solo propias | Asignaciones paginadas y detalle |
| `GET /api/teaching-assignments/:id/enrollments` | ADMIN, SECRETARIA; DOCENTE solo propia | Matrículas de la sección, paginadas |
| `POST /api/teaching-assignments`, `PATCH /api/teaching-assignments/:id` | ADMIN, SECRETARIA | Crear, reasignar docente o cambiar estado |
| `GET /api/grade-records`, `/api/grade-records/:id` | ADMIN, SECRETARIA; DOCENTE propias; ESTUDIANTE propias | Notas paginadas y detalle |
| `POST /api/grade-records`, `PATCH /api/grade-records/:id` | ADMIN; DOCENTE propias | Crear o corregir valor |
| `GET /api/attendance-records`, `/api/attendance-records/:id` | ADMIN, SECRETARIA; DOCENTE propias; ESTUDIANTE propias | Asistencia paginada y detalle |
| `POST /api/attendance-records`, `PATCH /api/attendance-records/:id` | ADMIN; DOCENTE propias | Crear o corregir estado |

El JWT dura por defecto una hora y solo contiene la identidad como `sub`. Cada petición protegida consulta la base para comprobar estado y rol vigentes. Desactivar una cuenta invalida sus tokens anteriores. No existe registro público.

Los recursos académicos son `education-levels`, `grades`, `academic-periods` y `sections`. Todos admiten el filtro opcional `isActive=true|false`; grados admiten `educationLevelId` y secciones `gradeId` y `academicPeriodId`. Sin filtros se devuelven activos e inactivos, ordenados por creación e ID. No hay DELETE ni paginación. DOCENTE y ESTUDIANTE reciben 403 y una petición sin token recibe 401.

Los niveles tienen códigos únicos `INICIAL`, `PRIMARIA` y `SECUNDARIA`. Cada grado tiene un `order` único dentro de su nivel: Inicial 3–5, Primaria 1–6 y Secundaria 1–5. Una sección es única por grado, periodo y nombre; el nombre se normaliza a mayúsculas. Los periodos requieren `startDate < endDate` con fechas `AAAA-MM-DD`, también al editar solo una fecha. La inactivación conserva los registros y referencias, pero impide crear grados o secciones asociados a registros inactivos. `isActive` no implica que sea el único periodo vigente.

El seed académico es **manual** e idempotente: crea solo los tres niveles y sus 14 grados faltantes; conserva nombres y estados ya existentes y no crea periodos, secciones ni usuarios. Tras verificar que `DATABASE_URL` apunta a `siga` en el puerto 5433, ejecutar desde `backend/`:

```powershell
npm run seed:academic
```

Para verificar el estado de las migraciones:

```powershell
npx prisma migrate status
```

Repetir el comando con `DATABASE_URL` apuntando a `siga_test` para consultar esa base; el comando no aplica migraciones.

## Pruebas y seguridad

```powershell
npm test
npm audit
```

`npm test` ejecuta Sprint 0 y pruebas HTTP con Prisma simulado; no demuestra una conexión real. Para probar PostgreSQL real, definir `TEST_DATABASE_URL` hacia la base separada **`siga_test`**, aplicar allí las migraciones y ejecutar:

```powershell
npm run test:integration
```

El runner rechaza URLs que no apunten a `siga_test`; cada prueba confirma `current_database()` antes de escribir y limpia únicamente sus propios registros. La prueba del seed académico revierte todos sus cambios mediante una transacción. Si la base no está preparada, el comando falla explícitamente. Helmet, CORS de origen explícito, límite JSON de 100 kB, manejo seguro de errores y rate limit protegen las rutas; CORS no sustituye la autenticación.

`package.json` aplica un `override` limitado de `deepmerge-ts` 8.0.0 dentro de Prisma por [GHSA-ggr8-5vv4-36mx](https://github.com/advisories/GHSA-ggr8-5vv4-36mx). Volver a verificar este ajuste al actualizar Prisma.

## Perfiles y matrículas

Las listas de estudiantes y docentes admiten `search`, `isActive=true|false`, `page` y `limit` (1–100). La lista de matrículas admite `studentId`, `sectionId`, `academicPeriodId`, `status`, `page` y `limit`. La respuesta de listas usa `data` y `pagination: { page, limit, total, totalPages }`, con orden estable por creación e ID.

Un Student puede existir sin usuario. Su código se normaliza a mayúsculas y no se cambia después; `birthDate` usa `AAAA-MM-DD` y no puede estar en el futuro. `PATCH /api/students/:id` acepta `userId` de una cuenta ESTUDIANTE activa o `null` para desvincularla. Un Teacher requiere una cuenta DOCENTE activa y obtiene de ella nombre y email. Ninguno de estos endpoints crea cuentas ni devuelve `passwordHash`.

Ejemplos de cuerpos JSON para crear cada recurso:

```json
{ "studentCode": "EST-001", "firstName": "Ana", "lastName": "Pérez", "birthDate": "2012-05-14" }
{ "userId": "<uuid-de-usuario-docente>" }
{ "studentId": "<uuid-de-estudiante>", "sectionId": "<uuid-de-seccion>" }
```

El periodo de una matrícula se deriva de la sección. `Enrollment` tiene unicidad por estudiante y periodo, incluso si está `CANCELLED`. Para volver a matricular en ese periodo se reactiva la matrícula existente. Un traslado solo puede usar otra sección del mismo periodo. La base también impide inconsistencias mediante la clave foránea compuesta `Enrollment(sectionId, academicPeriodId)` → `Section(id, academicPeriodId)`, respaldada por una restricción única en `Section`; la aplicación valida además que los recursos estén activos al crear, trasladar o reactivar. Cancelar no elimina datos, y desactivar un estudiante o docente no modifica su cuenta ni cancela matrículas automáticamente.

## Cursos, calificaciones y asistencia

Los cuatro listados nuevos usan `data` y `pagination` (`page`, `limit`, `total`, `totalPages`). `page` empieza en 1 y `limit` admite 1–100. Cursos filtran por `search` e `isActive`; asignaciones por `courseId`, `sectionId`, `teacherId`, `academicPeriodId` e `isActive`; notas por `teachingAssignmentId`, `enrollmentId`, `academicPeriodId` y `term`; asistencia por los tres IDs. Las asignaciones solo pueden usar curso, sección, grado, nivel, periodo y docente activos; el docente debe tener cuenta activa de rol DOCENTE. El DOCENTE consulta exclusivamente sus asignaciones actuales, y el ESTUDIANTE exclusivamente los registros de su perfil. Este alcance se aplica antes de contar y paginar y también en los detalles y ediciones.

Ejemplos de creación, con UUID reales de registros existentes:

```json
{ "code": "MAT", "name": "Matemática" }
{ "courseId": "<uuid-curso>", "sectionId": "<uuid-seccion>", "teacherId": "<uuid-perfil-docente>" }
{ "teachingAssignmentId": "<uuid-asignacion>", "enrollmentId": "<uuid-matricula>", "term": 1, "value": "A" }
{ "teachingAssignmentId": "<uuid-asignacion>", "enrollmentId": "<uuid-matricula>", "date": "2026-09-29", "status": "PRESENT" }
```

`GradeRecord` admite `term` de 1 a 4 y `value` `AD`, `A`, `B` o `C`. Una única calificación por curso, matrícula y bimestre es una **simplificación del MVP**; no hay competencias ni promedios automáticos. `AttendanceRecord` admite `PRESENT`, `ABSENT`, `LATE` o `JUSTIFIED`; la fecha debe ser real, estar dentro del periodo inclusive y no ser futura en `America/Lima`.

La API deriva `sectionId` de la asignación para notas y asistencias. Dos claves foráneas compuestas por registro lo vinculan a la misma sección de la asignación y de la matrícula, también en PostgreSQL. Si ya existen notas o asistencias, **el MVP rechaza con 409 el traslado de esa matrícula**; no borra ni mueve los registros. Cambiar el docente conserva los registros y cambia inmediatamente su acceso. Los registros históricos siguen visibles dentro del alcance autorizado cuando un recurso se desactiva, pero las nuevas escrituras requieren estados activos.

## Frontend (Sprint 5)

El frontend usa React, Vite, Tailwind CSS y React Router. Requiere Node.js 24. Desde `frontend/`:

```powershell
npm ci
Copy-Item .env.example .env
npm run dev
```

Abre `http://localhost:5173`. El puerto es fijo y coincide con `CORS_ORIGIN=http://localhost:5173` del backend. `VITE_API_URL` apunta por defecto a `http://localhost:3000/api`; solo contiene la URL pública de la API. Inicia el backend desde `backend/` con `npm run dev` y su `.env` local. En PowerShell, usa `npm.cmd` si `npm.ps1` está bloqueado.

El ADMIN gestiona usuarios, estructura, estudiantes, perfiles docentes, matrículas, cursos, asignaciones, notas y asistencia. SECRETARIA gestiona estructura, estudiantes, matrículas, cursos y asignaciones; consulta docentes, notas y asistencia. DOCENTE usa **Mi aula** para consultar sus asignaciones y matrículas, y registrar o corregir notas y asistencia individuales. ESTUDIANTE consulta sus propias notas y asistencia. Los listados paginados muestran el total y permiten avanzar de página; la estructura académica y usuarios no tienen paginación de servidor.

En Matrículas, el nombre de la ficha `Student` identifica al estudiante y su código aparece como dato secundario en listados, detalle y selectores. Esto funciona también si el estudiante no tiene cuenta de acceso.

La sesión guarda el JWT en memoria y `sessionStorage`, nunca en `localStorage`; se valida con `/auth/me` al abrir la aplicación. Un 401 limpia la sesión, mientras un 403 conserva la sesión y muestra el error. Cerrar sesión borra el token localmente, pero **no revoca** un JWT ya emitido. La autorización efectiva sigue en el backend. No existe registro público. Secretaría puede registrar un estudiante sin cuenta; solo ADMIN puede vincularlo a una cuenta ESTUDIANTE porque `/api/users` es exclusivo de ADMIN. Los selectores de perfiles docentes muestran cuentas DOCENTE activas aún no vinculadas.

Para verificar el frontend: `npm test`, `npm run build` y `npm audit` desde `frontend/`. Las pruebas usan HTTP simulado y no escriben en `siga` ni `siga_test`. El frontend no crea datos de demostración.

La verificación final y el guion manual del MVP están en [docs/demo.md](docs/demo.md). El seed DEMO se ejecuta manualmente y nunca de forma automática en `siga`.

El fundamento de seguridad, protección de datos y las brechas frente a la normativa peruana se documentan en [docs/seguridad-y-normativa.md](docs/seguridad-y-normativa.md).

La identidad gráfica de SIGA en `frontend/src/components/Brand.jsx` y `frontend/public/brand-mark.svg` es propia de este proyecto; no es el escudo de una institución educativa. La imagen de campus en `frontend/public/images/campus-referencial.png` fue generada para la interfaz y se usa como ilustración decorativa. No representa una institución real.
