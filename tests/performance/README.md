# Carga local de solo lectura

Estos escenarios se ejecutan exclusivamente contra `http://127.0.0.1:3000/api` y PostgreSQL `siga_test` en el puerto 5433. El lanzador verifica `DATABASE_URL`, `TEST_DATABASE_URL`, `current_database()` y un comprobante del proceso local antes de iniciar cada carga. No apuntar a servicios publicados.

Requisitos: Node.js, dependencias del backend, PostgreSQL local y k6. La ejecución documentada en `docs/security/performance-results.md` utilizó k6 2.2.0. Usar un archivo de entorno local ignorado por Git que configure `DATABASE_URL` y `TEST_DATABASE_URL` exclusivamente para `siga_test`; nunca escribir tokens en comandos, URL ni archivos versionados. En un worktree, indicar la ruta absoluta de ese archivo si está guardado en otro checkout.

Desde la raíz del proyecto, iniciar la API temporal con `NODE_ENV=test` y `PORT=3000` mediante `node --env-file=<ruta-local-ignorada> tests/performance/serve-local.cjs`. En otra terminal, con el mismo entorno, ejecutar secuencialmente:

```text
node --env-file=<ruta-local-ignorada> tests/performance/fixtures.cjs prepare
node --env-file=<ruta-local-ignorada> tests/performance/run-local.cjs smoke
node --env-file=<ruta-local-ignorada> tests/performance/run-local.cjs base
node --env-file=<ruta-local-ignorada> tests/performance/run-local.cjs staged
node --env-file=<ruta-local-ignorada> tests/performance/run-local.cjs recovery
node --env-file=<ruta-local-ignorada> tests/performance/fixtures.cjs cleanup
```

En PowerShell, configurar `$env:NODE_ENV='test'` y `$env:PORT='3000'` antes de iniciar el servidor. Si falla un escenario, no continuar aumentando carga; ejecutar la limpieza por ID y revisar el log local. `prepare` crea datos temporales identificados y obtiene una vez los tokens de tres roles. La carga solo hace lecturas: health, sesión, catálogos, cursos, asignaciones, matrículas paginadas, calificaciones, asistencia y Mi aula. El login no es objetivo de carga. Los perfiles son 1 VU/30 s, 5 VU/1 min y escalones a 10, 20 y 30 VU durante 1 min por nivel, seguidos de 0. Se detienen si aparecen respuestas 500, fallos HTTP >=1 %, p95 >=1000 ms o comprobaciones <=99 %.

Resúmenes, logs, tokens y manifiestos quedan en `tests/performance/results/`, ignorado por Git. `cleanup` elimina únicamente los IDs del manifiesto; verificar su resultado aun cuando falle la carga. El servidor temporal debe detenerse al terminar. Estos límites y mediciones locales no estiman capacidad de producción.

`load.js` admite escalones posteriores mediante `K6_STAGES` con formato `30s:2,1m:5,30s:0`, hasta 30 VU y 10 minutos. Antes de usarlo, mantener las mismas verificaciones del destino y los tokens locales; no ejecutar k6 directamente contra una URL pública.

Para observar de nuevo el máximo, ejecutar `monitor-local.cjs` en una terminal y, enseguida, `run-local.cjs steady30` en otra, ambos con el mismo archivo de entorno local y `NODE_ENV=test`. El perfil sube a 30 VU, los mantiene 1 minuto y vuelve a cero; el monitor guarda muestras de procesos y conexiones en la ruta ignorada. Terminar con `run-local.cjs recovery`, `inspect.cjs` y `fixtures.cjs cleanup`. La CPU de PostgreSQL puede no estar disponible en Windows; no interpretar un contador faltante como cero.
