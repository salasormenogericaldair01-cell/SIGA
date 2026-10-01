# Despliegue de la demo SIGA

Esta guía prepara una **demo académica con datos ficticios**. No crea servicios ni publica código por sí sola. El backend publicado responde en `https://siga-lud0.onrender.com`; la base de Render informada para esta demo se llama exactamente `siga_demo_egx3`, independiente de `siga` y `siga_test` locales. Comprueba el plan y vigencia de la base: la [base gratuita de Render caduca a los 30 días](https://render.com/docs/service-types).

## 1. PostgreSQL en Render

La base ya creada tiene **Database Name: `siga_demo_egx3`** y puerto **5432**. Anota, en tu gestor local de secretos, las URL **Internal** y **External** y sus respectivos hosts; no las copies al repositorio. La API en Render usa la URL interna. Para verificar y sembrar desde tu equipo usarás temporalmente la externa con `sslmode=require` y acceso de red limitado a tu IP; después podrás restringir o desactivar ese acceso externo. [Conexiones de Render Postgres](https://render.com/docs/postgresql-creating-connecting).

## 2. API en Render

Crea un **Web Service** del mismo repositorio, con estos campos:

| Campo de Render | Valor |
| --- | --- |
| Root Directory | `backend` |
| Runtime | `Node` |
| Node version | 24.x; fija `NODE_VERSION` a una versión 24 disponible si Render selecciona otra |
| Build Command | `npm ci --include=dev && npm run prisma:generate && npm run verify:demo-target && npm run prisma:migrate` |
| Start Command | `npm start` |
| Health Check Path | `/api/health` |

El build instala Prisma CLI, genera el cliente, **comprueba el destino** y aplica las migraciones existentes con `prisma migrate deploy`. Este último comando es idempotente, pero requiere acceso a la base durante el build. No se ejecuta ningún seed al construir o arrancar. En planes que incluyan *Pre-Deploy Command*, puedes mover `npm run verify:demo-target && npm run prisma:migrate` a ese campo y dejar `npm ci --include=dev && npm run prisma:generate` como build; Render indica que el pre-deploy no está disponible para el Web Service gratuito. [Fases de despliegue de Render](https://render.com/docs/deploys).

Configura estas variables en **Environment** del servicio web:

| Variable | Valor que debes completar |
| --- | --- |
| `DATABASE_URL` | URL **Internal** de `siga_demo_egx3`; comprueba el nombre final de la base |
| `DEMO_TARGET` | `siga_demo_egx3` |
| `DEMO_DATABASE_HOST` | Solo el host de esa URL Internal, sin protocolo, puerto, usuario ni contraseña |
| `NODE_ENV` | `production` |
| `JWT_SECRET` | Secreto aleatorio nuevo de al menos 32 caracteres, solo en Render |
| `JWT_EXPIRES_IN` | `1h` |
| `BCRYPT_ROUNDS` | `12` |
| `CORS_ORIGIN` | Origen HTTPS **exacto** del frontend de Vercel, sin barra final ni ruta |
| `TRUST_PROXY_HOPS` | `1` para el proxy inmediato de Render |
| `PORT` | Deja que Render lo proporcione; si lo defines, usa el puerto asignado al servicio |

La API escucha en `0.0.0.0:$PORT`. CORS solo permite el origen configurado. `TRUST_PROXY_HOPS=1` confía únicamente en el salto inmediato para que el límite de intentos distinga las IP reenviadas; verifica su comportamiento tras publicar si cambia la topología del proxy. El limitador actual usa memoria del proceso: los contadores se reinician al reiniciar y no se comparten entre instancias. CORS no reemplaza la autenticación ni los permisos. [Puertos de Render](https://render.com/docs/web-services), [proxies en Express](https://expressjs.com/en/guide/behind-proxies.html).

## 3. Frontend en Vercel

Importa el mismo repositorio como proyecto **Vite** y completa:

| Campo de Vercel | Valor |
| --- | --- |
| Root Directory | `frontend` |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Node.js Version | `24.x` |
| Environment Variable `VITE_API_URL` | `https://siga-lud0.onrender.com/api` |

`frontend/vercel.json` reescribe las rutas de React Router hacia `index.html`, por lo que una recarga de `/login` o `/students` no debe devolver 404. `VITE_API_URL` es pública y se incorpora al JavaScript durante el build; **no pongas contraseñas, tokens ni secretos en variables `VITE_*`**. Al conocer el dominio final de Vercel, actualiza `CORS_ORIGIN` en Render con ese origen exacto y vuelve a desplegar la API. Los dominios de preview de Vercel no quedan permitidos automáticamente. [Vite en Vercel](https://vercel.com/docs/frameworks/frontend/vite), [Root Directory](https://vercel.com/docs/builds/configure-a-build).

## 4. Seed manual con contraseñas locales

Desde `backend/` del worktree de preparación, guarda la **External Database URL** en `.env.demo.cloud`, archivo local ignorado por Git. Deja estas tres variables, completando las dos vacías desde la URL externa de Render **en tu editor, nunca por chat**:

```dotenv
DEMO_TARGET=siga_demo_egx3
DEMO_DATABASE_HOST=
DATABASE_URL=
```

`DEMO_DATABASE_HOST` es solo el host de la URL externa, sin usuario, contraseña, protocolo ni puerto. La URL debe nombrar `siga_demo_egx3`, usar el puerto 5432 y requerir TLS con `sslmode=require`. Mantén las seis variables `DEMO_*_PASSWORD` actuales en el `.env.demo` ignorado del checkout principal; no copies sus valores a Vercel, Render, el código ni este worktree. Node 24 permite cargar ese archivo por ruta y luego `.env.demo.cloud`, que sustituye el destino local.

**Primero, solo lectura:**

```powershell
cd backend
node --env-file=.env.demo.cloud scripts/verify-demo-target.js
node --env-file=.env.demo.cloud ./node_modules/prisma/build/index.js migrate status
```

El verificador consulta `current_database()` y `inet_server_port()`; debe confirmar `siga_demo_egx3` y 5432 antes de cualquier escritura. Como el build de Render puede haber aplicado las migraciones, **consulta el estado antes de desplegarlas otra vez**. Estos comandos quedan preparados para una ejecución manual posterior, cuando hayas revisado el resultado anterior:

```powershell
node --env-file=.env.demo.cloud scripts/verify-demo-target.js
node --env-file=.env.demo.cloud ./node_modules/prisma/build/index.js migrate deploy
node --env-file=../../../backend/.env.demo --env-file=.env.demo.cloud scripts/seed-demo.js
```

La última ruta reutiliza las contraseñas ignoradas del checkout principal cuando trabajas desde un worktree bajo `.worktrees/`; si ejecutas desde un checkout que ya contiene `backend/.env.demo`, usa `--env-file=.env.demo` en su lugar. Ejecuta el seed **solo después** de aplicar las migraciones. Valida sus reglas, crea registros DEMO de forma idempotente y se detiene ante colisiones incompatibles; no cambia contraseñas ni usuarios existentes. No ejecutes `cleanup:demo-test` en la nube: esa limpieza está limitada a `siga_test`. El manifiesto local del seed queda ignorado por Git. Si una cuenta DEMO ya existe con otra contraseña o rol, investiga la colisión; no fuerces una sobrescritura.

## Comprobación antes de compartir la URL

Comprueba `GET /api/health`, login y `GET /api/auth/me` en la API; desde Vercel, recarga una ruta interna y prueba los módulos de cada rol. Verifica que el navegador no tenga errores de CORS ni contenido mixto, que el limitador de login funciona detrás del proxy y que el seed se ejecutó solo en `siga_demo_egx3`. Usa exclusivamente datos ficticios. Esta demo académica no sustituye una revisión de seguridad, privacidad, respaldos y recuperación para datos reales; las brechas están en [seguridad-y-normativa.md](seguridad-y-normativa.md).
