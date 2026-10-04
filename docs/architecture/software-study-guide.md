# Guía de estudio de SIGA

SIGA es una aplicación web académica para Educación Básica. React/Vite consume una API Express; Express valida entradas con Zod, separa rutas, controladores y servicios, y Prisma accede a PostgreSQL. Las pruebas de integración escriben únicamente datos temporales en `siga_test`.

## Cómo explicarlo al profesor

1. **Problema y arquitectura:** centralizar usuarios, estructura académica, perfiles, matrículas, cursos, calificaciones y asistencia. Flujo: navegador → API JSON → servicios → Prisma → PostgreSQL. El navegador no accede directamente a la base.
2. **Autenticación:** login con email normalizado y bcrypt → JWT HS256 con `sub`, expiración y `tokenVersion` → cada petición protegida verifica la firma y consulta el usuario actual en PostgreSQL. Cambiar contraseña incrementa `tokenVersion`, invalidando tokens anteriores. Logout solo borra el token local.
3. **Roles:** ADMIN administra usuarios y módulos; SECRETARIA gestiona estructura, estudiantes y matrículas y consulta registros; DOCENTE escribe notas/asistencia solo en asignaciones propias; ESTUDIANTE consulta sus registros. El alcance se aplica antes de contar y paginar, y también en detalle y edición.
4. **Modelos:** EducationLevel→Grade→Section←AcademicPeriod; Student→Enrollment→Section; Teacher y Course→TeachingAssignment→Section; GradeRecord y AttendanceRecord unen asignación y matrícula de la misma sección mediante claves compuestas. Una matrícula con registros no se traslada automáticamente.
5. **Demostración:** ADMIN crea estructura y usuarios; SECRETARIA registra estudiante y matrícula; DOCENTE abre Mi aula y registra nota/asistencia; ESTUDIANTE consulta sus resultados. Mostrar 403 con un rol ajeno y 409 por duplicado usando solo datos temporales de `siga_test`.

## Seguridad y evidencia

Las contraseñas usan bcrypt y se rechazan entradas mayores de 72 bytes UTF-8. Zod usa cuerpos estrictos. Helmet añade cabeceras; CORS permite un origen; login y cambio de contraseña tienen limitador; JSON está limitado a 100 KB. Errores internos no devuelven SQL ni stack trace. Prisma usa operaciones tipadas; las consultas SQL manuales encontradas usan plantillas parametrizadas para verificar destinos.

`backend/tests/integration/production-contract.integration.js` comprueba rutas, cuatro roles, respuestas, errores y controles HTTP en `siga_test`. `course-record.integration.js` prueba alcances, IDOR, cambio de docente y claves compuestas. `session-revocation.integration.js` prueba revocación y concurrencia. Esta evidencia local no representa auditoría externa.

## Despliegue y pendientes

Frontend en Vercel, API en Render y PostgreSQL separado. `VITE_API_URL` contiene solo la dirección pública de la API; secretos y parámetros de JWT permanecen en backend. Migraciones manuales mediante `prisma migrate deploy`, después de comprobar el destino. Ver [despliegue](../operations/deployment.md) y [seguridad y normativa](../security/security-and-regulations.md).

Antes de producción faltan ensayar restauración de respaldos, verificar HTTPS y proxy del entorno concreto, monitoreo, auditoría persistente, carga con umbrales ajustados y revisión legal/operativa institucional. SIGA no sustituye por sí solo a SIAGIE ni implica certificación o cumplimiento total.
