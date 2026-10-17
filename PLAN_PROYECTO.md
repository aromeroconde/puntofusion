# Plan del proyecto: Punto Fusión - Asistente Telegram & Shopify

Creado: 2026-10-16
Última actualización: 2026-10-16
Última revisión: 2026-10-16
Zona horaria: America/Bogota (UTC-5)
Base de revisión: Repositorio punto_fusion, Telegram Bot Token recibido y guardado en .env; en proceso de obtención de credenciales Shopify Admin.
Fuente canónica: PLAN_PROYECTO.md
Estado del plan: Propuesto / en ejecución inicial

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

Hito activo: Operación y Soporte

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

## Próximo paso

El equipo comercial prueba el bot en @PuntoFusionShopBot enviando audios o textos libres con pedidos simples, combinados o ambiguos.

