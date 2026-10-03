# Despliegue de la demo SIGA

Esta guía prepara una **demo académica con datos ficticios**. No crea servicios ni publica código por sí sola. El backend publicado responde en `https://siga-lud0.onrender.com`; la base de Render informada para esta demo se llama exactamente `siga_demo_egx3`, independiente de `siga` y `siga_test` locales. Comprueba el plan y vigencia de la base: la [base gratuita de Render caduca a los 30 días](https://render.com/docs/service-types).

## 1. PostgreSQL en Render

La base ya creada tiene **Database Name: `siga_demo_egx3`** y puerto **5432**. Conserva las URL **Internal** y **External** y sus respectivos hosts en un gestor local de secretos; no las copies al repositorio. La API en Render usa la URL interna. La transición de datos ya se completó; la URL externa se utilizó para las operaciones manuales autorizadas con TLS. Restringe o desactiva ese acceso externo si ya no se necesita. [Conexiones de Render Postgres](https://render.com/docs/postgresql-creating-connecting).

## 2. API en Render

Crea un **Web Service** del mismo repositorio, con estos campos:

| Campo de Render | Valor |
| --- | --- |
| Root Directory | `backend` |
| Runtime | `Node` |
| Node version | 24.x; fija `NODE_VERSION` a una versión 24 disponible si Render selecciona otra |
| Build Command | `npm ci --include=dev && npm run prisma:generate && npm run verify:database-target && npm run prisma:migrate` |
| Start Command | `npm start` |
| Health Check Path | `/api/health` |

El build instala Prisma CLI, genera el cliente, **comprueba el destino** y aplica las migraciones existentes con `prisma migrate deploy`. Este último comando es idempotente, pero requiere acceso a la base durante el build. No se ejecuta ningún seed al construir o arrancar. El alias anterior `verify:demo-target` se conserva para configuraciones de Render que aún lo invoquen. En planes que incluyan *Pre-Deploy Command*, puedes mover `npm run verify:database-target && npm run prisma:migrate` a ese campo y dejar `npm ci --include=dev && npm run prisma:generate` como build; Render indica que el pre-deploy no está disponible para el Web Service gratuito. [Fases de despliegue de Render](https://render.com/docs/deploys).

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

## 4. Estado de los datos publicados

El seed DEMO se ejecutó manualmente durante la preparación inicial. Después se generó un respaldo externo verificable, se crearon y comprobaron por API seis cuentas nuevas, y se retiraron los registros DEMO. La base publicada tiene ahora seis usuarios activos, tres niveles, catorce grados, un periodo y dos registros de cada entidad académica restante. Consulta el orden y las barreras de seguridad en [transición de datos](data-transition.md).

**No vuelvas a ejecutar el seed DEMO ni las etapas `prepare` o `retire` sobre este estado.** El nombre técnico `siga_demo_egx3` permanece en Render, pero no aparece como etiqueta de los datos visibles. `cleanup:e2e-fixtures` sigue limitado exclusivamente a `siga_test`. Los archivos locales de conexión, respaldo y comprobantes permanecen fuera de Git.

## Comprobación antes de compartir la URL

Comprueba `GET /api/health`, login y `GET /api/auth/me` en la API; desde Vercel, recarga una ruta interna y prueba los módulos de cada rol. Verifica que el navegador no tenga errores de CORS ni contenido mixto y que el limitador de login funciona detrás del proxy. Usa exclusivamente datos ficticios. Esta demo académica no sustituye una revisión de seguridad, privacidad, respaldos y recuperación para datos reales; las brechas están en [seguridad y normativa](../security/security-and-regulations.md).
