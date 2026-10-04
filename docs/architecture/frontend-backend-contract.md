# Contrato frontend–backend (auditoría local)

Base verificable: `frontend/src/services/{api,resources}.js`, `AuthContext.jsx`, `ResourcePage.jsx`, `TeacherClassroom.jsx`, y rutas, controladores y validadores del backend. Todas las rutas empiezan por `/api`. Los cuerpos y filtros son estrictos; un campo desconocido da 400. Los listados paginados devuelven `{data,pagination:{page,limit,total,totalPages}}`; los catálogos académicos, `{items}`. La matriz de GET y roles se ejecuta contra `siga_test` en `backend/tests/integration/production-contract.integration.js`.

| Llamada frontend | Ruta y método backend | Roles | Cuerpo o filtros | Respuesta |
|---|---|---|---|---|
| Ingresar | `POST /auth/login` | Público | `email,password` | `{user,token}` |
| Recuperar sesión | `GET /auth/me` | Todos autenticados | Bearer | `{user}` seguro |
| Mi perfil | `PATCH /auth/me` | Todos autenticados | `firstName?,lastName?` | `{user}` |
| Cambiar contraseña | `POST /auth/change-password` | Todos autenticados | `currentPassword,newPassword` | `{message}` |
| Usuarios: lista, alta, estado | `GET /users`; `POST /users`; `PATCH /users/:id/status` | ADMIN | Alta: `email,password,firstName,lastName,role`; estado: `isActive` | `{users}` o `{user}` |
| Niveles: lista, detalle, alta, edición | `GET /education-levels[/:id]`; `POST /education-levels`; `PATCH /education-levels/:id` | ADMIN, SECRETARIA | Filtro `isActive`; alta `code,name,isActive?`; edición `name?,isActive?` | `{items}` o `{item}` |
| Grados: lista, detalle, alta, edición | `GET /grades[/:id]`; `POST /grades`; `PATCH /grades/:id` | ADMIN, SECRETARIA | Filtros `educationLevelId,isActive`; alta `educationLevelId,name,order,isActive?`; edición `name?,order?,isActive?` | `{items}` o `{item}` |
| Periodos: lista, detalle, alta, edición | `GET /academic-periods[/:id]`; `POST /academic-periods`; `PATCH /academic-periods/:id` | ADMIN, SECRETARIA | Filtro `isActive`; alta `name,startDate,endDate,isActive?`; edición de nombre, fechas o estado | `{items}` o `{item}` |
| Secciones: lista, detalle, alta, edición | `GET /sections[/:id]`; `POST /sections`; `PATCH /sections/:id` | ADMIN, SECRETARIA | Filtros `gradeId,academicPeriodId,isActive`; alta `gradeId,academicPeriodId,name,isActive?`; edición `name?,isActive?` | `{items}` o `{item}` |
| Estudiantes: lista, detalle, alta, edición | `GET /students[/:id]`; `POST /students`; `PATCH /students/:id` | ADMIN, SECRETARIA | Filtros `search,isActive,page,limit`; alta `studentCode,firstName,lastName,birthDate,userId?,isActive?`; edición sin `studentCode` | `{data,pagination}` o `{data}` |
| Docentes: lista, detalle, alta, edición | `GET /teachers[/:id]`; `POST /teachers`; `PATCH /teachers/:id` | GET: ADMIN, SECRETARIA; escritura: ADMIN | Filtros `search,isActive,page,limit`; alta `userId,isActive?`; edición `isActive` | `{data,pagination}` o `{data}` |
| Matrículas: lista, detalle, alta, edición | `GET /enrollments[/:id]`; `POST /enrollments`; `PATCH /enrollments/:id` | ADMIN, SECRETARIA | Filtros `studentId,sectionId,academicPeriodId,status,page,limit`; alta `studentId,sectionId`; edición `sectionId?,status?` | `{data,pagination}` o `{data}` |
| Cursos: lista, detalle, alta, edición | `GET /courses[/:id]`; `POST /courses`; `PATCH /courses/:id` | GET: ADMIN, SECRETARIA, DOCENTE; escritura: ADMIN, SECRETARIA | Filtros `search,isActive,page,limit`; alta `code,name,isActive?`; edición `name?,isActive?` | `{data,pagination}` o `{data}` |
| Asignaciones: lista, detalle, alta, edición | `GET /teaching-assignments[/:id]`; `POST /teaching-assignments`; `PATCH /teaching-assignments/:id` | GET: ADMIN, SECRETARIA, DOCENTE titular; escritura: ADMIN, SECRETARIA | Filtros `courseId,sectionId,teacherId,academicPeriodId,isActive,page,limit`; alta `courseId,sectionId,teacherId`; edición `teacherId?,isActive?` | `{data,pagination}` o `{data}` |
| Mi aula: matrículas | `GET /teaching-assignments/:id/enrollments` | ADMIN, SECRETARIA, DOCENTE titular | `status,page,limit` | `{data,pagination}` |
| Calificaciones: lista, detalle, alta, edición | `GET /grade-records[/:id]`; `POST /grade-records`; `PATCH /grade-records/:id` | GET: todos en alcance propio; escritura: ADMIN, DOCENTE titular | Filtros `teachingAssignmentId,enrollmentId,academicPeriodId,term,page,limit`; alta `teachingAssignmentId,enrollmentId,term,value`; edición `value` | `{data,pagination}` o `{data}` |
| Asistencia: lista, detalle, alta, edición | `GET /attendance-records[/:id]`; `POST /attendance-records`; `PATCH /attendance-records/:id` | GET: todos en alcance propio; escritura: ADMIN, DOCENTE titular | Filtros `teachingAssignmentId,enrollmentId,academicPeriodId,page,limit`; alta `teachingAssignmentId,enrollmentId,date,status`; edición `status` | `{data,pagination}` o `{data}` |

`page` empieza en 1 y `limit` está entre 1 y 100. `GET /health` devuelve `{status,service,version}` sin autenticación. La API responde 400 por formato, 401 por sesión, 403 por rol, alcance u origen no autorizado, 404 por recurso ausente y 409 por duplicado o relación incompatible. El frontend conserva la sesión ante 403 y errores de red; la limpia ante 401.

## Hallazgos y límites

- No se detectaron rutas antiguas en las llamadas activas. Las envolturas `users/items/data` coinciden con los controladores.
- `Mi aula` pide matrículas paginadas de 100 elementos. Al cambiar de página o asignación limpia de inmediato filas y selección, y exige que el UUID elegido pertenezca a la página visible al guardar. La regresión usa 125 matrículas en `siga_test` y una prueba de interfaz; no se cargan todas en el navegador.
- Los selectores generales paginan referencias; los catálogos académicos sin paginación se consultan completos. DOCENTE/ESTUDIANTE sin perfil reciben 403 en consultas personales.
- Las pruebas de alcance para registros académicos, incluida edición y cambio de docente, están en `course-record.integration.js`. La autorización definitiva reside en el backend.
