# Plan del proyecto: Punto Fusión - Asistente Telegram & Shopify

Creado: 2026-10-16
Última actualización: 2026-10-31
Última revisión: 2026-10-31
Zona horaria: America/Bogota (UTC-5)
Base de revisión: Consulta y requerimiento del usuario del 2026-10-31 (funcionalidad de consulta de precios en Telegram sin afectar la orden activa). Entorno local y VPS revisados.
Fuente canónica: PLAN_PROYECTO.md
Estado del plan: H6 cerrado (reiniciar). Hito activo W1 (WhatsApp: calendario y dashboard). H5 con despliegue pendiente.

## Norte y alcance

- Resultado esperado: Asistente interno en Telegram para asesores y equipo de Punto Fusión que recibe órdenes en lenguaje natural (ej. *"una cegueta de 15 cm para Pepito Pérez"*), identifica los productos y variantes en Shopify, arma la propuesta/borrador de la orden y solicita confirmación con un botón para convertirla formalmente en una Orden en Shopify.
- Criterio de éxito:
  1. El asesor envía un mensaje informal de pedido por Telegram.
  2. El asistente extrae ítems, cantidades y cliente, y busca coincidencias en el catálogo de Shopify `tiendapuntofusion`.
  3. Si hay varias opciones o variantes, permite elegir rápidamente con botones inline.
  4. Muestra un resumen claro del borrador preparado con cliente, productos, precios y total.
  5. Pide confirmación al asesor (*"¿Confirmas pasar este pedido a Orden en Shopify?"* con botones `[✅ Confirmar Orden]` y `[❌ Cancelar]`).
  6. Al confirmar, crea la Orden formal en Shopify y notifica con el ID de orden confirmado.
- Alcance vigente:
  - Bot de Telegram privado / de uso interno para asesores.
  - Procesamiento de lenguaje natural de pedidos (extracción de productos, cantidades, nombres de cliente).
  - Búsqueda tolerante en catálogo de Shopify (manejo de variantes, sinónimos y faltas ortográficas).
  - Confirmación interactiva antes de asentar la orden definitiva en Shopify.
- Fuera de alcance:
  - Generación de links de pago para el cliente (descartado explícitamente por el usuario).
  - Catálogo público para consumidores finales (el flujo es estrictamente interno).
- Restricciones conocidas:
  - Catálogo en Costa Rica (precios en CRC).
  - Uso de tokens ya verificados de Telegram y Shopify.

## Situación verificada

- Existe backend `punto_fusion_api` (Node.js/Express, TypeScript, Prisma/Supabase) en producción (`https://puntofusion.smartnexo.com/api`).
- Existe servidor MCP `punto_fusion_mcp_server` (`https://mcp.puntofusion.smartnexo.com/mcp`).
- Credenciales de Telegram validadas con API oficial: `@PuntoFusionShopBot` (ID: 8930239057).
- Conexión a Shopify API (`tiendapuntofusion.myshopify.com`) verificada exitosamente vía Client Credentials grant; consulta de catálogo probada con éxito.
- Flujo funcional acordado: Entrada libre -> Borrador preparado -> Confirmación interactiva -> Creación de Orden oficial en Shopify.

## Hitos

| ID | Resultado | Aceptación | Depende de | Estado | Fecha objetivo |
|---|---|---|---|---|---|
| H1 | Preparación de Credenciales y Flujo Acordado | Tokens configurados; flujo conversacional interno definido | - | hecha | 2026-10-16 |
| H2 | Conector API Shopify (Catálogo y Creación de Órdenes) | Módulo funcional capaz de consultar productos y crear órdenes confirmadas en Shopify | H1 | hecha | 2026-10-16 |
| H3 | Bot de Telegram y Flujo de Conversación | Flujo de diálogo en Telegram para recibir texto informal, mostrar borrador y confirmar orden | H2 | hecha | 2026-10-16 |
| H4 | Pruebas End-to-End con el Asesor | Pedido real de prueba tomado en Telegram y verificado en el panel de pedidos de Shopify | H3 | hecha | 2026-10-16 |
| H5 | Estados de Cuenta Diarios por Alumno y Persistencia en Supabase | Generación bajo demanda y al cierre diario del estado consolidado de pedidos y montos por alumno, guardado en Supabase | H3, H4 | hecha | 2026-10-24 |
| H6 | Definición independiente del proyecto con EGM (sin mirar el código), comparación con lo construido y decisión de corregir o reiniciar | Design doc revisado en `docs/designs/`; matriz de brechas contra el código; decisión documentada (corregir o reiniciar) | - (H5 no lo bloquea) | hecha (decisión: reiniciar) | 2026-10-30 |
| W1 | WhatsApp: Calendario y dashboard (sin bot) | El dueño carga grupos y alumnos reales y mueve un alumno desde el dashboard sin poder romper las reglas duras (cupo, una clase por persona por día); probado en local | H6 | en_curso | por definir |
| W2 | WhatsApp: Bot para alumnos, núcleo (cancelar y reponer) | Un alumno real cancela y repone por WhatsApp sin intervención y el calendario queda consistente | W1 | pendiente | por definir |
| W3 | WhatsApp: Recordatorios (1 día y 1 hora antes) y confirmaciones | Recordatorios enviados con plantillas aprobadas de Meta; sin recordatorios en cierres | W2 | pendiente | por definir |
| W4 | WhatsApp: Ausencias, taller sin asistencia, sesiones virtuales y estado de pago | Flujos de ausencia y reglas de pago aplicadas desde datos | W2 | pendiente | por definir |
| W5 | WhatsApp: Taller asistido para no alumnos con pago WOP | Cupo bloqueado durante el pago, aprobación por Telegram, devolución al segundo pagador | W1, W2 | pendiente | por definir |
| W6 | WhatsApp: Endurecimiento y extras | Datos personales revisados, turnero web, nodos del guion fuera de alcance decididos | W2 | pendiente | por definir |

Hito activo: W1 (Calendario y dashboard). Detalle de los hitos W1 a W6 y decisiones de producto: [concepts_brief.md](docs/egm/concepts_brief.md).
H5 sigue con despliegue pendiente (R-04); no lo bloquea W1.

## Trabajo comprometido

| ID | Hito | Tarea y entregable | Aceptación | Depende de | Prioridad | Estado | Responsable | Evidencia |
|---|---|---|---|---|---|---|---|---|
| T-01 | H1 | Guía y obtención de accesos (BotFather + Shopify Custom App) | Token de Telegram y credenciales Shopify Admin API listos en `.env` | - | P1 | hecha | Usuario / Antigravity | 2026-10-16: `@PuntoFusionShopBot` OK y productos de Shopify consultados OK |
| T-02 | H1 | Definición del flujo de pedido (Borrador -> Confirmación -> Orden) | Flujo acordado sin enlace de pago y con confirmación interactiva | T-01 | P1 | hecha | Usuario / Antigravity | 2026-10-16: Definido por usuario |
| T-03 | H2 | Implementación del cliente Shopify API | Funciones de búsqueda de productos y creación de orders probadas | T-01, T-02 | P1 | hecha | Antigravity | 2026-10-16: [shopify.ts](file:///Users/macair/Antigravity-projects/punto_fusion/punto_fusion_api/src/lib/shopify.ts) implementado y compilado |
| T-04 | H3 | Implementación del bot de Telegram | Bot que recibe texto, parsea intención, muestra borrador y crea orden al confirmar | T-03 | P1 | hecha | Antigravity | 2026-10-16: [bot.ts](file:///Users/macair/Antigravity-projects/punto_fusion/punto_fusion_api/src/bot.ts) en ejecución activa |
| T-06 | H3 | Soporte de notas de voz (Audio / Voice messages) | Descarga de audio de Telegram y transcripción automática con Whisper API | T-04 | P1 | hecha | Antigravity | 2026-10-16: [transcriber.ts](file:///Users/macair/Antigravity-projects/punto_fusion/punto_fusion_api/src/lib/transcriber.ts) activo y compilado |
| T-07 | H3 | Búsqueda difusa y resolución interactiva (Productos y Clientes) | Búsqueda nativa a nivel de variantes (ej. empanadas/almojábanas bajo Café Catalina), soporte multi-ítem, tolerancia fonética Levenshtein e ítems personalizados | T-03, T-04 | P1 | hecha | Antigravity | 2026-10-16: searchProductsSmart con indexación de variantes y resolución directa en vivo |
| T-05 | H4 | Pruebas de integración E2E | Verificación de orden creada en `tiendapuntofusion` | T-04, T-06, T-07 | P1 | hecha | Antigravity | 2026-10-16: Verificada creación de 6 ítems simultáneos (empanadas, almojábana, broca 0.9, plata 1000, lijas y piedra personalizada) en Borrador #D2908 |
| T-08 | H3 | Verificación de pedidos duplicados (mismo día y producto exacto) | Consulta de pedidos y borradores del día para el cliente en Shopify; alerta si hay coincidencia exacta de producto antes de confirmar | T-03, T-04, T-07 | P1 | hecha | Antigravity | 2026-10-17: Probado con órdenes reales de hoy (#3951 y #3952); detecta coincidencia exacta de variante y permite confirmación adicional o cancelación |
| T-09 | H3 | Soporte para notas de voz largas (Timeouts a 5 min, feedback dinámico y log persistente) | Timeouts extendidos para notas de 2-5 min (60s getFile, 180s descarga, 300s Whisper), indicador de duración, typing heartbeat y `bot.log` | T-06 | P1 | hecha | Antigravity | 2026-10-20: Compilado y verificado; soporta notas de voz de hasta 5 minutos sin bloqueo |
| T-10 | H3 | Corrección de creación de clientes con un solo nombre en Shopify | Shopify rechaza `customer.last_name` en blanco (422); se asigna placeholder automático y serialización limpia de errores | T-03 | P1 | hecha | Antigravity | 2026-10-20: Probado creando orden con cliente 'Paulín'; orden #3961 creada exitosamente |
| T-11 | H3 | Aclaración interactiva y búsqueda difusa de clientes en Shopify | Búsqueda difusa por Levenshtein y prefijos en memoria con ranking por compras; menú de opciones numeradas + "Es un cliente nuevo" | T-03, T-04, T-07 | P1 | hecha | Antigravity | 2026-10-20: Probado con "Paulín" -> presenta Pauli Carmiol (91 pedidos), paul jueves (63), Ali Paul (46) y cliente nuevo; selección interactiva OK |
| T-12 | H3 | Desambiguación semántica de "Helados la paletea" y logging bidireccional | Diferenciación estricta entre Helados la paletea y Cafe La Catalina; fallback por palabra clave y registro de respuestas del bot en `bot.log` | T-07, T-09 | P1 | hecha | Antigravity | 2026-10-20: Probado con "un helado" -> presenta opciones de paletas, conos y sándwich de Helados la paletea |
| T-13 | H3 | Prevención de duplicados por eco de IA, corrección de clientes y handler "solo 1" | Búsqueda directa si el asesor escribe otro nombre en aclaración de cliente; guardrail anti-eco para ignorar productos no mencionados; handler 0d para "solo 1" | T-07, T-11 | P1 | hecha | Antigravity | 2026-10-24: Probado con secuencia "limiana..." -> "Liliana" -> "1" -> "Solo 1 engaste"; orden se mantiene exactamente en 1 ítem sin duplicar |
| T-14 | H5 | Tablas en Supabase para persistencia de pedidos diarios de alumnos | Tabla `pf_daily_orders` y `pf_daily_order_items` en Supabase; registro automático al confirmar orden en Telegram | H2, H3 | P1 | hecha | Antigravity | 2026-10-24: Tablas DDL aplicadas en supabase_db, Prisma schema sincronizado, queries y sync probados OK |
| T-15 | H5 | Motor de consolidación de estados de cuenta por alumno (Día en curso) | Función que agrupa órdenes y productos por alumno, calcula subtotales, totales por alumno y gran total del día | T-14 | P1 | hecha | Antigravity | 2026-10-24: dailyReport.ts probado con órdenes reales de hoy; consolida montos por alumno y gran total CRC (₡69.675) |
| T-16 | H5 | Activación del estado de cuenta bajo demanda y endpoint REST | Detección conversacional por voz/texto ("dame el valor a pagar por cada alumno"), comandos Telegram (/reporte, /cierre) y endpoint HTTP GET /api/reports/daily; cierre automático retirado por variabilidad de horarios de clases | T-15 | P1 | hecha | Antigravity | 2026-10-24: Interceptor en orderAgent.ts, comandos /reporte en bot.ts y GET /api/reports/daily verificados |
| T-17 | H5 | Consumo individual por alumno con períodos y rangos de fecha | Consultas como "dame el consumo de Caro Madrigal de esta semana"; por defecto hoy, soporte para ayer, esta semana, semana pasada, mes o fecha; resolución difusa en Supabase y Shopify | T-15, T-16 | P1 | hecha | Antigravity | 2026-10-24: Probado con "Caro Madrigal esta semana" (resolvió carolina madrigal, #3972 ₡6.750) y "Marta Peraza esta semana" (#3964, #3966 ₡63.000) |
| T-18 | H5 | Arquitectura 100% IA-First para clasificación de intenciones (Cero reglas duras/regexes) | Eliminación de regexes y compuertas rígidas de entrada; `gpt-6-luna` clasifica semánticamente cada mensaje en `intent` (general_report, student_report, order, confirmation, cancellation) extrayendo período y alumno dinámicamente | T-16, T-17 | P1 | hecha | Antigravity | 2026-10-24: Probado con mensajes informales ("Pásame el detalle x cliente", "cuánto debe Liliana", "Haz cierre", etc.); compilado y verificado OK |
| T-19 | H5 | Chunking seguro en Telegram (>4096 caracteres), meses nominales y memoria de período de reporte | `replySafely` divide automáticamente reportes largos por párrafos/alumnos respetando el límite de Telegram; soporte para nombres de meses (ej. "octubre"); persistencia de período en sesión para consultas secuenciales ("el mismo detalle para...") | T-15, T-18 | P1 | hecha | Antigravity | 2026-10-25: Probado con reporte de 7.200 caracteres (partido en 2 chunks) y parseDateRange('octubre') OK |
| T-19b | H5 | Interceptor interactivo antes de crear productos personalizados, corrección de búsqueda de metales/gemas y remoción de ítems | Preguntar al usuario antes de crear productos fuera de catálogo; sugerencias difusas de inventario existente; corrección de reglas de hilo 950 y piedras calibradas/esmeraldas; corrección de guardrail anti-eco por variante; soporte para 'quita X' | T-18, T-19 | P1 | hecha | Antigravity | 2026-10-30: Verificado con simulaciones locales de hilo 1mm, piedras 1.5mm + esmeralda 2mm simultáneas, eliminación y confirmación interactiva antes de crear |
| T-19c | H3 | Consulta conversacional de precios de productos y variantes (price_inquiry) | Detección de intención 'price_inquiry' por voz/texto (ej. "¿cuánto cuesta el hilo de 1mm?", "a cómo están los helados", "precio de almojábana"); búsqueda tolerante en catálogo de Shopify y respuesta con precios y variantes formateados en CRC sin alterar el borrador de orden en curso | T-07, T-18 | P1 | hecha | Antigravity | 2026-10-31: Implementada intención price_inquiry en IA, handlePriceInquiry tolerante con catálogo de Shopify y variantes; comandos /precio y /precios en bot.ts; probado con hilo 1mm, piedras calibradas, almojábana, esmeralda 2mm, plata 1000, producto no encontrado y preservación de orden activa |

### Flujo EGM (H6): definir primero, comparar después, construir con Claude Code

Orden decidido por el usuario el 2026-10-30. Los skills EGM son de invocación manual: los escribe el usuario al inicio de un mensaje (`/egm:egm-brainstorm`, `/egm:egm-draft`, `/egm:egm-review`, `/egm:egm-bootstrap`). Cada fase corre en sesión limpia. Las fases 1 y 2 no leen el código ni este plan, para que la definición no quede sesgada por lo construido. Las prioridades son propuestas.

| ID | Hito | Tarea y entregable | Aceptación | Depende de | Prioridad | Estado | Responsable | Evidencia |
|---|---|---|---|---|---|---|---|---|
| T-20 | H6 | Fase 0: fijar producto, reunir insumo del brainstorm y añadir `EGM artifact directory: docs/egm` a `CLAUDE.md` | Producto confirmado por el usuario; `INSUMO_BRAINSTORM.md` y `FUENTES.md` creados; línea añadida en `CLAUDE.md` | - | P1 (propuesta) | hecha | Claude Code / Usuario | 2026-10-30: usuario eligió el chatbot de WhatsApp (corrigió una respuesta previa que decía Telegram); [FUENTES.md](docs/egm/FUENTES.md), [INSUMO_BRAINSTORM.md](docs/egm/INSUMO_BRAINSTORM.md) y línea en `CLAUDE.md` verificados en disco |
| T-21 | H6 | Fase 1a: `/egm:egm-brainstorm` sobre `docs/egm/INSUMO_BRAINSTORM.md`, sin código | `concepts_brief.md` con objetivo, usuarios, alcance, exclusiones e hipótesis, aprobado por el usuario | T-20 | P1 (propuesta) | hecha | Usuario / Claude Code | 2026-10-30: [concepts_brief.md](docs/egm/concepts_brief.md) con revisión de 6 Goldfish, decisiones del usuario e hitos W1–W6 aprobados por el usuario |
| T-22 | H6 | Fase 1b: `/egm:egm-draft` | Design doc por secciones en `docs/designs/` más `SITEMAP.md`, aprobado por el usuario | T-21 | P1 (propuesta) | cancelada | Usuario / Claude Code | 2026-10-30: el usuario pidió construir por hitos desde el brief; el diseño se hace por hito |
| T-23 | H6 | Fase 1c: `/egm:egm-review` | Informe de revisión guardado; hallazgos aceptados o descartados con motivo registrado | T-22 | P1 (propuesta) | cancelada | Usuario / Claude Code | 2026-10-30: misma razón que T-22 |
| T-24 | H6 | Fase 2: `/egm:egm-bootstrap` sobre el código existente y matriz de brechas (requisito vs construido: cumple, parcial, falta, sobra) | READMEs revisados por una persona; matriz con evidencia por requisito; incluye la sync con el Agendador | T-23 | P1 (propuesta) | cancelada | Claude Code / Usuario | 2026-10-30: el usuario decidió construir de cero; no se compara con lo construido |
| T-25 | H6 | Fase 3: decisión corregir o reiniciar | Decisión del usuario registrada, apoyada en: % de requisitos centrales cumplidos, reutilización de datos e integraciones (Supabase, Agendador, Shopify) y costo de corregir contra reconstruir | T-24 | P1 (propuesta) | hecha | Usuario | 2026-10-30: "Crea lo de cero"; el stack viejo y sus tablas no se tienen en cuenta |
| T-26 | H6 | Fase 4: reescribir este plan (hitos de construcción desde el design doc) y actualizar `CLAUDE.md` para que Claude Code sea el ejecutor y planificador, sin depender de Antigravity | Plan y `CLAUDE.md` actualizados tras confirmación explícita del usuario; incluye `/egm:egm-drift-report` semanal (opcional) | T-25 | P2 (propuesta) | pendiente | Claude Code / Usuario | - |

### W1: Calendario y dashboard (repo nuevo `punto_fusion_agenda`, Next.js, local primero)

Repositorio local en `/Users/macair/Antigravity-projects/punto_fusion_agenda` (decisión del usuario: repo nuevo; Next.js todo en uno). Aún sin remoto en GitHub.

| ID | Hito | Tarea y entregable | Aceptación | Depende de | Prioridad | Estado | Responsable | Evidencia |
|---|---|---|---|---|---|---|---|---|
| T-30 | W1 | Modelo de datos con reglas duras en Postgres (esquema `agenda`) y migrador | Pruebas contra Postgres real: cupo, concurrencia, una clase por persona por día, cierres, generación de sesiones, padrón | - | P1 | hecha | Claude Code | 2026-10-30: `db/migrations/001_esquema_inicial.sql`; `pnpm test:db` 12/12 en `agenda_test`; prueba de mutación (sin bloqueo de fila la prueba de concurrencia falla); `agenda_dev` migrada |
| T-31 | W1 | API del calendario (route handlers de Next.js) con autenticación por clave | Endpoints de alumnos, teléfonos, grupos, inscripciones, sesiones, asistencias, cierres y mensualidades; errores de reglas duras traducidos a respuestas claras; pruebas | T-30 | P1 | hecha | Claude Code | 2026-10-30: `src/app/api/v1/*` (CRUD por recurso, `calendario`, `sesiones/generar`, `asistencias/{id}/mover`), migración `002_cancelaciones_en_cascada.sql`; `pnpm test` 23/23 (11 HTTP contra `next dev` + 12 de base); `tsc`, lint y `next build` OK. Documentado en README del repo |
| T-32 | W1 | Dashboard (calendario semanal, alumnos, grupos, cierres, mover alumno) siguiendo el pipeline de diseño (impeccable → huashu-design → ui-ux-pro-max) | El dueño carga datos reales y mueve un alumno en local sin poder romper reglas | T-31 | P1 | en_curso (falta la prueba del dueño) | Claude Code / Usuario | 2026-10-30: dirección «Tablero de salidas» elegida por el usuario (seed 86412a36); varias cuentas con sesiones en BD (migración 003); pantallas tablero/pase/modo mover, alumnos, grupos, cierres, cuentas y login; mover y rechazo CUPO_LLENO probados en navegador con datos demo; revisión independiente: 2 rondas (8 correcciones, 6 resueltas + 2 verificadas en captura, 3 regresiones corregidas); detector sin hallazgos; `pnpm test` 24/24; `next build` OK. huashu-design omitido: la exploración se hizo en la página de decisión de impeccable. 2026-10-31: tras la prueba del usuario se agregó la vista de mes (`/mes`, selector Semana | Mes) para ver cupos de todo el mes; verificada en 1440/1280/390 px |
| T-33 | W1 | Empaquetado Docker y despliegue en el VPS | App arriba en la URL que entregue el usuario, contra Supabase del VPS | T-32, aprobación en local | P2 | bloqueada | Usuario / Claude Code | Desbloqueo: aprobación en local y URL del usuario |

### W2: Bot de WhatsApp para alumnos, núcleo (repo `punto_fusion_agenda`)

Diseño y decisiones: `docs/W2.md` del repo. Decisiones del usuario (2026-10-31): modelo OpenAI (misma cuenta que Telegram); la línea de WhatsApp aún no existe → simulador local primero; avisos por un bot de Telegram nuevo; aviso tardío libera la plaza y la clase se da por tomada; cancelar/reponer una vez al mes.

| ID | Hito | Tarea y entregable | Aceptación | Depende de | Prioridad | Estado | Responsable | Evidencia |
|---|---|---|---|---|---|---|---|---|
| T-40 | W2 | Plan de W2 por escrito | `docs/W2.md` con decisiones y tareas | W1 | P1 | hecha | Claude Code / Usuario | 2026-10-31: `docs/W2.md` |
| T-41 | W2 | Migración 004: reglas configurables y novedades | Migra y las pruebas siguen pasando | T-40 | P1 | hecha | Claude Code | 2026-10-31: `004_reglas_y_novedades.sql`; `pnpm test` 29/29 |
| T-42 | W2 | Motor de cancelación y reposición + endpoints API | Pruebas de cada regla (a tiempo, segunda del mes, tardía, clase pasada, fuera de plazo, un solo uso) | T-41 | P1 | hecha | Claude Code | 2026-10-31: `src/lib/reglas.ts`, `POST /asistencias/{id}/cancelar`, `GET/POST /alumnos/{id}/reposicion`; 5 pruebas nuevas; mutación de la regla mensual detectada |
| T-43 | W2 | Agente conversacional OpenAI con herramientas | Conversaciones de prueba en el simulador | T-42 | P1 | pendiente | Claude Code | - |
| T-44 | W2 | Canal: simulador local + adaptador WhatsApp Cloud | Simulador funcionando; firma del webhook probada | T-43 | P1 | pendiente | Claude Code | - |
| T-45 | W2 | Coexistencia: silencio 15 min, reproceso, interruptor global | Pruebas con ecos simulados | T-44 | P1 | pendiente | Claude Code | - |
| T-46 | W2 | Avisos por Telegram (bot nuevo) | Aviso recibido en el chat del equipo | T-43 | P2 | bloqueada | Usuario / Claude Code | Desbloqueo: token del bot nuevo de BotFather y chat de destino |
| T-47 | W2 | Prueba de punta a punta | Un alumno cancela y repone sin intervención | T-43…T-46 | P1 | pendiente | Usuario / Claude Code | Con línea real: requiere app de Meta y número en coexistencia |

## Bloqueos y riesgos relevantes

| ID | Tarea o hito | Bloqueo o riesgo | Impacto | Resolución o mitigación | Responsable |
|---|---|---|---|---|---|
| R-01 | T-01 | Permisos restringidos en Shopify Admin | No se puede generar token privado | Resuelto: Client credentials grant activo | Antigravity |
| R-02 | H6 | Discrepancia sin resolver: la sync con el Agendador (`pf_bookings`, `/api/bookings/reconcile`, etc.) no figura en este plan | La comparación podría omitir parte del sistema | Incluirla en T-24 y verificar contra el código | Claude Code |
| R-03 | H6 | `CLAUDE.md` asigna la arquitectura a Antigravity, pero el usuario decidió construir con Claude Code | Roles contradictorios mientras no se actualice | Actualizar `CLAUDE.md` en T-26, tras confirmación explícita del usuario | Usuario |
| R-04 | H5 | Despliegue de H5 pendiente (commit, push y deploy) | Puede ser innecesario si T-25 decide reiniciar | Decidir en T-25; mientras tanto no se toca el código | Usuario |
| R-06 | W1 | El "stack viejo" del VPS incluye la API que hoy corre el bot de Telegram/Shopify (H5) y las tablas `pf_*` y la sync con el Agendador (`cal_*`) | Borrarlo sin revisar podría apagar el bot de Telegram en producción | No se toca el VPS en W1. Las tablas nuevas van en un esquema propio para no mezclarse. Cualquier limpieza del VPS se revisa aparte y con confirmación explícita | Usuario / Claude Code |
| R-07 | W1 | No hay Docker local; Postgres 18 local (Homebrew) sí está activo | Supabase local (CLI) no se puede usar; el desarrollo local va sobre Postgres directo | Migraciones SQL portables a Supabase del VPS; verificar en T-33 que `btree_gist` se cree en el esquema de extensiones de Supabase | Claude Code |
| R-08 | W1 | Regla de cupo de inscripciones es conservadora: cuenta todas las inscripciones que se cruzan con el rango nuevo | En casos raros (inscripciones que se suceden en el tiempo) podría rechazar una inscripción válida | Aceptado para W1; revisar si aparece en uso real | Claude Code |
| R-05 | H6 | Divergencia de producto entre los documentos de WhatsApp y este plan (Telegram/Shopify) | - | Resuelto 2026-10-30: el usuario eligió WhatsApp para esta definición; Telegram/Shopify queda fuera (ya funciona) | Usuario |

## Backlog de ideas

| ID | Idea y valor esperado | Dependencias | Condición para incorporarla |
|---|---|---|---|
| B-01 | Integración con WhatsApp adicional a Telegram | H4 | Cuando el flujo de Telegram esté validado |
| B-02 | Alertas automáticas en Telegram al staff cuando entra un pedido | H3 | Solicitud explícita del cliente |

## Decisiones y cambios de plan

| Fecha | Decisión o cambio | Razón | Impacto en alcance, secuencia o fecha | Fuente de la decisión |
|---|---|---|---|---|
| 2026-10-16 | Creación inicial del plan | Solicitud de bot de Telegram para tomar pedidos en Shopify | Establece ruta clara de integración | Usuario |
| 2026-10-16 | Ajuste a flujo interno y confirmación interactiva | El bot es para uso del equipo comercial, sin links de checkout | Simplifica el flujo y añade botón de confirmación antes de impactar Shopify | Usuario |
| 2026-10-16 | Corrección de callback data delimiter | El split de botones interactivos fallaba por guiones bajos en el ID | Se estandarizó delimitador `:` (action:id:param) | Antigravity |
| 2026-10-16 | Búsqueda directa por variantes e ítems múltiples | En Shopify varios productos son "paraguas" (ej. Café La Catalina contiene empanadas y almojábanas) | La búsqueda indexa las 569 variantes directamente y resuelve pedidos multi-ítem en un solo paso | Usuario / Antigravity |
| 2026-10-16 | Análisis de productos 100% delegado a IA (Cero código rígido) | El matching por código es inflexible y requiere mantenimiento ante nuevos productos o variantes | Se inyecta el catálogo vivo de Shopify en el prompt del LLM; la IA realiza el análisis semántico y adaptación instantánea a cualquier nuevo ítem del inventario | Usuario / Antigravity |
| 2026-10-16 | Corrección de Plata 1000 vs Plata 950 y asignación de precio | La IA mapeaba numéricamente a Plata 950 y dejaba precio en 0 | Se instruye distinción explícita en el prompt y se toma el precio oficial del catálogo (₡14.000) por título exacto en vez de IDs numéricos volátiles | Usuario / Antigravity |
| 2026-10-17 | Verificación anti-duplicados del mismo día por coincidencia exacta | Evitar doble registro de pedidos para un mismo cliente y producto | Se consultan órdenes/borradores de Shopify creados en el día calendario actual; si coincide producto, se alerta en el resumen | Usuario |
| 2026-10-17 | Migración de modelo de IA a gpt-6-luna | Mayor velocidad, capacidad de razonamiento y precisión en pedidos complejos | Se actualiza el motor en `orderAgent.ts` a `gpt-6-luna` con soporte para configuración dinámica vía `OPENAI_MODEL` | Usuario |
| 2026-10-20 | Corrección de timeout en notas de voz y logger persistente | Las notas de voz fallaban por timeouts restrictivos (15s/25s/30s) ante latencia de red o audios largos | Se aumentaron los timeouts (30s/60s/90s), se añadió feedback en vivo por etapas y logging persistente en `bot.log` | Usuario / Antigravity |
| 2026-10-20 | Corrección error 422 Shopify por cliente con un solo nombre | En pedidos con clientes sin apellido (ej. "Paulín"), Shopify rechazaba la orden con error 422 (customer.last_name can't be blank) | Se asegura apellido por defecto '-' en órdenes/borradores y se formatea el mensaje de error para evitar `[object Object]` | Usuario / Antigravity |
| 2026-10-20 | Aclaración interactiva de clientes no exactos | En audios transcritos (ej. "paulín") el bot no debe crear clientes a ciegas si existen clientes habituales similares | Se indexa la lista de clientes en memoria y si no hay coincidencia exacta (100%), se despliegan las 3 opciones más probables con sus pedidos + opción de nuevo cliente | Usuario / Antigravity |
| 2026-10-20 | Separación de Helados la paletea vs Cafe La Catalina | La regla general de cafetería/comidas causaba que "helado" se mapeara erróneamente a Cafe La Catalina | Se separa la regla en el prompt, se añade mapeo defensivo en código y se añade registro de respuestas en bot.log | Usuario / Antigravity |
| 2026-10-24 | Prevención de duplicación al aclarar cliente o corregir cantidad | Al escribir un nombre como "Liliana", el LLM hacía eco de los ítems existentes y se duplicaban; al decir "Solo 1", la IA volvía a agregar el ítem | Se interceptan correcciones de nombre en step 0b sin tocar ítems; se añade handler 0d para "solo X" y guardrail anti-eco en steps 5 y 6 | Usuario / Antigravity |
| 2026-10-24 | Estados de cuenta diarios por alumno en Supabase (H5) | Se requería un consolidado de pedidos y montos a pagar por cada alumno al cierre del día y bajo demanda | Creación de tablas `pf_daily_orders` y `pf_daily_order_items` en Supabase, sincronización automática con Shopify, detección NLP/comandos (/reporte) y cron diario | Usuario / Antigravity |
| 2026-10-24 | Eliminación de cierre automático programado | Clases en horarios dispares (unas terminan a mediodía, otras a las 9 PM); un cron fijo es ineficiente y ruidoso | Se retira el cron de envío automático; el estado de cuenta queda 100% bajo demanda (por voz/texto en Telegram con /reporte) y vía endpoint HTTP /api/reports/daily | Usuario |
| 2026-10-24 | Consumo individual por alumno con períodos flexibles (T-17) | Asesores necesitan consultar consumos de un alumno en específico ("dame el consumo de Caro Madrigal de esta semana") | Extracción de alumno y período (hoy por defecto, semana, mes, fecha), ranking multi-palabra en Shopify Customers (Caro Madrigal -> carolina madrigal) y sincronización por rango de fechas | Usuario / Antigravity |
| 2026-10-24 | Eliminación de reglas duras y migración a IA-First para intenciones (T-18) | Las compuertas rígidas de regex (`isDailyReportRequest`, etc.) fallaban ante modismos o abreviaturas ("detalle x cliente") | Se delega al 100% la clasificación de intenciones a `gpt-6-luna`, categorizando semánticamente si el mensaje es reporte general, consumo individual, toma de pedido, confirmación o cancelación | Usuario / Antigravity |
| 2026-10-25 | Manejo de mensajes largos (>4096 caracteres) en Telegram y contexto de reportes (T-19) | Reportes mensuales o consolidados extensos (ej. 30 alumnos, 68 pedidos en octubre) provocaban error 400 Bad Request en Telegram | Se implementa `replySafely` con chunking por bloques/alumnos, soporte para meses por nombre ("octubre"), y persistencia del período de reporte en sesión | Usuario / Antigravity |
| 2026-10-30 | H6 aprobado y reordenado: definir con EGM sin leer el código, luego comparar y decidir corregir o reiniciar | El usuario prefiere definir bien el proyecto; puede salir mejor reiniciar que retomar; no necesariamente construir con Antigravity | Se sustituye el orden previo (bootstrap primero). Se añade decisión corregir/reiniciar (T-25). Construcción prevista con el arnés de Claude Code | Usuario |
| 2026-10-30 | Producto a definir con EGM: chatbot de WhatsApp (Estudio Punto Fusión & Auri Alta Joyería); Telegram/Shopify queda fuera. Corrige la decisión previa del mismo día, que decía Telegram | El usuario aclaró que el producto a definir es el de WhatsApp | T-20 cerrada; el insumo del brainstorm sale del guion de WhatsApp. Este plan (Telegram) describe otro producto, que no se redefine. En T-24 se compara el código con el producto de WhatsApp | Usuario |
| 2026-10-30 | Confirmación previa antes de crear productos personalizados / fuera de catálogo y corrección de búsqueda (T-19b) | Incidentes en logs donde "hilo 1mm" o "piedras" no eran encontrados o eran creados como custom items sin consultar; guardrail anti-eco bloqueaba variantes adicionales del mismo producto (ej. esmeralda tras piedras 1.5mm) | NUNCA agregar productos personalizados automáticamente: preguntar al usuario con opciones difusas de inventario; corregir reglas de hilo 950 y piedras calibradas/esmeraldas en prompt; comparar variantes en anti-eco; soporte para 'quita X' | Usuario / Antigravity |

| 2026-10-30 | H6 cerrado con decisión de reiniciar; se abren los hitos W1–W6 del chatbot de WhatsApp | El usuario aprobó el brief y los hitos y pidió construir de cero, en local primero | Se cancelan T-22, T-23 y T-24. W1 pasa a ser el hito activo. El despliegue al VPS espera la URL que dará el usuario tras aprobar en local | Usuario |

## Próximo paso

1. W1: dashboard aprobado por el usuario en local (2026-10-31) y primer commit `89b5500` en `punto_fusion_agenda`, subido al repo privado https://github.com/aromeroconde/punto_fusion_agenda (rama `main`). Falta T-33 (despliegue) con la URL que dé el usuario.
2. W2: T-43 (agente conversacional) sobre el motor de T-42. Pedir al usuario el token del bot de Telegram nuevo (T-46) y crear la app de Meta cuando se pueda (T-47).
2. H5: commit, push y despliegue pendientes (R-04), independientes de W1.

