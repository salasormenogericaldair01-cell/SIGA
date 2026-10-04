# Rendimiento local de SIGA

Ejecución del 3 de octubre de 2026 (America/Lima), con k6 2.2.0, API Express en `127.0.0.1:3000` y PostgreSQL `siga_test` en `127.0.0.1:5433`. Se verificó `current_database() = siga_test` antes de crear los datos y antes de cada escenario. Se usaron 14 registros temporales identificados, eliminados por ID al terminar. El login se realizó una sola vez por rol para obtener tokens locales; ninguna carga apuntó al login. Los resultados detallados permanecen en `tests/performance/results/`, fuera de Git.

| Escenario | Solicitudes | RPS global | p50 | p95 | p99 | Máximo | Fallos HTTP | HTTP 500 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Smoke: 1 VU, 30 s | 209 | 6,91 | 4,90 ms | 11,76 ms | 17,41 ms | 35,93 ms | 0 % | 0 |
| Base: 5 VU, 1 min | 2123 | 34,99 | 4,60 ms | 13,63 ms | 27,76 ms | 58,28 ms | 0 % | 0 |
| Escalones: 10, 20 y 30 VU, 1 min cada uno; luego 0 | 29410 | 133,23 | 4,80 ms | 17,46 ms | 31,45 ms | 158,33 ms | 0 % | 0 |

Todas las comprobaciones HTTP 200 alcanzaron 100 %. La conexión tuvo p95 de 0 ms y máximos de 1,00, 1,50 y 2,53 ms, respectivamente. Los cuatro umbrales provisionales se cumplieron en cada escenario: `http_req_failed < 1 %`, p95 < 1000 ms, comprobaciones > 99 % y cero respuestas 500. No hubo un primer nivel que incumpliera un umbral. El resumen de escalones agrega toda la ejecución; no mide el p95 de cada nivel por separado. Después de volver a cero VU, `/api/health` y `/api/auth/me` de ADMIN y DOCENTE respondieron 200.

La computadora informó 12 procesadores lógicos; no se obtuvo una lectura fiable de RAM. PostgreSQL informó `max_connections = 100` y 11 conexiones en una medición posterior a la carga. No se midieron el pico de conexiones, CPU, RAM ni saturación del pool durante los escalones, por lo que no se puede atribuir un límite observado a PostgreSQL. El backend se mantuvo estable para esta mezcla de lecturas y estos niveles en esta computadora. Tampoco se midió escritura concurrente.

## Observabilidad adicional: máximo de 30 VU

Se repitió solo el nivel máximo anterior: subida a 30 VU en 10 s, 60 s a 30 VU y bajada a 0 en 10 s. El resumen de k6 corresponde a los **80 s completos**, incluidas las rampas: 14 796 solicitudes, 183,41 RPS globales, p95 18,70 ms, p99 30,38 ms, máximo 80,61 ms, 0 % de fallos HTTP, 100 % de comprobaciones correctas y cero respuestas 500. No hay métricas HTTP aisladas del minuto estable; no se atribuyen esos valores exclusivamente a ese minuto.

El monitor obtuvo 16 muestras, cada 2–3 s, durante **35,5 s del tramo estable**. El comienzo de la carga ocurrió después de iniciar el monitor y el muestreo terminó antes del final del minuto estable; por ello los rangos siguientes describen solo la parte observada:

| Medida durante las muestras estables | Resultado observado |
| --- | ---: |
| CPU de Node.js | 75,7–94,5 % de un núcleo; promedio de intervalos 86,1 % |
| RSS de Node.js | 118,8–198,3 MiB |
| Conexiones a `siga_test` | 9–11; máximo observado 11 |
| Conexiones activas a `siga_test` | máximo 2 |
| Suma de RSS de procesos PostgreSQL | 401,0–442,5 MiB, aproximación de todo el servicio local |
| CPU de PostgreSQL | no disponible: Windows no entregó el contador de CPU de esos procesos |

La suma de RSS de PostgreSQL puede contar páginas compartidas más de una vez e incluye procesos de otras bases del mismo servidor; **no** representa memoria física exclusiva de `siga_test`. El máximo configurado era 100 conexiones. Tras volver a 0 VU se observaron 11 conexiones a `siga_test`; no se espera que el pool de la API las cierre inmediatamente. Después de detener la API temporal, la consulta final mostró 1 conexión, correspondiente a la propia verificación. `/api/health` y `/api/auth/me` de ADMIN y DOCENTE respondieron 200 después de la carga. Los 14 registros temporales se eliminaron por ID; la consulta final encontró cero usuarios, estudiantes, periodos y cursos con el prefijo temporal. Los resultados crudos permanecen ignorados por Git.

Estos resultados describen la capacidad observada del equipo local y su base local, no la capacidad de Render, Vercel ni una instalación de producción. La red, recursos compartidos, volumen de datos y configuración de despliegue pueden cambiar las latencias. Como siguiente paso, medir CPU, RAM, conexiones y tiempos de consultas durante cada escalón; revisar índices y `count` de listados paginados con volúmenes representativos; y repetir sobre una infraestructura de ensayo aislada antes de fijar objetivos de servicio. Mantener límites de paginación y detener incrementos ante errores o saturación.
