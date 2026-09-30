# Sistema de Gestión Académica (SIGA)

Proyecto académico del curso de Seguridad Informática. El backend incluye usuarios, roles, autenticación y la estructura académica de niveles, grados, periodos y secciones. Aún no hay frontend, matrículas, cursos ni calificaciones.

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

El esquema define `Role`, `User`, `EducationLevel`, `Grade`, `AcademicPeriod` y `Section`. Las migraciones aditivas están en `backend/prisma/migrations/`. Usar `siga` para desarrollo y `siga_test` para integración; no ejecutar tests de integración sobre desarrollo.

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
| `GET /api/education-levels`, `/api/grades`, `/api/academic-periods`, `/api/sections` | ADMIN, SECRETARIA | Listar, incluidos inactivos |
| `GET /api/{recurso}/:id` | ADMIN, SECRETARIA | Consultar detalle |
| `POST /api/{recurso}` | ADMIN, SECRETARIA | Crear (201) |
| `PATCH /api/{recurso}/:id` | ADMIN, SECRETARIA | Editar campos permitidos |

El JWT dura por defecto una hora y solo contiene la identidad como `sub`. Cada petición protegida consulta la base para comprobar estado y rol vigentes. Desactivar una cuenta invalida sus tokens anteriores. No existe registro público.

Los recursos académicos son `education-levels`, `grades`, `academic-periods` y `sections`. Todos admiten el filtro opcional `isActive=true|false`; grados admiten `educationLevelId` y secciones `gradeId` y `academicPeriodId`. Sin filtros se devuelven activos e inactivos, ordenados por creación e ID. No hay DELETE ni paginación. DOCENTE y ESTUDIANTE reciben 403 y una petición sin token recibe 401.

Los niveles tienen códigos únicos `INICIAL`, `PRIMARIA` y `SECUNDARIA`. Cada grado tiene un `order` único dentro de su nivel: Inicial 3–5, Primaria 1–6 y Secundaria 1–5. Una sección es única por grado, periodo y nombre; el nombre se normaliza a mayúsculas. Los periodos requieren `startDate < endDate` con fechas `AAAA-MM-DD`, también al editar solo una fecha. La inactivación conserva los registros y referencias, pero impide crear grados o secciones asociados a registros inactivos. `isActive` no implica que sea el único periodo vigente.

El seed académico es **manual** e idempotente: crea solo los tres niveles y sus 14 grados faltantes; conserva nombres y estados ya existentes y no crea periodos, secciones ni usuarios. Tras verificar que `DATABASE_URL` apunta a `siga` en el puerto 5433, ejecutar desde `backend/`:

```powershell
npm run seed:academic
```

Para verificar el estado de las migraciones:

```powershell
npx prisma migrate status
```

Repetir el comando con `DATABASE_URL` apuntando a `siga_test` para consultar esa base; el comando no aplica migraciones.

## Pruebas y seguridad

```powershell
npm test
npm audit
```

`npm test` ejecuta Sprint 0 y pruebas HTTP con Prisma simulado; no demuestra una conexión real. Para probar PostgreSQL real, definir `TEST_DATABASE_URL` hacia la base separada **`siga_test`**, aplicar allí las migraciones y ejecutar:

```powershell
npm run test:integration
```

El runner rechaza URLs que no apunten a `siga_test`; la prueba confirma `current_database()` antes de escribir y elimina únicamente los usuarios que creó. Si la base no está preparada, el comando falla explícitamente. Helmet, CORS de origen explícito, límite JSON de 100 kB, manejo seguro de errores y rate limit protegen las rutas; CORS no sustituye la autenticación.

`package.json` aplica un `override` limitado de `deepmerge-ts` 8.0.0 dentro de Prisma por [GHSA-ggr8-5vv4-36mx](https://github.com/advisories/GHSA-ggr8-5vv4-36mx). Volver a verificar este ajuste al actualizar Prisma.
