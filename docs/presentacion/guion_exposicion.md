# Guion oral definitivo de SIGA

Exposición principal: **12 diapositivas, seis integrantes y dos diapositivas consecutivas por persona**. Practicar a unas **128 palabras por minuto**, dentro del rango de 125–135. Se dicen los textos **Oral** y **Transición**; las indicaciones de pantalla no se leen. Las pausas para cambiar de integrante disponen de unos cuatro segundos cada una.

| Integrante | Diapositivas | Tema | Tiempo objetivo, con transiciones | Palabras habladas |
| --- | --- | --- | ---: | ---: |
| Integrante 1 | 1–2 | Contexto | 1:52 | 239 |
| Integrante 2 | 3–4 | Arquitectura | 1:50 | 235 |
| Integrante 3 | 5–6 | Roles y administración | 1:47 | 229 |
| Integrante 4 | 7–8 | Flujo académico | 1:48 | 231 |
| Integrante 5 | 9–10 | Seguridad | 1:55 | 245 |
| Integrante 6 | 11–12 | Evidencia y cierre | 1:53 | 240 |
| **Total objetivo** | **12** | | **11:05 hablado + 0:20 de relevos = 11:25** | **1 419** |

El párrafo **Oral** de cada diapositiva ocupa aproximadamente **45–55 segundos** a ese ritmo; la frase de transición se dice al avanzar o entregar el turno. Ajustar la tabla después de un ensayo real; la demostración opcional no forma parte del tiempo principal.

## Integrante 1 — Contexto

### Diapositiva 1 — ¿Qué resuelve SIGA?

- **Responsable y tiempo:** Integrante 1, 50 s.
- **Propósito:** partir de un problema reconocible y presentar el producto.
- **En pantalla:** «Datos académicos conectados» · «Cuatro tipos de usuario» · «Una vista según responsabilidades».
- **Visual:** captura actual del panel sin credenciales, junto a un flujo corto de información.
- **Oral:** «Imaginen que las fichas de estudiantes, las secciones y las notas se llevan en archivos separados. Encontrar el dato correcto y saber quién puede modificarlo se vuelve difícil. Para ese escenario desarrollamos SIGA, Sistema de Gestión Académica. Reúne la información académica y la presenta según la responsabilidad de cada persona: administración, secretaría, docentes y estudiantes. Un docente necesita trabajar con su aula; un estudiante necesita consultar sus propios resultados. La propuesta no consiste solo en colocar formularios en una web. Consiste en mantener relacionadas las fichas, las matrículas y los registros, para que el recorrido de un estudiante se pueda seguir sin mezclarlo con el de otros.»
- **Memorizar:** problema; centralización; cuatro usuarios.
- **Transición:** «Ahora delimitemos qué parte de la gestión escolar cubre esta versión.»
- **No afirmar:** que SIGA resuelve todos los procesos de una institución.

### Diapositiva 2 — Alcance y forma de trabajo

- **Responsable y tiempo:** Integrante 1, 46 s.
- **Propósito:** definir Educación Básica, sprints y límites.
- **En pantalla:** «Inicial, Primaria y Secundaria» · «Sprints de Scrum» · «SIGA no sustituye SIAGIE».
- **Visual:** línea de sprints y tres niveles agrupados, sin métricas inventadas.
- **Oral:** «El proyecto contempla Inicial, Primaria y Secundaria. Partimos de la base del backend, seguimos con usuarios, estructura académica, matrículas, cursos, calificaciones y asistencia, y después construimos el frontend y verificamos los flujos. Esa secuencia de sprints, siguiendo Scrum, nos ayudó a integrar y probar partes pequeñas. Hoy podemos registrar cuentas y perfiles, organizar periodos y secciones, matricular estudiantes y consultar o escribir registros académicos según el rol. Pero el alcance es deliberadamente limitado: no tenemos apoderados, pagos, vacantes ni evaluación por competencias. Tampoco reemplazamos el Sistema de Información de Apoyo a la Gestión de la Institución Educativa, SIAGIE, ni presentamos nuestras notas como registros oficiales del Ministerio de Educación.»
- **Memorizar:** tres niveles; sprints; límite oficial.
- **Transición al Integrante 2:** «Con ese alcance claro, veamos cómo viaja una solicitud por el sistema.»
- **No afirmar:** que Scrum certifica el producto o que SIGA reemplaza SIAGIE.

## Integrante 2 — Arquitectura

### Diapositiva 3 — Del navegador a PostgreSQL

- **Responsable y tiempo:** Integrante 2, 53 s.
- **Propósito:** explicar las capas mediante una solicitud real.
- **En pantalla:** «React y Vite» · «API Express y Prisma» · «PostgreSQL».
- **Visual:** navegador → frontend → API → Prisma → base, con Vercel y Render.
- **Oral:** «El usuario interactúa con React, construido con Vite y publicado en Vercel. Al guardar o consultar algo, el navegador envía una petición a la interfaz de programación de aplicaciones, o API, hecha con Express y publicada en Render. La API valida la entrada, comprueba la sesión y el permiso, y pasa la operación al servicio correspondiente. Prisma traduce la consulta hacia PostgreSQL; la base responde y la API devuelve únicamente los campos necesarios. La conexión a PostgreSQL y sus credenciales permanecen del lado del servidor. En desarrollo usamos servicios locales y una base separada para integración. Un identificador corto de versión en frontend y health nos ayuda a reconocer qué build está respondiendo.»
- **Memorizar:** capas; servidor; versión.
- **Transición:** «La siguiente diapositiva muestra cómo esas capas conservan relaciones coherentes.»
- **No afirmar:** que el navegador se conecta directamente a la base.

### Diapositiva 4 — Relaciones que protegen los datos

- **Responsable y tiempo:** Integrante 2, 48 s.
- **Propósito:** explicar integridad y restricciones compuestas.
- **En pantalla:** «12 entidades con UUID» · «Relaciones y unicidad» · «Claves compuestas».
- **Visual:** estudiante → matrícula → sección ← asignación → docente; nota y asistencia debajo.
- **Oral:** «El modelo relaciona cuentas con fichas de estudiantes o docentes; niveles con grados; y grados y periodos con secciones. Una matrícula enlaza estudiante, sección y periodo. Una asignación une curso, sección y docente. Notas y asistencias unen una matrícula con esa asignación. Las doce entidades usan identificadores universales únicos, llamados UUID, pero conocer un identificador no concede acceso. PostgreSQL exige claves únicas y foráneas. Además, las relaciones compuestas obligan a que la matrícula pertenezca al periodo de su sección y a que una nota o asistencia comparta sección con la asignación. Así, una comprobación de la base acompaña la regla del servicio.»
- **Memorizar:** UUID; unicidad; misma sección.
- **Transición al Integrante 3:** «Ya vimos los datos; ahora, quién puede operar sobre ellos.»
- **No afirmar:** que un UUID sustituye la autorización.

## Integrante 3 — Roles y administración

### Diapositiva 5 — Cuatro roles, alcances distintos

- **Responsable y tiempo:** Integrante 3, 50 s.
- **Propósito:** diferenciar rol y propiedad del recurso.
- **En pantalla:** «ADMIN administra» · «SECRETARIA gestiona» · «DOCENTE y ESTUDIANTE: alcance propio».
- **Visual:** matriz compacta de cuatro roles y acciones representativas.
- **Oral:** «SIGA tiene cuatro roles. ADMIN crea usuarios y puede corregir registros académicos. SECRETARIA gestiona estructura, estudiantes, matrículas, cursos y asignaciones, y consulta notas y asistencia, pero no las escribe. DOCENTE ve sus asignaciones actuales y registra notas y asistencia solo allí. ESTUDIANTE consulta sus propios registros, si su ficha está vinculada a una cuenta. Hay dos preguntas distintas: qué acción permite el rol y a qué registro concreto puede acceder. El backend responde ambas. Por ejemplo, cambiar un identificador en la dirección no debe permitir a un docente leer el curso de otro. Ocultar botones en React orienta al usuario, pero no es la barrera de seguridad.»
- **Memorizar:** rol; propiedad; backend.
- **Transición:** «Veamos cómo se crean las personas y la estructura que esos roles utilizan.»
- **No afirmar:** que el frontend por sí solo impone permisos.

### Diapositiva 6 — Cuentas, perfiles y estructura

- **Responsable y tiempo:** Integrante 3, 47 s.
- **Propósito:** separar credencial y ficha académica.
- **En pantalla:** «User ≠ perfil» · «Nivel → grado» · «Periodo + grado → sección».
- **Visual:** árbol académico y una ficha Student sin cuenta.
- **Oral:** «La cuenta User contiene correo, rol y credencial protegida. Student es la ficha académica: tiene nombre, código y fecha de nacimiento, y puede existir sin acceso al sistema. Si se vincula una cuenta, debe tener rol ESTUDIANTE. Teacher, en cambio, requiere una cuenta DOCENTE activa y toma de ella nombre y correo, sin duplicarlos. Para ordenar la institución creamos niveles, grados, periodos con fechas y secciones. Una sección pertenece a un grado y a un periodo, de modo que primero A de dos años distintos son registros diferentes. Los estados activos permiten nuevas asociaciones; desactivar no borra las referencias históricas.»
- **Memorizar:** cuenta; ficha; periodo.
- **Transición al Integrante 4:** «Con personas y secciones preparadas, recorramos una matrícula realista.»
- **No afirmar:** que registrar un Student crea automáticamente un usuario.

## Integrante 4 — Flujo académico

### Diapositiva 7 — Del curso a la matrícula

- **Responsable y tiempo:** Integrante 4, 51 s.
- **Propósito:** unir curso, docente, sección y estudiante.
- **En pantalla:** «Curso + sección + docente» · «Matrícula por periodo» · «Historial conservado».
- **Visual:** flujo de asignación y matrícula con nombre del estudiante destacado.
- **Oral:** «Primero se crea un curso y se asigna a un docente en una sección. El periodo se obtiene de esa sección. Después se matricula al estudiante: en la interfaz aparece su nombre completo como dato principal y su código como referencia secundaria, incluso cuando no tiene cuenta. Un estudiante solo tiene una matrícula por periodo; cancelar conserva la fila para el historial y reactivar no crea un duplicado. También se puede trasladar a otra sección del mismo periodo si las reglas lo permiten. Si ya existen notas o asistencias, el traslado se rechaza para no dejar esos registros apuntando a otra sección. No movemos ni borramos historial automáticamente.»
- **Memorizar:** asignación; nombre; traslado.
- **Transición:** «Sobre esa matrícula se construyen las acciones de Mi aula.»
- **No afirmar:** que cualquier traslado es automático.

### Diapositiva 8 — Mi aula y consulta del estudiante

- **Responsable y tiempo:** Integrante 4, 48 s.
- **Propósito:** cerrar el recorrido con escritura y consulta autorizadas.
- **En pantalla:** «Mi aula» · «Nota y asistencia» · «Consulta propia».
- **Visual:** dos capturas actuales sin datos sensibles: Mi aula y vista de estudiante.
- **Oral:** «En Mi aula, el docente abre una asignación propia y consulta las matrículas de esa sección. Selecciona un estudiante y registra una calificación, por ejemplo A en un bimestre, o una asistencia con fecha dentro del periodo. Puede corregir el valor o el estado después. La API comprueba que la asignación, la matrícula y los perfiles permiten escribir; un docente anterior pierde acceso si cambia el responsable del curso. Finalmente, el estudiante con cuenta vinculada entra a Mis calificaciones y Mi asistencia y ve solo lo suyo. Esta calificación única por curso y bimestre es una simplificación, no una evaluación oficial por competencias.»
- **Memorizar:** Mi aula; misma sección; consulta propia.
- **Transición al Integrante 5:** «Ese flujo funciona porque cada paso incorpora controles de seguridad.»
- **No afirmar:** que las notas implementan evaluación oficial de competencias.

## Integrante 5 — Seguridad informática

### Diapositiva 9 — Identidad, sesión y permisos

- **Responsable y tiempo:** Integrante 5, 54 s.
- **Propósito:** explicar autenticación y revocación.
- **En pantalla:** «bcrypt» · «JWT + tokenVersion» · «Rol, recurso y validación».
- **Visual:** login → token → comprobación en base → permiso.
- **Oral:** «La contraseña no se guarda en texto: bcrypt produce un hash, y rechazamos claves demasiado cortas o que superen los 72 bytes que admite. Al iniciar sesión se emite un token web JSON, llamado JWT, firmado y con expiración. En cada petición protegida se verifica el token y se consulta en PostgreSQL el rol, estado y tokenVersion actuales. Si cambia la contraseña, el hash y esa versión se actualizan juntos; los tokens anteriores quedan inválidos y se pide iniciar sesión otra vez. La autorización distingue rol y recurso. Zod rechaza cuerpos y filtros inválidos, y un límite de intentos reduce abusos del login. Cerrar sesión solo borra el token local; no revoca esa sesión individualmente.»
- **Memorizar:** hash; expiración; versión; alcance.
- **Transición:** «Además de la sesión, aplicamos controles al navegador, la API y la red.»
- **No afirmar:** que logout revoca el JWT en el servidor.

### Diapositiva 10 — Defensa por capas, sin absolutos

- **Responsable y tiempo:** Integrante 5, 48 s.
- **Propósito:** exponer controles externos y límites.
- **En pantalla:** «CSP y cabeceras» · «Acceso por recurso» · «TLS y base restringida».
- **Visual:** capas concéntricas con nota «Observatory A+: cabeceras».
- **Oral:** «La política de seguridad de contenido, o CSP, restringe recursos del navegador; Helmet añade cabeceras en la API. CORS, el control de recursos entre orígenes, define el origen web permitido, pero no sustituye permisos. Para evitar acceso directo a objetos ajenos, o IDOR, el backend comprueba la asignación o matrícula antes de listar, detallar o editar. Prisma usa consultas estructuradas; aun así, el SQL manual siempre debe revisarse. Gitleaks buscó secretos en Git. Observamos transporte cifrado con TLS y acceso a PostgreSQL limitado a una dirección autorizada. Mozilla Observatory dio A+ a las cabeceras del frontend; esa nota no evalúa toda la aplicación ni demuestra seguridad absoluta.»
- **Memorizar:** CSP; IDOR; capas; límite.
- **Transición al Integrante 6:** «La última parte muestra qué verificamos y qué sigue pendiente.»
- **No afirmar:** que A+ equivale a certificación o que CORS bloquea todo cliente.

## Integrante 6 — Evidencia y cierre

### Diapositiva 11 — Pruebas, carga y recuperación

- **Responsable y tiempo:** Integrante 6, 50 s.
- **Propósito:** comunicar resultados medidos sin extrapolarlos.
- **En pantalla:** «Backend 75 · PostgreSQL 15 · Frontend 32» · «30 VU: 183,41 RPS» · «Restauración real».
- **Visual:** tres métricas y secuencia dump → restaurar → comparar → login.
- **Oral:** «En el cierre de preparación se registraron 75 pruebas backend, 15 integraciones con PostgreSQL y 32 pruebas frontend. También hay pruebas de contrato, seguridad y navegador; después pasaron 19 pruebas específicas del proxy. En una repetición local de k6, con hasta 30 usuarios virtuales, hubo 14 796 solicitudes y 183,41 peticiones por segundo en promedio. El percentil 95 fue 18,70 milisegundos y el 99, 30,38; no hubo fallos HTTP ni respuestas 500 en ese escenario. Son cifras de esta computadora, no de producción. Además, restauramos un respaldo en una base aislada, comparamos esquema y migraciones y comprobamos un login. Listar un dump solo no habría demostrado eso.»
- **Memorizar:** pruebas históricas; k6 local; restauración real.
- **Transición:** «Terminemos con el resultado y los límites que todavía debemos atender.»
- **No afirmar:** que k6 mide Render ni que un dump legible garantiza recuperación.

### Diapositiva 12 — Qué logramos y qué falta

- **Responsable y tiempo:** Integrante 6, 55 s.
- **Propósito:** cerrar con un balance técnico honesto.
- **En pantalla:** «Flujos por rol construidos» · «Seguridad verificada parcialmente» · «Siguiente etapa».
- **Visual:** tres hitos y tres pendientes, sin porcentajes inventados.
- **Oral:** «SIGA ya permite seguir un flujo completo: crear estructura y perfiles, matricular, asignar un curso, registrar una nota y una asistencia, y consultarlas desde la cuenta del estudiante. Lo verificamos con pruebas y con una restauración real del respaldo. También reconocemos límites: ZAP Baseline no se ejecutó por falta de herramienta operativa; faltan autenticación multifactor, auditoría persistente, respaldos automatizados y más monitoreo. El token se guarda en sessionStorage y el logout no revoca una sesión individual. Observamos un 503 documentado y, por separado, se reportó un timeout sin traza conservada; ninguna causa está confirmada. Nuestro cierre es un producto académico demostrable, con controles medidos y un camino claro para fortalecerlo, no una garantía de seguridad absoluta.»
- **Memorizar:** flujo completo; límites; siguiente etapa.
- **Transición final:** «Gracias. Quedamos atentos a sus preguntas.»
- **No afirmar:** que ZAP se aprobó o que el 503 y el timeout tienen la misma causa.

## Demostración opcional, fuera del tiempo principal

Usarla **solo si el profesor concede 60–90 segundos adicionales**. Preparar sesiones con anticipación y no mostrar contraseñas ni tokens. Guion de unos 75 segundos: login o sesión preparada (10 s), panel y navegación por rol (15 s), Mi aula y una matrícula sin editar (20 s), Mis calificaciones y Mi asistencia del estudiante (20 s), cierre que relacione ambas vistas (10 s). Para respetar el limitador, usar pestañas o sesiones ya autenticadas; no repetir logins fallidos. Si Render tarda, usar capturas actuales sin datos sensibles y aclarar que sustituyen la vista en vivo, no que demuestran el estado actual del servicio.

## Ensayo y contingencias

- **Antes de exponer:** comprobar Vercel y Render; abrir login varios minutos antes para calentar Render; revisar la regla externa /32 solo si se necesita mantenimiento; verificar las cuatro cuentas controladas sin proyectar credenciales; tener respaldo vigente y capturas limpias; ensayar con cronómetro cerca de 128 palabras por minuto.
- **Relevos:** después de 2, 4, 6, 8 y 10. El siguiente integrante debe estar listo antes de la frase de transición y tomar la palabra en unos cuatro segundos.
- **Palabras difíciles:** SIGA («siga»), SIAGIE («siagie»), Prisma, bcrypt («bi-cript»), JWT («jota doble ve te»), CSP («ce ese pe»), IDOR («ai-dor»), k6 («kei seis»), percentil y pg_restore. Explicar cada sigla la primera vez.
- **Cinco errores a evitar:** 1) llamar oficiales a las matrículas o notas; 2) prometer seguridad total por CSP u Observatory A+; 3) extrapolar k6 local a producción; 4) decir que ZAP pasó; 5) confundir el 503 documentado con el timeout reportado o inventar su causa.
- **Si alguien olvida una parte:** retomar sus tres palabras clave, dar una frase puente y continuar; no retroceder ni leer toda la diapositiva. El siguiente expositor conserva el orden. Ante una cifra olvidada, reconocerlo y remitir al informe durante preguntas.
- **Banco de preguntas por integrante:** 1: [1–3 y 37](../architecture/software-study-questions.md); 2: 4–8 y 11–13; 3: 9–10, 16 y 25; 4: 12–15 y 31–32; 5: 17–30 y 35–36; 6: 7, 31–34 y 38–40. Todos deben poder responder la 38 sobre límites.

## Fuentes para verificar antes del ensayo

La [guía de estudio](../architecture/software-study-guide.md) y el [banco de preguntas](../architecture/software-study-questions.md) reúnen contratos, roles y límites. Las cifras de k6 proceden del [informe de rendimiento](../security/performance-results.md); CSP, Observatory, trust proxy y el 503 se documentan en la [auditoría externa](../security/external-security-audit.md). El [runbook](../operations/backup-restore-runbook.md) registra la restauración real. La [matriz normativa](../security/security-and-regulations.md) distingue normas de decisiones técnicas; la [base legal de SIAGIE](https://siagie.minedu.gob.pe/baselegal/) explica su función oficial. Los conteos 75/15/32 pertenecen al cierre histórico citado en la guía, no a una nueva ejecución para este guion. Del timeout separado no se conserva traza diagnóstica en el repositorio.
