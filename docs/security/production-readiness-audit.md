# Auditoría preliminar de preparación para producción

Alcance: código en `feature/production-readiness`, pruebas locales contra `siga_test`. No se probó la infraestructura publicada ni se realizó pentest externo.

| Revisión | Evidencia encontrada | Riesgo o tarea pendiente |
|---|---|---|
| SQL | No hay `$queryRawUnsafe` ni `$executeRawUnsafe` en `backend/src` o scripts versionados. Los usos de `$queryRaw` son plantillas etiquetadas constantes para verificar el destino de base. Los filtros de usuario se construyen con Prisma, no SQL concatenado. | Mantener revisión automática ante nuevas consultas raw. |
| Campos sensibles | `PATCH /auth/me` solo acepta `firstName,lastName`; `PATCH /users/:id/status` solo `isActive` y solo ADMIN, con bloqueo de autodesactivación. No hay endpoint para editar rol, email, `tokenVersion` o `passwordHash`. | Las operaciones administrativas directas en base quedan fuera de este contrato HTTP. |
| BOLA/IDOR | Listas de asignaciones y registros aplican `where` por perfil antes de contar y paginar; detalles y PATCH comprueban pertenencia. `course-record.integration.js` cubre cruces de docentes y estudiantes y cambio de titular. | Repetir en un entorno similar a producción, sin datos reales. |
| Sesiones | JWT verifica firma HS256, expiración y `tokenVersion`; cada petición consulta rol y estado actual en PostgreSQL. `session-revocation.integration.js` cubre revocación tras cambio de contraseña. | No existen sesiones individuales ni revocación del logout local. |
| Errores y respuestas | Errores inesperados devuelven mensaje genérico 500; el log global solo imprime tipo/código. Selectores Prisma evitan `passwordHash` en respuestas relacionadas. | Revisar logs del proveedor, configuración de retención y alertas. |
| HTTP | Helmet, rechazo 403 de `Origin` distinto del permitido, CORS de origen explícito, límite JSON 100 KB, rate limit de login y cambio de contraseña. `TRUST_PROXY_HOPS` está limitado a 0 o 1. | Un cliente fuera del navegador puede omitir o falsear `Origin`: CORS no sustituye JWT ni autorización. Verificar origen/proxy reales y TLS antes de publicar como producción. |

La prueba nueva `production-contract.integration.js` cubre inyección en login, filtros, UUID y texto; elevación mediante campos inesperados; cuatro roles; JWT alterado, expirado, revocado e inactivo; CORS, cabeceras, limitador y cuerpo excesivo. El body >100 KB responde **413**, que es el código esperado para tamaño: la condición de 400/401/403/404 se refiere a payloads de ataque dentro del límite, no a este control de transporte. Duplicados responden 409. Ningún payload de inyección probado produjo 500 ni escrituras inesperadas. No se afirma seguridad general a partir de este conjunto finito de pruebas.

## Sincronización de versiones implementada

- API: `BUILD_SHA` opcional o `RENDER_GIT_COMMIT` automático; `/api/health` publica `version` como ocho hexadecimales, o `unknown`. No ejecuta `git` por petición ni devuelve host, IP, rutas o variables. El frontend deja el mismo formato en `meta[name="siga-build"]` usando `VITE_BUILD_SHA` o `VITE_VERCEL_GIT_COMMIT_SHA`.
- El SHA del frontend y del backend puede diferir si solo cambió uno; comparar por directorio y contrato, no exigir igualdad absoluta. No se verificó el valor en despliegues publicados en esta tarea.
