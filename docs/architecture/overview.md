# Arquitectura de SIGA

SIGA tiene dos aplicaciones: `frontend/` (React, Vite y React Router) y `backend/` (Express, Sequelize y PostgreSQL). El frontend consume la API HTTP; el backend valida entradas, autentica con JWT, aplica permisos por rol y persiste mediante modelos Sequelize. Las pruebas de integración escriben únicamente en `siga_test`.

En el backend, `src/modules/` agrupa cada recurso por carpeta (`*.routes.js`, `*.validator.js`, `*.controller.js`, `*.service.js`), `src/models/` define las 12 tablas y asociaciones en Sequelize, `src/config/db.js` configura la conexión PostgreSQL, `src/middlewares/` protege las rutas y maneja errores, y `database/` contiene las migraciones SQL. Los scripts se agrupan por propósito: `scripts/setup/` para inicialización manual, `scripts/operations/` para verificaciones y operaciones controladas, y `scripts/testing/` para fixtures y ejecución de pruebas.

Las pruebas del backend están en `tests/unit/` y `tests/integration/`; las del frontend, en `tests/unit/` y `tests/e2e/`. Consulta la [guía de verificación](../operations/verification-guide.md), la [guía de despliegue](../operations/deployment.md) y la [documentación de seguridad](../security/security-and-regulations.md).

Un refactor posterior de `backend/src/` por funcionalidad requeriría revisar límites entre servicios y contratos. No forma parte de esta reorganización.

El [mapa de rutas](path-map.md) registra cada movimiento y las compatibilidades conservadas.
