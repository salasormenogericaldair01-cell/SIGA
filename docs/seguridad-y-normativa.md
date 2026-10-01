# Seguridad y protección de datos en SIGA

SIGA es un proyecto académico para gestionar Educación Básica (Inicial, Primaria y Secundaria). Su alcance actual comprende cuentas, perfiles, estructura académica, matrículas, cursos, asignaciones, una calificación por curso y bimestre, y asistencia individual. No gestiona apoderados, vacantes, Ficha Única de Matrícula, evaluación por competencias ni los procedimientos oficiales completos. **No sustituye al SIAGIE ni constituye una implementación autorizada o certificada por el MINEDU.** Esta matriz relaciona normas con controles observables del código; no declara cumplimiento legal total. Antes de usar datos reales habría que determinar la entidad responsable, la base jurídica aplicable y las medidas organizativas con asesoría competente.

## Datos y acceso actual

| Datos | Acceso permitido por la API |
| --- | --- |
| Cuentas: correo, nombres, rol, estado y hash de contraseña | ADMIN crea y lista cuentas; cada usuario autenticado consulta su información segura. El hash no aparece en respuestas. SECRETARIA, DOCENTE y ESTUDIANTE no listan usuarios. |
| Ficha Student: código, nombres, fecha de nacimiento, cuenta opcional y estado | ADMIN y SECRETARIA consultan y gestionan fichas y matrículas. La ficha puede existir sin cuenta User. |
| Ficha Teacher y asignaciones | ADMIN crea/edita perfiles; ADMIN y SECRETARIA los consultan. DOCENTE consulta únicamente sus asignaciones y estudiantes matriculados en ellas. |
| Calificaciones y asistencia | ADMIN consulta y corrige; SECRETARIA consulta; DOCENTE consulta y escribe solo en sus asignaciones actuales; ESTUDIANTE consulta solo sus propios registros si tiene perfil vinculado. |

Los nombres mostrados en Matrículas provienen de `Student`, no de `User`. Los identificadores UUID siguen siendo internos. El frontend oculta acciones por rol, pero el control efectivo se aplica en rutas y servicios del backend, incluidos detalles, filtros y paginación.

## Matriz de fundamentos y brechas

| Norma / artículo o apartado | Obligación o criterio | Control de SIGA | Evidencia verificable | Limitación | Tarea pendiente |
| --- | --- | --- | --- | --- | --- |
| [Ley 29733](https://www.gob.pe/institucion/anpd/normas-legales/2018427-29733-2011), arts. 6–8 | Finalidad determinada, datos proporcionales y calidad de los datos. | Campos acotados; Zod valida entradas; ficha Student separada de cuenta opcional. | `backend/prisma/schema.prisma`, `backend/src/validators/people-enrollment.validator.js`. | No se ha definido formalmente la finalidad de un tratamiento real ni un plazo de conservación. | Definir finalidad, inventario, base jurídica y reglas de conservación antes de operar con personas reales. |
| [Ley 29733](https://www.gob.pe/institucion/anpd/normas-legales/2018427-29733-2011), arts. 9, 16 y 17 | Seguridad y confidencialidad adecuadas al tratamiento. | Bcrypt para contraseñas; JWT verificado; roles y alcance por recurso; respuestas sin `passwordHash`; Helmet, límite de body y CORS explícito. | `backend/src/services/auth.service.js`, `backend/src/middlewares/auth.middleware.js`, `backend/src/services/record-access.service.js`, pruebas de permisos. | Estas medidas de software no acreditan medidas organizativas ni seguridad de despliegue. | Evaluar riesgos, gestión de accesos, HTTPS, respaldos, monitoreo y procedimientos internos. |
| [Ley 29733](https://www.gob.pe/institucion/anpd/normas-legales/2018427-29733-2011), arts. 18–20 | Información previa y ejercicio de acceso/rectificación, según corresponda. | ADMIN y SECRETARIA pueden corregir fichas; el estudiante con perfil vinculado ve sus notas y asistencia. | Rutas `/api/students`, `/api/grade-records`, `/api/attendance-records`. | No hay aviso de privacidad, canal de solicitudes ni procedimiento completo para derechos del titular; el estudiante no edita su ficha. | Definir responsable y canal, aviso, verificación de identidad y procedimiento para atender solicitudes. |
| [D. S. 016-2024-JUS](https://www.gob.pe/institucion/anpd/normas-legales/6554453-16-2024-jus), arts. 34–35 | Criterios para notificar y documentar incidentes de seguridad de datos personales. | Errores HTTP no exponen trazas o hashes. | `backend/src/middlewares/error.middleware.js`. | No hay registro persistente de incidentes ni flujo de evaluación/notificación. | Diseñar respuesta a incidentes, responsables y evidencia de incidentes; evaluar las notificaciones exigibles en cada caso. |
| [R. M. 010-2026-MINEDU](https://www.gob.pe/institucion/minedu/normas-legales/7603336-010-2026-minedu), norma técnica de matrícula en Educación Básica | El proceso oficial regula ingreso y continuidad; contempla registro en SIAGIE. | Relación estudiante–sección–periodo, unicidad por estudiante y periodo, estados ACTIVE/CANCELLED y restricciones de integridad. | `backend/prisma/schema.prisma`, `backend/src/services/enrollment.service.js`, pruebas de integración. | SIGA no implementa la FUM, vacantes, representantes, traslado oficial ni registro en SIAGIE. | Analizar el procedimiento completo antes de cualquier uso institucional; mantener el registro oficial por los canales correspondientes. |
| [R. V. M. 094-2020-MINEDU](https://www.gob.pe/institucion/minedu/normas-legales/541161-094-2020-minedu), norma de evaluación, apartado 5.1 | La evaluación de Educación Básica se organiza alrededor de competencias y evidencias. | Valores AD, A, B y C, asociados a matrícula y asignación. | `backend/prisma/schema.prisma` (`GradeRecord`), `backend/src/services/academic-record.service.js`. | Una nota por curso y bimestre es una simplificación académica; no representa evaluación por competencias ni resultados oficiales. | Modelar competencias, evidencias y reglas pedagógicas solo tras especificación validada. |
| [R. V. M. 048-2024-MINEDU](https://www.gob.pe/institucion/minedu/normas-legales/5518274-048-2-24-minedu), modificación de la norma de evaluación | Precisa cortes por periodo, niveles de logro y registro en SIAGIE. | SIGA admite bimestres 1–4 y valores AD/A/B/C. | `backend/src/validators/course-record.validator.js`, pruebas de calificaciones. | No configura trimestre/semestre, conclusiones descriptivas ni situación final del estudiante. | Comparar el modelo con la norma vigente antes de diseñar evaluación oficial; no presentar estas notas como actas o certificados. |

La elección de Express, JWT, bcrypt, Zod, UUID y las reglas de interfaz son **decisiones técnicas del proyecto**, no mandatos literales de esas normas. La entidad que llegara a tratar datos reales tendría que decidir y documentar las medidas apropiadas para su contexto. La [base legal del SIAGIE](https://siagie.minedu.gob.pe/baselegal/) describe su función de registro administrativo de la trayectoria educativa.

## Confidencialidad, integridad y disponibilidad

- **Confidencialidad:** acceso autenticado, roles y alcance por asignación o matrícula. Los JWT usan HS256 y expiración; cada petición protegida consulta el estado y rol actuales en PostgreSQL. No hay registro público. Las contraseñas se almacenan como hash bcrypt, con mínimo de 12 caracteres y rechazo por encima de 72 bytes UTF-8.
- **Integridad:** Zod valida cuerpos y filtros; PostgreSQL impone unicidad y claves compuestas para periodo/sección y registros académicos; los servicios usan transacciones donde corresponde. No hay borrado físico desde la API. Estas restricciones no sustituyen revisión humana de datos erróneos.
- **Disponibilidad:** hay tests, migraciones y una base de pruebas separada, pero no existe en este repositorio una política de respaldos, prueba de restauración, monitoreo ni plan de recuperación. No puede afirmarse continuidad del servicio.

## Estado de controles operativos

| Control | Estado comprobable en esta rama |
| --- | --- |
| Autenticación y autorización | Login con JWT; rol y cuenta activa se consultan en cada petición; `DOCENTE` y `ESTUDIANTE` tienen alcance limitado a sus recursos. |
| Contraseñas | Solo `passwordHash` bcrypt en la base. No hay cambio de contraseña autoservicio en el código de esta rama. |
| Revocación de sesiones | Desactivar la cuenta bloquea su token. El logout elimina el token del navegador, pero no revoca el JWT emitido. Un cambio externo de `passwordHash` no invalida por sí solo los JWT previos; no existe `tokenVersion` en este punto de `develop`. |
| Registro y auditoría | No hay registro público de cuentas. No existe auditoría persistente de altas, cambios, accesos o incidentes. Los timestamps de modelos no son una bitácora de auditoría. |
| HTTPS | La configuración local usa HTTP. Helmet y CORS no cifran el transporte ni sustituyen TLS. No hay terminación HTTPS configurada en el proyecto. |
| Respaldos y recuperación | No hay respaldo automatizado, política de retención ni restauración probada en el repositorio. |

Este documento refleja `feature/student-labels-security-docs` creada desde `develop`; los cambios aún no integrados de otras ramas no se consideran controles implementados aquí.
