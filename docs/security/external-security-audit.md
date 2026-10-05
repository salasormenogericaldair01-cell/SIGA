# Auditoría externa de seguridad de SIGA

Fecha: 5 de octubre de 2026 (America/Lima). Base: `origin/develop` en `110e222`. Alcance: lectura de cabeceras y TLS públicos, una comprobación autenticada de bajo impacto, código y Git local. No se cambió Vercel, Render ni PostgreSQL; no se hizo escaneo activo ni prueba de carga. Los estados públicos pueden cambiar después de esta fecha. **Una beta académica no queda certificada ni apta para datos reales por esta revisión.**

## Primera etapa preparada en esta rama (sin publicar)

**Mejora recomendada implementada en código:** `frontend/vercel.json` añade `Content-Security-Policy-Report-Only`, `nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` que deshabilita capacidades no usadas y `X-Frame-Options: DENY`. No añade HSTS: Vercel ya lo sirvió en la observación pública. **La CSP sigue siendo Report-Only**, por lo que sus infracciones se observarán sin bloquear recursos; `frame-ancestors` en Report-Only no sustituye al `X-Frame-Options` obligatorio. Estas cabeceras no están verificadas en el servicio publicado porque no hubo despliegue.

La política se contrastó con `index.html`, el build Vite y el código cliente: el HTML generado no tiene scripts o estilos inline ni atributos `style`; React tampoco define atributos `style` en `src`. JavaScript, CSS, Inter e imágenes se empaquetan localmente. La única conexión externa funcional en producción es la API `https://siga-lud0.onrender.com` configurada mediante `VITE_API_URL`; el valor por defecto local `http://localhost:3000/api` requiere una política distinta durante desarrollo. Por ello se usa `style-src 'self'; style-src-attr 'none'; img-src 'self' data:; font-src 'self'`, sin dominios de Google y sin `unsafe-inline` en scripts. Antes de hacer la CSP obligatoria, revisar en un despliegue los informes de infracciones y los flujos reales de cada rol.

**Conforme en pruebas locales:** el router `/api/auth` aplica `Cache-Control: no-store` a login, `/me`, actualización de perfil y cambio de contraseña, incluidos errores de esas rutas. Health y las rutas públicas fuera de ese router no heredan la cabecera. No se añadió `Pragma: no-cache`: es una directiva heredada de HTTP/1.0 y `no-store` expresa directamente la política de almacenamiento requerida por los clientes actuales. La comprobación pública anterior a este cambio sigue mostrando la brecha hasta el próximo despliegue.

**Conforme en el análisis reproducible:** `gitleaks.toml` conserva las reglas predeterminadas y `.gitleaksignore` contiene 45 huellas exactas de fixtures examinados. Se justifican 26 coincidencias del árbol actual y 26 del historial; varias comparten huella porque aparecen en la misma línea. Con esta lista quedan **cero alertas restantes** en ambos análisis. No se excluyen carpetas `tests/**`, scripts operativos, documentación, `.env` ni código de aplicación. Las huellas dependen de ruta y línea, por lo que al mover pruebas debe revisarse cualquier hallazgo nuevo; cero alertas no garantiza ausencia absoluta de secretos.

Verificación local: 38 pruebas relacionadas del backend, 34 pruebas del frontend, build de producción, `prisma validate` y `git diff --check` aprobados. `npm audit` informó cero vulnerabilidades en ambos proyectos al momento de la consulta. El bundle generado no contiene literales `DATABASE_URL`, `JWT_SECRET`, URL PostgreSQL ni marcador de clave privada. **Riesgo pendiente:** ZAP Baseline continúa sin ejecutarse porque el daemon de Docker no está disponible; la regla externa de PostgreSQL no se cambió. El 503 transitorio de Render sigue sin causa confirmada.

## Servicios públicos

Las respuestas se observaron con Edge headless, con validación TLS normal, en `https://siga-rose.vercel.app/login` (200) y `https://siga-lud0.onrender.com/api/health` (200 al repetir una consulta inicial que devolvió 503). Ambas negociaron TLS 1.3. El 503 inicial es un **riesgo pendiente** de disponibilidad por investigar con registros del proveedor; esta observación no determina su causa. La segunda respuesta de health devolvió `status: ok`.

| Control | Vercel `/login` | Render `/api/health` | Clasificación y acción |
| --- | --- | --- | --- |
| HTTPS y HSTS | TLS 1.3; `max-age=63072000; includeSubDomains; preload` | TLS 1.3; `max-age=31536000; includeSubDomains` | **Conforme** en las respuestas observadas; no equivale a una auditoría completa de configuración TLS. |
| Content-Security-Policy | Ausente | Presente por Helmet: `default-src 'self'`, `object-src 'none'`, `frame-ancestors 'self'`, entre otras directivas | **Riesgo pendiente** en el frontend. La política del API no protege el documento HTML de Vercel. Probar la propuesta inferior primero en Report-Only. |
| X-Content-Type-Options | Ausente | `nosniff` | **Mejora recomendada** en Vercel: `nosniff`. |
| Referrer-Policy | Ausente | `no-referrer` | **Mejora recomendada** en Vercel: declarar una política explícita, por ejemplo `no-referrer`. |
| Permissions-Policy | Ausente | Ausente | **Mejora recomendada**: deshabilitar las capacidades no utilizadas, por ejemplo cámara, micrófono y geolocalización. |
| Framing | Sin `X-Frame-Options` ni `frame-ancestors` | `X-Frame-Options: SAMEORIGIN` y CSP `frame-ancestors 'self'` | **Riesgo pendiente** de clickjacking en el frontend; proponer `frame-ancestors 'none'` y, para navegadores antiguos, `X-Frame-Options: DENY`. La API no es una interfaz para embeber. |
| Caché | HTML público: `public, max-age=0, must-revalidate` | Health público sin `Cache-Control` explícito | **No aplicable** como protección de datos privados para estas dos rutas públicas. Una petición real de login 200 y `/api/auth/me` 200 no devolvió `Cache-Control`, `Pragma` ni `Expires`: **riesgo pendiente**; añadir `Cache-Control: no-store` a respuestas con token o datos autenticados y verificarlo en el navegador. |
| Divulgación técnica | `Server: Vercel`; identificador de plataforma; sin `X-Powered-By` | `Server: cloudflare`, identificadores de plataforma; sin `X-Powered-By` | **Conforme** respecto a versión de Express, rutas internas, SQL, trazas y secretos: no aparecieron. Los identificadores del proveedor revelan infraestructura; evaluar si es posible reducirlos, sin asumir que lo sea. Health publica deliberadamente el SHA corto. |

La comprobación autenticada utilizó una cuenta controlada y mantuvo contraseña y token en memoria: login y `/api/auth/me` devolvieron 200, rol ADMIN y ninguna respuesta incluyó `passwordHash`; la respuesta de `/api/auth/me` no incluyó token. No se registraron credenciales en este informe.

### CSP propuesta para Vercel, configurada solo en Report-Only

```text
Content-Security-Policy-Report-Only: default-src 'self'; script-src 'self'; style-src 'self'; style-src-attr 'none'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://siga-lud0.onrender.com; form-action 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; upgrade-insecure-requests
```

El build React/Vite carga JavaScript, CSS, Inter y las imágenes desde el mismo origen; la API se consulta por HTTPS en Render. No se detectaron estilos ni scripts inline en `frontend/src` ni en el HTML compilado. Validar la política con login, navegación, imágenes, fuentes y formularios en escritorio y móvil; revisar infracciones en la consola del navegador antes de pasar a CSP obligatoria. No se configuró un colector de reportes. El servidor de desarrollo de Vite usa mecanismos distintos y queda fuera de esta política de producción. La CSP de Render puede revisarse por separado para sus respuestas JSON; no debe asumirse que sustituye a la de Vercel.

## Repositorio y autenticación

Gitleaks 8.30.1 se obtuvo del release oficial en una carpeta temporal y se verificó el SHA-256 publicado por GitHub. Se ejecutaron `gitleaks dir .` sobre los archivos actuales y `gitleaks git . --log-opts=--all` sobre todo el historial, con redacción completa e informes fuera de Git. Cada ejecución produjo 26 alertas `generic-api-key`, todas en archivos de pruebas. La tabla agrupa repeticiones del mismo archivo y commit; la clasificación es **probable falso positivo** por tratarse de literales de fixtures, no una garantía de que un valor nunca se reutilizó. No se encontró una alerta en código productivo ni documentación. No se cambió el historial ni se rotó ninguna credencial.

| Ruta | Commit | Tipo | Evaluación |
| --- | --- | --- | --- |
| `backend/tests/integration/db.integration.js` | Árbol actual | `generic-api-key` | Probable falso positivo de pruebas |
| `backend/tests/integration/session-revocation.integration.js` | Árbol actual | `generic-api-key` | Probable falso positivo de pruebas |
| `backend/tests/unit/sprint1.test.js` | Árbol actual | `generic-api-key` | Probable falso positivo de pruebas |
| `frontend/tests/unit/app.test.jsx` | Árbol actual | `generic-api-key` | Probable falso positivo de pruebas |
| `backend/tests/sprint1.test.js` | `07f1c51d` | `generic-api-key` | Probable falso positivo de pruebas |
| `backend/tests/sprint1.test.js` | `c1470a8e` | `generic-api-key` | Probable falso positivo de pruebas |
| `backend/tests/sprint1.test.js` | `a40a7185` | `generic-api-key` | Probable falso positivo de pruebas |
| `backend/tests/integration/db.integration.js` | `c1470a8e` | `generic-api-key` | Probable falso positivo de pruebas |
| `backend/tests/integration/session-revocation.integration.js` | `a40a7185` | `generic-api-key` | Probable falso positivo de pruebas |
| `frontend/src/test/app.test.jsx` | `a40a7185` | `generic-api-key` | Probable falso positivo de pruebas |

**Conforme en el código inspeccionado:** `VITE_API_URL` es la única variable `VITE_*` necesaria para la conexión funcional. `VITE_VERCEL_GIT_COMMIT_SHA` y `VITE_BUILD_SHA` son metadatos públicos opcionales de versión; no son secretos. El bundle público contiene la URL de la API, pero no contiene las cadenas `DATABASE_URL`, `JWT_SECRET` ni una URL PostgreSQL. Los archivos `.env` reales se ignoran; los ejemplos versionados solo contienen marcadores. La documentación asigna `DATABASE_URL` y `JWT_SECRET` al backend de Render y a archivos locales ignorados. **Riesgo pendiente:** sin acceso de solo lectura al panel de Render no se corroboró allí la configuración real de variables.

**Conforme en respuestas y pruebas locales:** el servicio de login usa el mismo 401 y mensaje para correo inexistente, contraseña incorrecta y cuenta inactiva; el middleware global devuelve un 500 genérico sin stack. Las 31 pruebas unitarias relacionadas pasaron. **Mejora recomendada:** el usuario inexistente evita `bcrypt.compare`, por lo que podría existir una diferencia temporal medible; no se realizó un análisis estadístico de enumeración.

## ZAP Baseline y acceso a PostgreSQL

**Riesgo pendiente / prueba bloqueada:** Docker CLI está presente, pero el daemon no respondía; ZAP no estaba instalado. No se ejecutó ZAP Baseline ni se instaló una herramienta. El verificador local de solo lectura confirmó que el destino preparado era exclusivamente `siga_test` en el puerto 5433. Si se habilita Docker/ZAP, ejecutar primero el [Baseline oficial](https://www.zaproxy.org/docs/docker/baseline-scan/) solo contra una API local conectada a esa base, sin escaneo activo y sin apuntar a Render.

**Riesgo pendiente de acceso externo:** la documentación usa la URL interna de Render para el backend y la externa con TLS para mantenimiento y respaldos. La regla `0.0.0.0/0` comunicada para el acceso externo permitiría intentar conexiones desde cualquier IP con credenciales válidas; el repositorio no permite comprobar el valor actual del panel. No se cambió esa regla. Mantener el acceso interno para el backend; decidir un procedimiento de respaldos y mantenimiento local antes de restringir el acceso externo por IP cuando sea viable; exigir TLS en toda conexión externa (la guía actual usa `sslmode=require`). [Render documenta las reglas externas](https://render.com/docs/inbound-ip-rules) y el uso de [URL interna/externa](https://render.com/docs/postgresql-creating-connecting).

**Riesgo pendiente de disponibilidad:** [Render indica](https://render.com/docs/free) que una base gratuita expira a los 30 días y no tiene respaldos administrados. Ya se documentó un respaldo manual previo, pero su existencia no demuestra restauración. Crear y verificar un respaldo vigente antes del vencimiento, y probar la recuperación en una base aislada; no se ejecutó `pg_dump` ni se modificó ninguna base en esta auditoría.
