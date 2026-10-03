# Demostración de SIGA (MVP académico)

SIGA es un **proyecto académico**, no un sistema listo para producción. Este guion de pruebas locales usa datos ficticios con prefijo `DEMO`; la base publicada ya pasó por una transición a datos ilustrativos sin ese prefijo.

## Arranque

Para el uso habitual, inicia PostgreSQL y luego, en terminales separadas:

```powershell
cd backend
npm ci
npm run dev
```

```powershell
cd frontend
npm ci
npm run dev
```

La API usa `http://localhost:3000/api` y Vite `http://localhost:5173`. Configura los `.env` locales siguiendo los `.env.example`; ambos `.env` están ignorados por Git.

Para verificar con `siga_test`, usa archivos locales ignorados `backend/.env.mvp` y `frontend/.env.mvp`. El primero debe definir `DATABASE_URL` y `TEST_DATABASE_URL` apuntando **solo** a `siga_test` en `127.0.0.1:5433`, `DEMO_TARGET=siga_test`, `PORT=3010`, `CORS_ORIGIN=http://localhost:5174`, un `JWT_SECRET` aleatorio y las seis variables `DEMO_*_PASSWORD` descritas abajo. El segundo contiene `VITE_API_URL=http://localhost:3010/api`. Verifica el destino antes de escribir:

```powershell
cd backend
node --env-file=.env.mvp scripts/operations/verify-database-target.js
node --env-file=.env.mvp scripts/testing/seed-e2e-fixtures.js
node --env-file=.env.mvp src/server.js
```

```powershell
cd frontend
npm run dev -- --port 5174 --mode mvp
npm run test:e2e
```

La prueba E2E usa `playwright-core` con Microsoft Edge instalado; no descarga otro navegador. Realiza cinco logins por ejecución, el límite configurado para una IP cada 15 minutos: para repetirla de inmediato, reinicia **solo la API de pruebas** o espera a que termine la ventana del limitador.

El seed es manual e idempotente: crea cuentas, perfiles, periodo del año actual, dos secciones, cursos, asignaciones, matrículas, una nota y una asistencia por estudiante. Reutiliza niveles y grados activos si ya existen, sin editarlos. Nunca modifica el ADMIN existente, contraseñas o registros encontrados; ante una colisión incompatible se detiene. Requiere `DEMO_ADMIN_PASSWORD`, `DEMO_SECRETARIA_PASSWORD`, `DEMO_DOCENTE_A_PASSWORD`, `DEMO_DOCENTE_B_PASSWORD`, `DEMO_ESTUDIANTE_A_PASSWORD` y `DEMO_ESTUDIANTE_B_PASSWORD`, cada una con al menos 12 caracteres y máximo 72 bytes UTF-8. Guárdalas solo en configuración local ignorada; no las pegues en documentación ni comandos compartidos. El script E2E limpia por ID los registros que crea y revierte el cambio temporal de docente.

Para limpiar únicamente los registros que **este seed creó** en `siga_test`, ejecuta `node --env-file=.env.mvp scripts/testing/cleanup-e2e-fixtures.js`. El comando usa un manifiesto local de IDs y rechaza `siga`. No hay `TRUNCATE` ni limpieza general. El seed se ejecutó manualmente en `siga` y no forma parte del arranque. La base publicada de Render ya tiene seis cuentas y datos académicos nuevos; sus antiguos registros DEMO fueron retirados mediante el procedimiento documentado en [transición de datos](data-transition.md). No repitas el seed DEMO en esa base.

## Guion de 5–7 minutos

1. **ADMIN (2 min):** iniciar sesión, recargar para mostrar recuperación de sesión; abrir Usuarios, Estudiantes, estructura, Cursos y Asignaciones. Mostrar una cuenta vinculada, la sección y el periodo DEMO, y corregir una calificación o asistencia.
2. **SECRETARIA (1 min):** registrar un estudiante sin cuenta, consultar docentes y gestionar su matrícula. Mostrar que Usuarios no está disponible y que notas/asistencia son de consulta.
3. **DOCENTE (1–2 min):** abrir Mi aula, seleccionar su única asignación, consultar matriculados, registrar o corregir una nota y una asistencia. El otro docente tiene otra asignación.
4. **ESTUDIANTE (1 min):** abrir Mis calificaciones y Mi asistencia; señalar curso, bimestre y fecha, y que los resultados son solo los propios.
5. **Seguridad (1 min):** sin sesión, `GET /api/users` responde 401; con el token de SECRETARIA o DOCENTE, el mismo endpoint responde 403. Otro ejemplo: el DOCENTE A obtiene 403 al consultar el detalle de la asignación del DOCENTE B. Mostrar respuestas sin hashes ni secretos.

## Límites actuales

Hay una calificación por curso, matrícula y bimestre; no se calculan promedios ni competencias. Un traslado de matrícula se bloquea si existen notas o asistencias asociadas, para conservar la correspondencia histórica. El logout borra el token local, pero no revoca un JWT ya emitido. La auditoría persistente de cambios está pendiente. La protección visual complementa, pero no reemplaza, la autorización de la API.
