# Plan del proyecto: Punto Fusión - Asistente Telegram & Shopify

Creado: 2026-10-16
Última actualización: 2026-10-24
Última revisión: 2026-10-24
Zona horaria: America/Bogota (UTC-5)
Base de revisión: Implementación de tablas en Supabase para pedidos diarios de alumnos y motor de consolidación de estados de cuenta bajo demanda y programado.
Fuente canónica: PLAN_PROYECTO.md
Estado del plan: Hito H5 completado / En despliegue

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

Hito activo: H5 (Estados de Cuenta Diarios por Alumno y Persistencia en Supabase)

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

## Bloqueos y riesgos relevantes

| ID | Tarea o hito | Bloqueo o riesgo | Impacto | Resolución o mitigación | Responsable |
|---|---|---|---|---|---|
| R-01 | T-01 | Permisos restringidos en Shopify Admin | No se puede generar token privado | Resuelto: Client credentials grant activo | Antigravity |

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

## Próximo paso

Commit, push a GitHub y despliegue en producción en el VPS (`puntofusion_punto-fusion-api`). Monitoreo en vivo.

