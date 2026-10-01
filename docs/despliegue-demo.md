# Despliegue de la demo SIGA

Esta guía prepara una **demo académica con datos ficticios**. No crea servicios ni publica código por sí sola. La base de Render debe ser independiente de `siga` y `siga_test` locales y llamarse exactamente `siga_demo`. Revisa el plan antes de crearla: la [base gratuita de Render caduca a los 30 días](https://render.com/docs/service-types).

## 1. PostgreSQL en Render

En Render, crea un servicio **Postgres** separado con **Database Name: `siga_demo`**. Elige la misma región que el futuro servicio web. Anota, en tu gestor local de secretos, las URL **Internal** y **External** y sus respectivos hosts; no las copies al repositorio. La API en Render usará la URL interna. Para ejecutar el seed desde tu equipo usarás temporalmente la externa con `sslmode=require` y acceso de red limitado a tu IP; después podrás restringir o desactivar ese acceso externo. Render usa PostgreSQL en el puerto 5432. [Conexiones de Render Postgres](https://render.com/docs/postgresql-creating-connecting).

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
| `DATABASE_URL` | URL **Internal** de `siga_demo`; comprueba el nombre final de la base |
| `DEMO_TARGET` | `siga_demo` |
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
| Environment Variable `VITE_API_URL` | `https://<tu-api>.onrender.com/api` |

`frontend/vercel.json` reescribe las rutas de React Router hacia `index.html`, por lo que una recarga de `/login` o `/students` no debe devolver 404. `VITE_API_URL` es pública y se incorpora al JavaScript durante el build; **no pongas contraseñas, tokens ni secretos en variables `VITE_*`**. Al conocer el dominio final de Vercel, actualiza `CORS_ORIGIN` en Render con ese origen exacto y vuelve a desplegar la API. Los dominios de preview de Vercel no quedan permitidos automáticamente. [Vite en Vercel](https://vercel.com/docs/frameworks/frontend/vite), [Root Directory](https://vercel.com/docs/builds/configure-a-build).

## 4. Seed manual con contraseñas locales

Desde `backend/`, crea un archivo local **ignorado por Git** llamado `.env.demo.cloud` con `DATABASE_URL` igual a la URL **External** de la nueva base, `DEMO_TARGET=siga_demo` y `DEMO_DATABASE_HOST` igual al host exacto de esa URL. Mantén las seis variables `DEMO_*_PASSWORD` actuales en `.env.demo`; no las copies a Vercel, Render ni al código. Si trabajas en otro worktree, coloca allí una copia local e ignorada de `.env.demo` o ejecuta el seed desde el checkout que ya lo contiene. Node 24 permite cargar ambos archivos en orden, de modo que `.env.demo.cloud` sustituya solo el destino local:

```powershell
cd backend
node --env-file=.env.demo.cloud scripts/verify-demo-target.js
node --env-file=.env.demo.cloud ./node_modules/prisma/build/index.js migrate status
node --env-file=.env.demo --env-file=.env.demo.cloud scripts/seed-demo.js
```

Ejecuta el seed **solo después** de que las migraciones estén aplicadas y el verificador confirme `siga_demo` en el puerto 5432. El seed usa las contraseñas locales existentes, valida sus reglas, crea registros DEMO de forma idempotente y se detiene ante colisiones incompatibles; no cambia contraseñas ni usuarios existentes. No ejecutes `cleanup:demo-test` en la nube: esa limpieza está limitada a `siga_test`. El manifiesto local del seed queda ignorado por Git. Si una cuenta DEMO ya existe con otra contraseña o rol, investiga la colisión; no fuerces una sobrescritura.

## Comprobación antes de compartir la URL

Comprueba `GET /api/health`, login y `GET /api/auth/me` en la API; desde Vercel, recarga una ruta interna y prueba los módulos de cada rol. Verifica que el navegador no tenga errores de CORS ni contenido mixto, que el limitador de login funciona detrás del proxy y que el seed se ejecutó solo en `siga_demo`. Usa exclusivamente datos ficticios. Esta demo académica no sustituye una revisión de seguridad, privacidad, respaldos y recuperación para datos reales; las brechas están en [seguridad-y-normativa.md](seguridad-y-normativa.md).
