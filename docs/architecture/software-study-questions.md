# Preguntas para defender SIGA

Cada respuesta corta cabe en una exposición oral. La explicación aporta el matiz que conviene dar si el profesor profundiza. **Evidencia** remite a rutas del repositorio o fuentes oficiales; no implica certificación. Usar la [guía principal](software-study-guide.md) para estudiar primero el recorrido completo.

## Producto y arquitectura

### 1. ¿Qué problema resuelve SIGA?
- **Corta:** Centraliza fichas, estructura, matrículas y registros académicos con acceso por rol.
- **Ampliada:** Relaciona datos que de otro modo quedarían separados y evita que un usuario vea o modifique todo por defecto.
- **Evidencia:** [rutas API](../../backend/src/routes/index.js), [guía principal](software-study-guide.md).
- **Evitar:** Decir que reemplaza los procesos oficiales del MINEDU.

### 2. ¿Quiénes usan el sistema?
- **Corta:** ADMIN, SECRETARIA, DOCENTE y ESTUDIANTE.
- **Ampliada:** Cada rol dispone de rutas distintas; docentes y estudiantes tienen además un alcance ligado a su perfil y recursos.
- **Evidencia:** [rutas](../../backend/src/routes/index.js), [alcance](../../backend/src/services/record-access.service.js).
- **Evitar:** Confundir rol con propiedad de una asignación o matrícula.

### 3. ¿En qué se diferencia SIGA de SIAGIE?
- **Corta:** SIGA es una aplicación académica de alcance limitado; no sustituye SIAGIE.
- **Ampliada:** No implementa el procedimiento oficial completo de matrícula, evaluación por competencias, FUM ni registro oficial.
- **Evidencia:** [matriz normativa](../security/security-and-regulations.md), [norma de matrícula](https://www.gob.pe/institucion/minedu/normas-legales/7603336-010-2026-minedu).
- **Evitar:** Presentar las notas de SIGA como actas oficiales.

### 4. ¿Por qué separar React y Express?
- **Corta:** La interfaz presenta datos y la API concentra reglas y permisos.
- **Ampliada:** El navegador llama a HTTP; los servicios acceden a PostgreSQL mediante Prisma. La base no se expone al navegador.
- **Evidencia:** [cliente HTTP](../../frontend/src/services/api.js), [rutas API](../../backend/src/routes/index.js).
- **Evitar:** Decir que ocultar un botón protege una operación.

### 5. ¿Qué hacen Vite, Prisma y PostgreSQL?
- **Corta:** Vite construye React; Prisma modela consultas; PostgreSQL almacena y restringe datos.
- **Ampliada:** Las validaciones de servicio y las claves de base se complementan: una no sustituye a la otra.
- **Evidencia:** [configuración frontend](../../frontend/package.json), [esquema](../../backend/prisma/schema.prisma).
- **Evitar:** Atribuir autenticación automática a Prisma.

### 6. ¿Dónde está alojada la demostración?
- **Corta:** Frontend en Vercel; API y PostgreSQL en Render.
- **Ampliada:** Localmente se usan servicios y base separados; el despliegue publicado depende de configuración y recursos del proveedor.
- **Evidencia:** [despliegue](../operations/deployment.md).
- **Evitar:** Confundir el resultado local con capacidad de producción.

### 7. ¿Por qué pueden diferir los SHA del frontend y del backend?
- **Corta:** Cada proveedor puede construir una revisión distinta si el cambio solo afecta a una parte.
- **Ampliada:** El frontend expone su SHA de build en metadatos y health expone el SHA del backend; se comparan contratos y archivos afectados.
- **Evidencia:** [versión frontend](../../frontend/src/utils/buildVersion.js), [health](../../backend/src/controllers/health.controller.js).
- **Evitar:** Declarar desincronización solo porque los SHA no coinciden.

## Modelo y flujo académico

### 8. ¿Por qué usar UUID?
- **Corta:** Son identificadores estables de registros.
- **Ampliada:** Facilitan relacionar entidades sin depender de nombres, pero un UUID conocido no autoriza acceso.
- **Evidencia:** [esquema](../../backend/prisma/schema.prisma), [alcance](../../backend/src/services/record-access.service.js).
- **Evitar:** Llamar al UUID una medida suficiente contra IDOR.

### 9. ¿Puede existir un estudiante sin cuenta?
- **Corta:** Sí; la ficha Student tiene User opcional.
- **Ampliada:** La matrícula usa la ficha y muestra su nombre aunque no exista credencial de acceso. Una cuenta vinculada debe estar activa y tener rol ESTUDIANTE.
- **Evidencia:** [schema.prisma](../../backend/prisma/schema.prisma), [servicio de matrículas](../../backend/src/services/enrollment.service.js).
- **Evitar:** Suponer que crear ficha crea contraseña automáticamente.

### 10. ¿Por qué Teacher no duplica el nombre?
- **Corta:** El perfil docente usa el User vinculado.
- **Ampliada:** userId es obligatorio y único; el nombre y correo viven en la cuenta, evitando copias divergentes.
- **Evidencia:** [schema.prisma](../../backend/prisma/schema.prisma).
- **Evitar:** Decir que cualquier User puede ser Teacher; exige rol DOCENTE y cuenta activa.

### 11. ¿Cómo se evita una matrícula con periodo equivocado?
- **Corta:** El periodo proviene de la sección y una clave foránea compuesta protege la relación.
- **Ampliada:** Enrollment guarda sectionId y academicPeriodId; el par debe existir en Section. El cliente no envía libremente el periodo.
- **Evidencia:** [schema.prisma](../../backend/prisma/schema.prisma), [integración de matrícula](../../backend/tests/integration/people-enrollment.integration.js).
- **Evitar:** Decir que depende solo de una validación JavaScript.

### 12. ¿Puede un estudiante tener dos matrículas en el mismo periodo?
- **Corta:** No; el par estudiante-periodo es único.
- **Ampliada:** La unicidad también incluye una matrícula CANCELLED. Para volver a matricular se reactiva la existente según las reglas.
- **Evidencia:** [schema.prisma](../../backend/prisma/schema.prisma).
- **Evitar:** Crear una segunda fila tras cancelar.

### 13. ¿Cómo se asegura que una nota pertenezca a la sección correcta?
- **Corta:** Hay claves compuestas hacia matrícula y asignación con el mismo sectionId.
- **Ampliada:** El servicio deriva sectionId; PostgreSQL exige que ambos vínculos correspondan a esa sección.
- **Evidencia:** [schema.prisma](../../backend/prisma/schema.prisma), [pruebas académicas](../../backend/tests/integration/course-record.integration.js).
- **Evitar:** Presentarlo como comprobación únicamente de interfaz.

### 14. ¿Por qué se rechaza un traslado con registros académicos?
- **Corta:** Cambiar sección dejaría notas y asistencias asociadas a otra asignación.
- **Ampliada:** Las claves compuestas y la regla del servicio lo bloquean con 409; no se mueven ni borran registros históricos.
- **Evidencia:** [schema.prisma](../../backend/prisma/schema.prisma), [servicio de matrículas](../../backend/src/services/enrollment.service.js).
- **Evitar:** Prometer traslado automático de notas.

### 15. ¿Qué representa una calificación?
- **Corta:** Un valor AD, A, B o C por curso/asignación, matrícula y bimestre.
- **Ampliada:** Es una simplificación del proyecto. No modela competencias ni equivale a evaluación oficial.
- **Evidencia:** [schema.prisma](../../backend/prisma/schema.prisma), [norma de evaluación](https://www.gob.pe/institucion/minedu/normas-legales/541161-094-2020-minedu).
- **Evitar:** Llamarla acta o promedio oficial.

### 16. ¿Qué ocurre al desactivar un registro?
- **Corta:** Se conserva para consulta histórica y se impiden nuevas asociaciones según la regla.
- **Ampliada:** No hay borrado físico por la API ni desactivación en cascada; cancelar una matrícula conserva su fila.
- **Evidencia:** [servicios académicos](../../backend/src/services/), [schema.prisma](../../backend/prisma/schema.prisma).
- **Evitar:** Confundir desactivación con eliminación de datos.

## Autenticación y autorización

### 17. ¿Cómo se guardan las contraseñas?
- **Corta:** Como hash bcrypt, nunca como texto plano.
- **Ampliada:** Se exige longitud mínima, se rechazan más de 72 bytes UTF-8 y la respuesta HTTP omite passwordHash.
- **Evidencia:** [servicio de autenticación](../../backend/src/services/auth.service.js), [validador de usuario](../../backend/src/validators/user.validator.js).
- **Evitar:** Decir que el hash permite recuperar la contraseña.

### 18. ¿Qué contiene y cómo se valida el JWT?
- **Corta:** Identificador, expiración y tokenVersion; se verifica firma HS256.
- **Ampliada:** Cada petición consulta la cuenta actual para verificar estado, rol y versión; no confía en un rol antiguo del token.
- **Evidencia:** [middleware](../../backend/src/middlewares/auth.middleware.js).
- **Evitar:** Considerar válido un token solo porque puede decodificarse.

### 19. ¿Qué hace tokenVersion?
- **Corta:** Invalida tokens anteriores al cambiar la contraseña.
- **Ampliada:** Hash y versión se actualizan atómicamente; el siguiente uso de un JWT viejo devuelve 401. Los tokens sin versión también se rechazan.
- **Evidencia:** [auth.service.js](../../backend/src/services/auth.service.js), [prueba de revocación](../../backend/tests/integration/session-revocation.integration.js).
- **Evitar:** Decir que el logout revoca tokens individualmente.

### 20. ¿Por qué no usar una cookie HttpOnly en lugar de sessionStorage?
- **Corta:** Es una decisión simplificada del proyecto; una cookie HttpOnly sería una alternativa a evaluar.
- **Ampliada:** sessionStorage puede ser leído por JavaScript si ocurre XSS. HttpOnly reduce esa exposición, pero requiere diseñar CSRF, SameSite, CORS y ciclo de sesión.
- **Evidencia:** [AuthContext.jsx](../../frontend/src/auth/AuthContext.jsx), [auditoría](../security/external-security-audit.md).
- **Evitar:** Afirmar que cualquiera de las dos opciones elimina todo riesgo.

### 21. ¿Cuál es la diferencia entre CSRF y XSS aquí?
- **Corta:** CSRF induce peticiones desde otro origen; XSS ejecuta código dentro del origen legítimo.
- **Ampliada:** CORS no impide por sí solo CSRF; con token en sessionStorage el riesgo destacado es que un XSS pueda leerlo. Una migración a cookies exigiría defensa CSRF.
- **Evidencia:** [AuthContext.jsx](../../frontend/src/auth/AuthContext.jsx), [CSP](../../frontend/vercel.json).
- **Evitar:** Decir que CSP garantiza ausencia de XSS.

### 22. ¿Por qué CORS no reemplaza autorización?
- **Corta:** CORS gobierna lectura desde navegadores, no quién tiene permiso.
- **Ampliada:** Clientes fuera del navegador pueden enviar peticiones; el backend debe validar JWT, rol y propiedad del recurso.
- **Evidencia:** [app.js](../../backend/src/app.js), [auth.middleware.js](../../backend/src/middlewares/auth.middleware.js).
- **Evitar:** Explicar un 403 de rol solo con CORS.

### 23. ¿Qué aporta la CSP?
- **Corta:** Restringe orígenes de scripts, estilos, imágenes y conexiones del documento.
- **Ampliada:** Se validó primero en Report-Only y después se activó; el recorrido observado no registró infracciones. Nuevos recursos pueden requerir revisión.
- **Evidencia:** [vercel.json](../../frontend/vercel.json), [auditoría externa](../security/external-security-audit.md).
- **Evitar:** Tratar el A+ de Observatory como certificación de seguridad integral.

### 24. ¿Prisma elimina la inyección SQL?
- **Corta:** Sus consultas tipadas reducen el riesgo, pero no autorizan descuidar SQL manual.
- **Ampliada:** Se revisaron llamadas raw y payloads locales; añadir SQL concatenado o una llamada unsafe reintroduciría riesgo.
- **Evidencia:** [auditoría de preparación](../security/production-readiness-audit.md), [prueba de contrato](../../backend/tests/integration/production-contract.integration.js).
- **Evitar:** Afirmar inmunidad absoluta.

### 25. ¿Qué es IDOR o BOLA en SIGA?
- **Corta:** Intentar acceder a una matrícula, asignación o registro ajeno cambiando su UUID.
- **Ampliada:** Listados, detalles y ediciones consultan el alcance del perfil; filtros y paginación no deben revelar totales globales.
- **Evidencia:** [record-access.service.js](../../backend/src/services/record-access.service.js), [integración](../../backend/tests/integration/course-record.integration.js).
- **Evitar:** Confiar en que los UUID sean difíciles de adivinar.

### 26. ¿Qué protege el rate limit?
- **Corta:** Reduce la frecuencia de intentos de login y cambio de contraseña.
- **Ampliada:** Está configurado a cinco intentos por 15 minutos y usa memoria del proceso; no es defensa completa contra ataques distribuidos.
- **Evidencia:** [auth.routes.js](../../backend/src/routes/auth.routes.js), [auditoría de proxy](../security/external-security-audit.md).
- **Evitar:** Decir que resiste cualquier fuerza bruta.

### 27. ¿Qué significa trust proxy con 0 o 1 salto?
- **Corta:** Determina cuántos proxies inmediatos considera Express al calcular la IP.
- **Ampliada:** Local usa 0; Render tiene 1 confirmado manualmente. Confiar en demasiados saltos puede dejar que el cliente influya en la IP del limitador.
- **Evidencia:** [env.js](../../backend/src/config/env.js), [19 pruebas](../../backend/tests/unit/trust-proxy.test.js).
- **Evitar:** Afirmar que se demostró toda la topología pública.

### 28. ¿Por qué Cache-Control: no-store en autenticación?
- **Corta:** Indica que respuestas de login y datos de cuenta no deben almacenarse en cachés.
- **Ampliada:** Se aplica al router de autenticación, incluidos errores; health público no hereda esa regla. No destruye copias que alguien haya guardado.
- **Evidencia:** [auth.routes.js](../../backend/src/routes/auth.routes.js), [auditoría externa](../security/external-security-audit.md).
- **Evitar:** Confundir no-store con revocación del token.

### 29. ¿Qué comprueba Gitleaks?
- **Corta:** Busca patrones de secretos en archivos e historial Git.
- **Ampliada:** La configuración conserva reglas predeterminadas y exceptúa huellas concretas de fixtures revisados. Cero hallazgos restantes no prueba ausencia total de secretos.
- **Evidencia:** [gitleaks.toml](../../gitleaks.toml), [auditoría externa](../security/external-security-audit.md).
- **Evitar:** Decir que el escaneo reemplaza gestión de credenciales.

### 30. ¿Qué significan TLS y la regla PostgreSQL /32?
- **Corta:** TLS cifra el transporte observado; /32 limita el acceso externo a una IP autorizada.
- **Ampliada:** La conexión interna del backend se mantuvo. Si cambia la IP pública, debe actualizarse la regla. No se probó técnicamente el rechazo desde otra red.
- **Evidencia:** [auditoría externa](../security/external-security-audit.md).
- **Evitar:** Decir que una regla de red sustituye credenciales de PostgreSQL.

## Evidencia, normativa y límites

### 31. ¿Qué prueban las integraciones con PostgreSQL?
- **Corta:** Que los flujos y restricciones ejecutados funcionan en siga_test real.
- **Ampliada:** Cubren relaciones, duplicados, roles y conflictos; usan datos temporales. No prueban todo posible estado ni el servicio publicado.
- **Evidencia:** [integraciones](../../backend/tests/integration/), [guía principal](software-study-guide.md).
- **Evitar:** Llamar integración a una prueba que solo usa mocks.

### 32. ¿Qué prueban las E2E?
- **Corta:** Recorren acciones de los roles desde el navegador con API y base de pruebas.
- **Ampliada:** Comprueban interacción y permisos visibles, además de peticiones directas en los flujos ensayados. La cobertura depende del navegador y casos ejecutados.
- **Evidencia:** [E2E](../../frontend/tests/e2e/mvp.e2e.mjs), [guía de verificación](../operations/verification-guide.md).
- **Evitar:** Afirmar que probar la UI garantiza autorización de API.

### 33. ¿Qué significan 183,41 RPS y p95 de 18,70 ms?
- **Corta:** Son resultados de una repetición local de 30 VU, no capacidad de producción.
- **Ampliada:** Hubo 14 796 solicitudes y 0 % fallos en 80 segundos completos; hardware, red y datos publicados son distintos. p95 indica que el 95 % de las duraciones medidas quedó bajo ese valor.
- **Evidencia:** [informe k6](../security/performance-results.md).
- **Evitar:** Prometer esa latencia en Render o con escrituras concurrentes.

### 34. ¿Cómo sabemos que el respaldo se puede recuperar?
- **Corta:** Se restauró realmente en una base local aislada y se probó una API conectada a ella.
- **Ampliada:** Se verificaron esquema, migraciones, conteos, relaciones y login; después se eliminó solo la base temporal. pg_restore --list por sí solo solo prueba legibilidad del catálogo.
- **Evidencia:** [runbook](../operations/backup-restore-runbook.md).
- **Evitar:** Confundir un dump creado con recuperación garantizada.

### 35. ¿Qué exige la Ley 29733 y qué cumple SIGA?
- **Corta:** La ley protege el tratamiento de datos personales; SIGA incorpora controles técnicos, pero no acredita cumplimiento total.
- **Ampliada:** Falta definir responsable real, finalidad, información al titular, conservación, atención de derechos y procesos organizativos antes de usar datos reales.
- **Evidencia:** [Ley 29733](https://www.gob.pe/institucion/congreso-de-la-republica/normas-legales/243470-29733), [matriz normativa](../security/security-and-regulations.md).
- **Evitar:** Afirmar que usar bcrypt equivale a cumplir la ley.

### 36. ¿Qué relación tiene el reglamento de 2024 con la auditoría?
- **Corta:** Añade criterios de protección y gestión de incidentes; SIGA no tiene un proceso operativo completo.
- **Ampliada:** Los errores seguros son solo una parte. Faltan bitácora persistente, responsables, evaluación de incidentes y decisiones documentadas.
- **Evidencia:** [D. S. 016-2024-JUS](https://www.gob.pe/institucion/smv/normas-legales/6426760-016-2024-jus), [matriz normativa](../security/security-and-regulations.md).
- **Evitar:** Confundir logs técnicos con auditoría formal.

### 37. ¿La matrícula de SIGA cumple la norma MINEDU de 2026?
- **Corta:** No se ha demostrado; solo implementa una relación básica estudiante-sección-periodo.
- **Ampliada:** La norma oficial regula más etapas y registro SIAGIE. El sistema no ofrece FUM, vacantes ni trámite oficial completo.
- **Evidencia:** [R. M. 010-2026-MINEDU](https://www.gob.pe/institucion/minedu/normas-legales/7603336-010-2026-minedu), [matriz](../security/security-and-regulations.md).
- **Evitar:** Presentar la matrícula interna como registro oficial.

### 38. ¿Qué seguridad falta probar?
- **Corta:** ZAP Baseline sigue pendiente por falta de herramienta operativa; además quedan mejoras de operación.
- **Ampliada:** Faltan MFA, auditoría persistente, respaldos automatizados y monitoreo. Las pruebas finitas no prueban ausencia de vulnerabilidades.
- **Evidencia:** [auditoría externa](../security/external-security-audit.md), [guía principal](software-study-guide.md).
- **Evitar:** Decir que SIGA es completamente seguro.

### 39. ¿Qué se sabe del 503 y del timeout observados?
- **Corta:** Fueron observaciones separadas sin causa confirmada.
- **Ampliada:** El 503 está documentado; del timeout no se conservó una traza diagnóstica en este repositorio. No se reprodujeron de forma controlada; hay que revisar logs y métricas antes de culpar a Render, PostgreSQL o al código.
- **Evidencia:** [503 en auditoría externa](../security/external-security-audit.md), [límite de evidencia](software-study-guide.md).
- **Evitar:** Inventar una causa o prometer disponibilidad continua.

### 40. ¿Qué haríamos antes de operar con datos reales?
- **Corta:** Validar requisitos legales y pedagógicos, fortalecer autenticación, auditoría, respaldos y monitoreo, y probar recuperación y seguridad.
- **Ampliada:** También definir responsables, retención, respuesta a incidentes, capacidad, continuidad y relación con SIAGIE; luego verificar en una infraestructura adecuada.
- **Evidencia:** [matriz normativa](../security/security-and-regulations.md), [runbook](../operations/backup-restore-runbook.md).
- **Evitar:** Presentar la beta académica como producto certificado o listo para producción.
