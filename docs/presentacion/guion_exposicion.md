# Guion de exposición de SIGA

**Duración sugerida:** 6 minutos; dos diapositivas por integrante. La presentación describe el producto académico construido, no una institución real ni un sistema certificado. Las capturas de interfaz usan datos ilustrativos locales y no muestran credenciales.

| Integrante | Diapositivas | Tiempo | Idea y transición |
| --- | --- | --- | --- |
| 1 | 1–2 | 1 min | Presentar el problema de registros dispersos y el alcance de SIGA. Seguir con el recorrido React → Express/Prisma → PostgreSQL: la interfaz ayuda, la API aplica reglas y la base protege relaciones. |
| 2 | 3–4 | 1 min | Explicar qué puede hacer cada rol y por qué ocultar un botón no basta. Mostrar que el JWT se verifica contra la cuenta activa, el rol y `tokenVersion`; al cambiar la contraseña, los tokens anteriores quedan inválidos. Mi perfil solo edita nombres propios. |
| 3 | 5–6 | 1 min | Recorrer nivel, grado, periodo y sección. Luego señalar en la captura de Matrículas que el nombre de `Student` aparece primero y el código debajo, aun sin cuenta de acceso. Una matrícula por estudiante y periodo. |
| 4 | 7–8 | 1 min | Relacionar curso, sección y docente mediante la asignación; un cambio de docente cambia el alcance de acceso. La nota usa AD/A/B/C por bimestre y la asistencia una fecha del periodo. La misma sección se comprueba también en PostgreSQL. |
| 5 | 9–10 | 1 min | Separar controles técnicos de obligaciones legales. Ley 29733 y su Reglamento orientan el análisis de datos personales; las normas MINEDU orientan matrícula y evaluación. SIGA no sustituye SIAGIE ni acredita cumplimiento integral. Ilustrar rechazos 401, 403 y 409. |
| 6 | 11–12 | 1 min | Mostrar Vercel, Render y PostgreSQL como despliegue de demostración con datos ilustrativos. Citar verificaciones del repositorio: Jest/Supertest, integración en `siga_test`, Vitest, build y recorrido E2E documentado. Cerrar con pendientes reales: auditoría, respaldo/restauración probada y evaluación por competencias. |

## Respuestas breves para preguntas

- **¿Se revoca un JWT al salir?** No. El logout borra la sesión local; cambiar la contraseña incrementa `tokenVersion` y rechaza los JWT anteriores de esa cuenta.
- **¿Por qué no se permite cierto traslado?** Una matrícula con notas o asistencia conserva su sección para no romper la relación histórica con la asignación docente.
- **¿La nota representa la evaluación oficial?** No. Una calificación por curso y bimestre es una simplificación del proyecto; no implementa competencias ni procesos oficiales de SIAGIE.
- **¿Qué datos son reales?** Las capturas incluidas en la presentación se generaron con respuestas ilustrativas locales. La demo publicada usa cuentas controladas y datos académicos ficticios.

## Evidencia y fuentes

- Contratos y restricciones: `backend/prisma/schema.prisma`, rutas y servicios de `backend/src/`; matriz de alcance en [seguridad-y-normativa.md](../seguridad-y-normativa.md).
- Pruebas y recorrido por rol: [demo.md](../demo.md) y `backend/tests/`, `frontend/src/test/`, `frontend/scripts/e2e-mvp.mjs`.
- Despliegue y estado de datos: [despliegue-demo.md](../despliegue-demo.md) y [transicion-datos-beta.md](../transicion-datos-beta.md).
- Referencias oficiales: [Ley 29733](https://www.gob.pe/institucion/anpd/normas-legales/2018427-29733-2011), [D. S. 016-2024-JUS](https://www.gob.pe/institucion/anpd/normas-legales/6554453-n-016-2024-jus), [R. M. 010-2026-MINEDU](https://www.gob.pe/institucion/minedu/normas-legales/7603336-010-2026-minedu), [R. V. M. 094-2020-MINEDU](https://www.gob.pe/institucion/minedu/normas-legales/541161-094-2020-minedu) y [R. V. M. 048-2024-MINEDU](https://www.gob.pe/institucion/minedu/normas-legales/5518274-048-2-24-minedu).

Antes de exponer, reemplazar “Integrante 1…6” por los nombres reales en el reparto oral. No incluir credenciales ni abrir archivos locales de entorno durante la demostración.
