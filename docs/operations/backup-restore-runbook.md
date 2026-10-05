# Respaldo y restauración de PostgreSQL para SIGA

Este procedimiento restaura un archivo `pg_dump` **custom** en una base nueva y aislada. No sustituye una base en uso ni autoriza borrar datos. El ensayo del 5 de octubre de 2026 usó PostgreSQL local **18.6** (`pg_dump` y `pg_restore` 18.6), una base temporal vacía y el respaldo previo de la beta. La restauración terminó sin errores; el backend local respondió 200 en health, login ADMIN y `/api/auth/me`. La base temporal se eliminó al terminar. Mantener el dump y las credenciales fuera de Git.

## Antes de restaurar

1. Confirmar la versión del servidor y de `pg_dump`/`pg_restore`; usar herramientas compatibles con la versión que produjo el archivo. Comprobar `pg_restore --list <archivo.dump>`, tamaño mayor que cero y checksum contra un comprobante confiable. Una lista legible no demuestra recuperación completa.
2. Fijar por escrito **host, puerto y nombre exacto** del destino. Para un ensayo local: `127.0.0.1:5433`, base **nueva** `siga_restore_test`. Consultar `current_database()`, `host(inet_server_addr())`, `inet_server_port()` y `current_setting('server_version')` antes de crear o restaurar. No usar la URL de Render como destino local.
3. Comprobar en `pg_database` que `siga_restore_test` no existe. Si existe, detenerse; no reciclarla ni vaciarla. Crear solo esa base y conectarse explícitamente a ella. Confirmar otra vez nombre, host, puerto y **cero tablas de usuario** antes de restaurar. Usar credenciales locales privadas sin imprimirlas.
4. Guardar logs y archivos SQL auxiliares fuera del repositorio, con acceso restringido, y eliminarlos tras la revisión. El dump puede contener datos y hashes de contraseñas: tratarlo como material confidencial.

## Restauración aislada

Con el destino validado y una base vacía, ejecutar una orden equivalente a:

```text
pg_restore --exit-on-error --single-transaction --no-owner --no-privileges --no-password --host 127.0.0.1 --port 5433 --dbname siga_restore_test RUTA_PRIVADA_DEL_DUMP
```

Pasar el usuario y la contraseña mediante el mecanismo privado local, nunca en la línea de comandos ni en el informe. No usar `--clean` ni `--create`: el primero podría borrar objetos existentes y el segundo puede dirigir la restauración a un nombre contenido en el archivo. Si falla cualquier comprobación o restauración, detenerse y revisar la base temporal; no ejecutar comandos destructivos a ciegas.

## Verificación posterior

- Consultar los conteos esperados por entidad. Para el respaldo beta ensayado: 6 usuarios, 3 niveles, 14 grados, 1 periodo y 2 secciones, estudiantes, docentes, cursos, asignaciones, matrículas, notas y asistencias de cada entidad.
- Comprobar `_prisma_migrations`: cinco migraciones finalizadas, ninguna revertida, nombres y checksums concordantes con los archivos versionados. En un checkout Windows, normalizar finales de línea CRLF antes de interpretar una diferencia de checksum; no cambiar las migraciones para ocultar un desacuerdo real.
- Comparar de forma normalizada el esquema extraído con `pg_restore --schema-only --no-owner --no-privileges` y el esquema de la copia con `pg_dump --schema-only --no-owner --no-privileges`. Revisar tablas, columnas y tipos, enums, claves primarias y foráneas, índices únicos, restricciones compuestas y secuencias. Ignorar solo comentarios, propietarios, ACL y metadatos de entorno. En el ensayo coincidieron 222 líneas normalizadas.
- Verificar cero relaciones huérfanas y cero etiquetas prohibidas; roles y cuentas activas; perfiles vinculados; periodo de cada sección y matrícula; sección compartida por asignación, matrícula, nota y asistencia. Revisar fechas del periodo y asistencias.
- Crear una configuración **temporal fuera de Git** que apunte solo a la copia, con secreto JWT aleatorio, puerto alternativo y CORS local. Iniciar el backend ligado a `127.0.0.1`; probar health, un login controlado y `/api/auth/me` sin registrar contraseñas ni tokens. Detenerlo, confirmar que el puerto quedó libre y repetir los conteos.

## Limpieza del ensayo

Con el servidor temporal detenido, conectarse otra vez a `siga_restore_test` y verificar nombre, host y puerto exactos. Desde una conexión administrativa a otra base local, cerrar **solo** sesiones cuyo `datname` sea `siga_restore_test`; eliminar **solo** `siga_restore_test`. Confirmar su ausencia, la presencia y conteos sin cambios de las bases protegidas, y el tamaño y checksum del dump original. Si falla la validación del destino, **no eliminar nada**. Borrar logs, SQL y configuración temporal fuera del repositorio; conservar el respaldo original.

## Recuperación en Render u otro PostgreSQL compatible

Crear una **nueva** base compatible y vacía en el proveedor, con nombre y destino aprobados. Antes de cualquier escritura, confirmar host, puerto, TLS y `current_database()`; guardar un respaldo vigente de la base existente. Restaurar allí sin `--clean` ni `--create`, repetir migraciones, comparación de esquema, conteos, integridad y prueba funcional con una API aislada. Solo después de aprobación y un plan de reversión cambiar la conexión de la aplicación. No restaurar directamente sobre una base publicada que tenga datos sin una decisión explícita sobre conservación y tiempo de interrupción.

Para mantenimiento desde la PC autorizada, la regla externa `/32` debe corresponder a su IP pública actual; si cambia, actualizarla en Render antes de conectarse. Mantener la conexión interna del backend y TLS externo. No abrir `0.0.0.0/0` como atajo.

**Frecuencia sugerida:** respaldo antes de cada migración o cambio de datos y, mientras la beta esté activa, uno diario; conservar, por ejemplo, siete diarios y cuatro semanales en almacenamiento privado y cifrado. Verificar tamaño, checksum y `pg_restore --list` tras cada copia; ensayar periódicamente una restauración aislada. Ajustar esta política a la sensibilidad de los datos y al almacenamiento disponible. [Render indica](https://render.com/docs/free) que su PostgreSQL gratuito **expira 30 días después de la creación** y no incluye respaldos administrados; existe un plazo adicional de 14 días para actualizar antes de la eliminación. La **fecha exacta de vencimiento de esta instancia no consta en el repositorio**: confirmarla en el panel y programar el respaldo y la decisión de continuidad antes de esa fecha. El ensayo de recuperación no garantiza disponibilidad continua ni sustituye un plan de respaldo operado regularmente.
