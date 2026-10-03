# Mapa de rutas reorganizadas

Todos los movimientos se hicieron con `git mv`. Las rutas son relativas a la raíz del repositorio.

| Ruta anterior | Ruta nueva |
| --- | --- |
| `backend/scripts/seed-admin.js` | `backend/scripts/setup/seed-admin.js` |
| `backend/scripts/seed-academic.js` | `backend/scripts/setup/seed-academic.js` |
| `backend/scripts/run-integration-tests.js` | `backend/scripts/testing/run-integration-tests.js` |
| `backend/scripts/seed-demo.js` | `backend/scripts/testing/seed-e2e-fixtures.js` |
| `backend/scripts/cleanup-demo-test.js` | `backend/scripts/testing/cleanup-e2e-fixtures.js` |
| `backend/scripts/verify-demo-target.js` | `backend/scripts/operations/verify-database-target.js` |
| `backend/scripts/backup-render-beta.js` | `backend/scripts/operations/backup-published-database.js` |
| `backend/scripts/beta-data-transition.js` | `backend/scripts/operations/data-transition.js` |
| `backend/scripts/beta-transition-core.js` | `backend/scripts/operations/data-transition-core.js` |
| `backend/scripts/verify-beta-access.js` | `backend/scripts/operations/verify-role-access.js` |
| `backend/tests/*.test.js` | `backend/tests/unit/*.test.js` |
| `backend/tests/setup.js` | `backend/tests/unit/setup.js` |
| `backend/tests/beta-transition.test.js` | `backend/tests/unit/data-transition.test.js` |
| `backend/tests/demo-target.test.js` | `backend/tests/unit/database-target.test.js` |
| `backend/tests/integration/beta-transition.integration.js` | `backend/tests/integration/data-transition.integration.js` |
| `frontend/src/test/app.test.jsx` | `frontend/tests/unit/app.test.jsx` |
| `frontend/src/test/setup.js` | `frontend/tests/unit/setup.js` |
| `frontend/scripts/e2e-mvp.mjs` | `frontend/tests/e2e/mvp.e2e.mjs` |
| `docs/demo.md` | `docs/operations/verification-guide.md` |
| `docs/despliegue-demo.md` | `docs/operations/deployment.md` |
| `docs/transicion-datos-beta.md` | `docs/operations/data-transition.md` |
| `docs/seguridad-y-normativa.md` | `docs/security/security-and-regulations.md` |
| `frontend/public/images/campus-referencial.png` | `frontend/public/images/campus-illustration.png` |

Se conservan los valores `DEMO_*` y `BETA_*` de configuración, las etiquetas de fixtures y el nombre externo `siga_demo_egx3` para no alterar destinos ni datos. Ningún script operativo se eliminó: todos tienen referencias o protecciones que deben conservarse. La carpeta `docs/presentacion/` pertenece al trabajo pendiente de la presentación en otro worktree y se integrará por separado.
