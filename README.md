# Sistema de Gestión Académica (SIGA)

Proyecto académico del curso de Seguridad Informática. Sprint 1: backend para usuarios, roles y autenticación de una institución con niveles Inicial, Primaria y Secundaria. No hay todavía frontend ni modelos académicos.

## Stack y estructura

JavaScript CommonJS, Node.js 24, Express 5, PostgreSQL, Prisma 6, Zod, bcrypt y JWT. Jest y Supertest para pruebas. `backend/src/app.js` configura Express sin abrir un puerto; `server.js` inicia el servidor. Las rutas llaman a controladores, los controladores a servicios y los middlewares protegen las rutas.

## Configurar y ejecutar

Desde `backend/`:

```powershell
npm ci
Copy-Item .env.example .env
npm run prisma:generate
npm run dev
```

En PowerShell con `npm.ps1` bloqueado, utilizar `npm.cmd` en vez de `npm`. En Linux/macOS, copiar el ejemplo con `cp .env.example .env`.

Editar `.env` con una URL real de **PostgreSQL**, un `JWT_SECRET` aleatorio de al menos 32 caracteres y el origen exacto del frontend. El ejemplo de conexión usa `localhost:5433` y credenciales ficticias. `.env` está ignorado por Git. `JWT_EXPIRES_IN=1h` y `BCRYPT_ROUNDS=12` son valores recomendados; el rango admitido de bcrypt es 10–14. La aplicación valida la configuración al iniciar. `GET /api/health` permanece público.

## Bases de datos y migraciones

El esquema define `Role` (`ADMIN`, `SECRETARIA`, `DOCENTE`, `ESTUDIANTE`) y `User`. La migración inicial está en `backend/prisma/migrations/`; prepararla en archivos **no implica** que esté aplicada. Usar una base de desarrollo `siga` y otra separada `siga_test`. No ejecutar tests de integración sobre desarrollo.

Si se autoriza crear ambas bases nuevas en el PostgreSQL local de Windows, estos comandos solicitan la contraseña interactivamente y no la guardan en el repositorio:

```powershell
& 'C:\Program Files\PostgreSQL\18\bin\createdb.exe' -h 127.0.0.1 -p 5433 -U postgres -W siga
& 'C:\Program Files\PostgreSQL\18\bin\createdb.exe' -h 127.0.0.1 -p 5433 -U postgres -W siga_test
```

Una vez creadas las bases y configurada `DATABASE_URL` en `.env`:

```powershell
npm run prisma:validate
npm run prisma:migrate
npm run prisma:generate
```

`prisma:migrate` ejecuta `prisma migrate deploy` sobre **la base indicada por `DATABASE_URL`**. Para migrar la base de pruebas, configurar temporalmente `DATABASE_URL` con la URL de `siga_test` y ejecutar el mismo comando; comprobar el destino antes de hacerlo. No se requiere borrar ni resetear esquemas.

## Primer ADMIN

Después de aplicar la migración en desarrollo, definir `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_FIRST_NAME` y `ADMIN_LAST_NAME` en el entorno local o en `.env`. La contraseña debe tener al menos 12 caracteres y como máximo 72 bytes UTF-8. Ejecutar manualmente:

```powershell
npm run seed:admin
```

Si el email normalizado ya existe, el script termina sin cambiar contraseña, rol ni estado. No se ejecuta automáticamente con `npm ci` o las migraciones. No compartir `.env` ni pegar contraseñas o tokens en comandos versionados.

## API

| Método y ruta | Acceso | Resultado |
| --- | --- | --- |
| `GET /api/health` | Público | Estado del servicio |
| `POST /api/auth/login` | Público, limitado a 5 intentos/15 min por IP | Usuario seguro y token |
| `GET /api/auth/me` | Bearer JWT | Usuario actual |
| `POST /api/users` | ADMIN | Crear usuario (201) |
| `GET /api/users` | ADMIN | Lista sin hashes |
| `PATCH /api/users/:id/status` | ADMIN | Activar o desactivar otro usuario |

El JWT dura por defecto una hora y solo contiene la identidad como `sub`. Cada petición protegida consulta la base para comprobar estado y rol vigentes. Desactivar una cuenta invalida sus tokens anteriores. No existe registro público.

## Pruebas y seguridad

```powershell
npm test
npm audit
```

`npm test` ejecuta Sprint 0 y pruebas HTTP con Prisma simulado; no demuestra una conexión real. Para probar PostgreSQL real, definir `TEST_DATABASE_URL` hacia la base separada **`siga_test`**, aplicar allí la migración y ejecutar:

```powershell
npm run test:integration
```

El runner rechaza URLs que no apunten a `siga_test`; la prueba confirma `current_database()` antes de escribir y elimina únicamente los usuarios que creó. Si la base no está preparada, el comando falla explícitamente. Helmet, CORS de origen explícito, límite JSON de 100 kB, manejo seguro de errores y rate limit protegen las rutas; CORS no sustituye la autenticación.

`package.json` aplica un `override` limitado de `deepmerge-ts` 8.0.0 dentro de Prisma por [GHSA-ggr8-5vv4-36mx](https://github.com/advisories/GHSA-ggr8-5vv4-36mx). Volver a verificar este ajuste al actualizar Prisma.
