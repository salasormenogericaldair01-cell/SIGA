# Transición controlada de datos publicados

La transición de `siga_demo_egx3` **se completó el 1 de octubre de 2026 (hora de Lima)**. Se generó y verificó un respaldo fuera de Git; `prepare` conservó los registros anteriores mientras se comprobaron por API las seis cuentas nuevas; después `retire` retiró los registros DEMO. La comprobación final de solo lectura confirmó seis usuarios activos, 3 niveles, 14 grados, un periodo y dos registros de cada entidad académica restante. No quedaron etiquetas prohibidas ni relaciones huérfanas. **No vuelvas a ejecutar `prepare` o `retire` sobre el estado actual.**

Los comandos siguientes documentan el orden y las barreras de seguridad utilizados. No se ejecutan en builds, arranques ni migraciones. Una transición distinta requeriría un nuevo respaldo, revisión del estado real y autorización propia.

El destino exclusivo es la base `siga_demo_egx3` de Render en el puerto 5432. Los scripts comprueban protocolo PostgreSQL, TLS, nombre exacto, host declarado por separado, puerto y `current_database()`. Rechazan `siga`, `siga_test` y cualquier otro nombre. El archivo de configuración local `backend/.env.beta.cloud` queda ignorado por Git por la regla `.env.*`.

## Configuración local utilizada

`backend/.env.beta.cloud` contiene estas variables en un archivo local ignorado. No copies sus valores a Git, comandos o conversaciones:

```text
DATABASE_URL
BETA_TARGET
BETA_DATABASE_HOST
BETA_BACKUP_FILE
BETA_ACCESS_PROOF_FILE
BETA_ADMIN_EMAIL / BETA_ADMIN_PASSWORD
BETA_SECRETARIA_EMAIL / BETA_SECRETARIA_PASSWORD
BETA_DOCENTE_A_EMAIL / BETA_DOCENTE_A_PASSWORD
BETA_DOCENTE_B_EMAIL / BETA_DOCENTE_B_PASSWORD
BETA_ESTUDIANTE_A_EMAIL / BETA_ESTUDIANTE_A_PASSWORD
BETA_ESTUDIANTE_B_EMAIL / BETA_ESTUDIANTE_B_PASSWORD
BETA_LEGACY_ADMIN_EMAIL / BETA_LEGACY_SECRETARIA_EMAIL
BETA_LEGACY_DOCENTE_A_EMAIL / BETA_LEGACY_DOCENTE_B_EMAIL
BETA_LEGACY_ESTUDIANTE_A_EMAIL / BETA_LEGACY_ESTUDIANTE_B_EMAIL
```

`BETA_TARGET` debe ser exactamente `siga_demo_egx3`. `DATABASE_URL` es la **External Database URL** de esa base, con puerto explícito 5432 y `sslmode=require`; `BETA_DATABASE_HOST` debe ser exactamente `new URL(DATABASE_URL).hostname`. Los seis correos nuevos son distintos y controlados por el responsable de la demo. Las seis variables `BETA_LEGACY_*_EMAIL` identifican las cuentas anteriores mediante sus correos **actuales**, obtenidos con una consulta de solo lectura; no son cuentas nuevas y no necesitan sus contraseñas. Las contraseñas nuevas deben cumplir las reglas actuales (mínimo 12 caracteres y máximo 72 bytes UTF-8). No reutilizar las credenciales DEMO. Los correos nuevos tampoco pueden incluir etiquetas de datos ilustrativos prohibidas por el script.

`BETA_BACKUP_FILE` apunta al `.dump` generado **fuera del repositorio**; `BETA_ACCESS_PROOF_FILE` también queda fuera. No incluir estos archivos en capturas, entregas o sincronizaciones públicas. El script no imprime la URL, contraseñas, hashes ni tokens. Se utilizó `pg_dump` y `pg_restore` de PostgreSQL 18 para generar y comprobar el respaldo. Listar el archivo no equivale a probar su restauración completa en una base aislada.

## Orden seguido en la transición

Desde `backend/`, cada escritura se ejecutó una sola vez después de verificar el destino y recibir autorización específica:

1. Se ejecutó el script que ahora está en `scripts/operations/backup-published-database.js`. Verificó el destino con consulta de solo lectura, generó un dump personalizado y comprobó que `pg_restore --list` podía leerlo. El comprobante SHA-256 quedó junto al respaldo, fuera de Git.
2. Con la confirmación local `BETA_TRANSITION_CONFIRM=siga_demo_egx3:prepare`, se ejecutó la etapa `prepare` del script ahora ubicado en `scripts/operations/data-transition.js`. La transacción conservó las claves de los niveles y grados existentes, corrigió sus nombres, completó 3 niveles/14 grados y creó seis cuentas nuevas con sus perfiles y datos académicos. El ADMIN anterior permaneció activo hasta completar las comprobaciones.
3. Se comprobó por la API publicada el login y `/api/auth/me` del **nuevo** ADMIN; el script ahora ubicado en `scripts/operations/verify-role-access.js` guardó el comprobante local sin conservar el token.
4. Tras esperar la ventana de 15 minutos del limitador, la etapa `other-roles` del mismo verificador comprobó login y `/api/auth/me` de los otros cinco roles. Todos respondieron HTTP 200. Los comprobantes locales no contienen contraseñas, hashes ni tokens.
5. Después de revisar de nuevo el respaldo y los seis comprobantes vigentes, se ejecutó una sola vez la etapa `retire` del script de transición con `BETA_TRANSITION_CONFIRM=siga_demo_egx3:retire`. La transacción validó el grafo antiguo y retiró únicamente esos registros en orden de dependencias. La confirmación local se dejó vacía al terminar.
6. Las consultas finales de solo lectura confirmaron 6 usuarios, 3 niveles/14 grados, 1 periodo y 2 secciones, estudiantes, docentes, cursos, asignaciones, matrículas, notas y asistencias. Se verificaron 0 registros DEMO, 0 etiquetas prohibidas, 0 relaciones huérfanas y seis cuentas activas con roles correctos.

La etapa `retire` nunca elimina el ADMIN anterior antes del paso 3, y también exige la prueba de los otros roles. Si la etapa `prepare` se repite, se detiene ante sus cuentas existentes; si `retire` se repite, se detiene al no encontrar el conjunto anterior. Ninguna etapa modifica contraseñas de cuentas preexistentes. Los nombres nuevos son neutrales: Administrador general, Secretaría académica, dos docentes por curso y Estudiante 01/02. No se atribuyen a personas ni instituciones reales.

El periodo usa 2026-01-01 a 2026-12-31 y la asistencia 2026-09-30. No ejecutes el seed DEMO ni el script de limpieza de `siga_test` sobre Render.
