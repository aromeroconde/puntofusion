# Asistente de WhatsApp para horarios y reposiciones, Estudio Punto Fusión

* **Author:** Alejandro Romero (aromeroconde)
* **Date:** 2026-10-30 (actualizado con las decisiones del dueño tras la revisión Goldfish)

## Overview

Hoy un solo número de WhatsApp Business recibe todo: novedades de alumnos, mensajes de grupos de clase, consultas de gente nueva y cotizaciones. El dueño contesta todo a mano. Lo que más tiempo le quita es organizar horarios, reposiciones y novedades.

El producto es un asistente de WhatsApp, **100% conversacional** (sin botones ni menús: todo es charla), que atiende ese trabajo:

1. Recibe las novedades de horario de los alumnos (cancelar una clase, ausencias, horas de taller sin asistencia, sesiones virtuales con el Maestro David).
2. Aplica las reglas de reposición y ofrece solo cupos reales de un calendario propio.
3. Reserva talleres asistidos ocasionales para no alumnos, con pago total por un enlace de WOP y confirmación humana.
4. Envía confirmaciones y recordatorios por WhatsApp.

Todo lo que no sea clases y novedades pasa a una persona. El bot no da precios de productos ni de servicios (por ejemplo, si preguntan cuánto vale un anillo). El monto del taller asistido sí se puede mostrar, porque es parte de la reserva.

**Usuario principal:** el dueño, que hoy arma las agendas a mano. **Beneficiarios:** los alumnos desde el día uno, y los no alumnos que quieren un taller asistido ocasional.

Este documento reemplaza el guion de marzo de 2026 como punto de partida. El guion era un árbol de botones que casi siempre terminaba en "un ejecutivo te contactará". El negocio es una escuela y taller de joyería; la mención a una "academia de baile" en los documentos de abril es un error y no debe usarse como fuente.

## Analysis

Seis revisores independientes (diseño, detalles técnicos, alcance, comprensión, preparación para implementar y estructura) revisaron el concepto y lo declararon no listo para construirse. El dueño respondió a sus hallazgos. Esta sección resume cada tema y su resolución. Los datos sobre Meta, la ley de datos personales de Costa Rica y los feriados vienen de conocimiento general de los revisores y hay que verificarlos en fuentes vigentes.

### Resuelto por el dueño

| Tema | Decisión |
|---|---|
| Precios | La prohibición aplica a precios de productos y servicios que el cliente consulte (por ejemplo "¿cuánto vale un anillo?"). No tiene relación con el taller asistido, cuyo monto forma parte de la reserva. |
| Pago | El pago del taller asistido es por enlace de WOP. Se mantiene así. |
| Estilo del bot | 100% conversacional. Sin botones, menús ni formularios. |
| Identidad | El número de teléfono es la identidad. Un número queda autorizado para actuar sobre uno o varios alumnos (por ejemplo, un padre por su hijo). El padrón vive en tablas de Supabase y lo mantiene el equipo. |
| Canal | API oficial de Meta, con coexistencia, y una línea de WhatsApp dedicada al bot. Se descarta la API no oficial. |
| Dueño y bot en el mismo chat | La coexistencia permite detectar cuándo escribe el dueño. El bot se apaga durante 15 minutos desde el último mensaje del dueño. Los mensajes del cliente que quedaron sin respuesta se guardan y el bot los atiende cuando se reactiva. |
| Calendario | Propio, en Supabase del VPS (disponible 24/7), con una API para que otros sistemas lo consulten. La garantía contra duplicados vive en la base de datos. Corre en Docker Swarm, con heartbeat y alertas. El dueño de la plataforma lo mantiene. |
| Qué es un espacio | Una clase tiene un cupo configurable (3, 5, 6, 7 alumnos…). Lo que no puede ocurrir es sobrepasar el cupo ni que una persona tenga dos clases el mismo día. Esas son reglas duras en la base de datos. |
| Quién mueve alumnos | Solo el dueño, desde un dashboard con el calendario. Nunca por chat. El dashboard permite cargar y modificar alumnos, grupos, horarios, cupos, nivel de cada alumno, feriados y cierres. |
| Feriados y cierres | Datos con vigencia que se configuran en el dashboard (feriados, vacaciones, cierres por obra de 8 o 15 días). No son lógica fija. No son críticos para arrancar. |
| Mensualidad | Es el mes calendario. |
| Estado de pago | El sistema debe tenerlo: es parte vital del seguimiento. Se guarda en tablas propias. |
| Aviso con menos de 48 horas | Se rechaza y la clase se da por tomada. |
| Reglas de uso | Se arranca con funcionalidad simple y se agregan restricciones después. Ejemplos del dueño: máximo de clases reservables por mes (por ejemplo 4) y una cancelación por mes. Estos valores deben ser configurables. |
| Recordatorios | Un día antes y una hora antes de cada clase recurrente. |
| Bot no entiende | Una o dos preguntas aclaratorias y luego traspaso a una persona con un resumen. |
| Avisos internos | Por Telegram: cuando una conversación requiere a una persona y cuando alguien paga por WOP. |
| Pago y cupo del taller asistido | Mientras alguien está en proceso de pago, el cupo se bloquea y no se envía el enlace a otra persona. Quien paga primero se queda con el cupo. Si dos pagan, al otro se le devuelve el dinero. El dueño confirma el pago desde Telegram (aceptar o rechazar), con una demora esperada de 10 a 15 minutos. Más adelante se evaluará un webhook o API de WOP. |
| Nivel avanzado | Lo define el dueño en el dashboard, no el alumno. |
| Éxito | Tener los dos primeros hitos funcionando. Ya no se mide por tiempo ahorrado. |
| Glosario | Se define durante el desarrollo (hay un borrador abajo). |
| Datos de salud y fotos | Se decidirán según la ley. Propuesta de los revisores: guardar solo "ausencia justificada" y fechas, sin diagnóstico ni documentos, y no enviar fotos al modelo. |
| Plazo de reposición | Una clase se puede reponer como máximo hasta el mes siguiente. |
| Acumulables | Las horas de taller sin asistencia y las sesiones virtuales no son acumulables. |
| Línea y coexistencia | La línea dedicada al bot se usa también desde la app de WhatsApp Business del dueño en el teléfono, en modo coexistencia. |
| Devolución al segundo pagador | Excepción explícita a "pagos no reembolsables": solo aplica si dos personas pagan el mismo cupo con una diferencia de tiempo tan corta que el bloqueo no alcanzó a detectarlo. |
| Alternativas | No quiere modo copiloto ni cambiar a otra forma de interacción en esta etapa. Sí quiere un turnero web autogestionable como segunda opción, después de que el bot maneje todo. |

### Riesgos que siguen vigentes (los revisores los señalaron, el dueño los aceptó o los pospuso)

- **Reglas en el prompt no son reglas duras.** Todo lo que el bot afirme sobre cupos, reglas y precios debe salir de datos y de la base de datos. El modelo solo interpreta la conversación y extrae intención y fechas. Nada se escribe en el calendario sin confirmación del alumno.
- **Mensajes atrasados.** Al reactivarse después de los 15 minutos, el bot responde mensajes que pueden estar desactualizados. Habrá que definir qué hace con mensajes viejos (por ejemplo, releer el contexto antes de contestar).
- **Recordatorios fuera de las 24 horas.** En la API oficial se envían con plantillas aprobadas por Meta y con costo (a verificar). El dueño ya conoce los costos.
- **El calendario es la fuente única de verdad.** Si el dueño mueve a un alumno por fuera del dashboard (por ejemplo, por chat o en el grupo de WhatsApp), el bot ofrecerá huecos falsos. La regla operativa es: todo cambio se hace en el dashboard.
- **Modo degradado.** Si el calendario cae, el bot no inventa cupos: lo dice y pasa a una persona.
- **Cuello de botella del pago.** Con confirmación manual, el dueño sigue aprobando pagos. Se acepta por ahora.
- **Verificar con asesoría legal** el tratamiento de datos personales, incluidos los de menores y salud.
- **Los grupos de WhatsApp de cada clase** quedan fuera del bot y los sigue manejando el dueño.

### Pendientes de definir (se resuelven por hito, punto a punto)

- **Efectos cruzados:** qué pasa con una reposición ya agendada cuando llega una ausencia, cuántas horas o sesiones corresponden por mensualidad, qué pasa si la ausencia cruza dos meses.
- **Ausencias de 3 a 7 semanas:** sin regla por ahora. Se agrega después.
- **Qué es WOP,** si SINPE se mantiene para las mensualidades, y si WOP ofrece API o webhook.
- **Qué hace el bot con un número desconocido.** Propuesta provisional: lo trata como no alumno, solo puede ofrecer el taller asistido y pasa todo lo demás a una persona.
- **Documentos de abril** con la descripción errónea: corregir o excluir de cualquier base de conocimiento del bot.

### Glosario (borrador)

- **Clase:** sesión recurrente de un grupo, con día, hora, duración y cupo máximo.
- **Cupo:** número máximo de alumnos de una clase. Es configurable por clase.
- **Plaza:** lugar de un alumno en una clase.
- **Reposición:** clase que un alumno toma en una fecha distinta a la suya, dentro del plazo de la regla.
- **Mensualidad:** pago por el mes calendario.
- **Taller asistido ocasional:** clase suelta para alumnos o no alumnos de nivel avanzado, con pago total previo.
- **Horas de taller sin asistencia:** uso del taller sin maestro, programado por el alumno.
- **Sesión virtual:** sesión con el Maestro David por videollamada.
- **Padrón:** tablas de alumnos, teléfonos autorizados, grupos, nivel y estado de pago.

## Goals vs. Non-Goals

* **In-Scope Goals:**
  * Asistente conversacional de WhatsApp (API oficial de Meta, coexistencia, línea dedicada) para novedades de horario y reposiciones de alumnos.
  * Calendario propio y dashboard de administración con garantía en la base de datos contra sobrecupo y doble clase el mismo día.
  * Padrón de alumnos con teléfonos autorizados y estado de pago.
  * Feriados y cierres configurables.
  * Recordatorios de un día y una hora antes de cada clase.
  * Taller asistido ocasional con pago por WOP y aprobación humana por Telegram.
  * Traspaso a una persona con aviso por Telegram, e interruptor global.
* **Out-of-Scope Non-Goals:**
  * Dar precios de productos o servicios.
  * Cotizaciones, experiencias, asesoría a joyeros, producción, compra y venta de metales, herramientas y piedras: pasan a una persona.
  * El asistente interno de Telegram y Shopify que ya existe.
  * Google Calendar y otros calendarios.
  * API no oficial de WhatsApp.
  * Botones, menús y formularios dentro del chat.
  * Los grupos de WhatsApp de cada clase.
  * Modo copiloto.
  * Mover alumnos por chat: solo desde el dashboard.

## Alternativas Weighed

| Alternativa | Resultado |
|---|---|
| Modo copiloto (el bot propone, el dueño aprueba cada cambio) | Rechazada: el dueño quiere una versión funcional desde el primer hito. |
| Número de WhatsApp separado para el bot | Aceptada: se usa una línea dedicada. |
| Menú por botones o formularios | Rechazada: el bot es 100% conversacional. |
| Página web para elegir cupo (turnero autogestionable) | Pospuesta: segunda opción, después de que el bot maneje todo. |
| Calendario como módulo de la misma aplicación | Rechazada: se quiere un servicio independiente consultable desde fuera. |
| Agendador de código abierto solo para cupos | Rechazada: el calendario es propio, con reglas propias. |
| Formulario más hoja de cálculo | Rechazada. |
| Solo recordatorios sin bot de cambios | Rechazada: no resuelve el dolor principal. |
| SINPE con foto de comprobante en lugar de WOP | Rechazada para el taller asistido. |
| Google Calendar como calendario o espejo | Rechazada: calendario propio. |
| API no oficial de WhatsApp | Rechazada: se usa la API oficial de Meta. |
| Confirmación de pago por webhook de WOP en lugar de aprobación humana | Pospuesta: se evalúa más adelante si WOP ofrece API o webhook. |
| Recortar la primera versión | Aceptada: el trabajo se divide en hitos entregables (ver abajo). |

## Key Decisions & Staging for Next Steps

### Hitos propuestos

La primera versión del concepto cubría demasiado. Se divide en hitos que se entregan y prueban uno por uno. **Criterio de éxito del proyecto: los hitos 1 y 2 funcionando.**

**Hito 1: Calendario y dashboard (sin bot).** La base de todo.
- Tablas en Supabase: alumnos, teléfonos autorizados por alumno, grupos y clases con cupo configurable, horarios recurrentes, mensualidades y estado de pago, reposiciones y novedades, feriados y cierres con vigencia.
- Reglas duras en la base de datos: no sobrepasar el cupo, y una persona no puede tener dos clases el mismo día.
- Dashboard para cargar y editar todo, y mover alumnos.
- API del calendario consultable desde fuera, con autenticación.
- Despliegue en Docker Swarm con heartbeat y alertas.
- Hecho cuando: el dueño carga sus grupos y alumnos reales y mueve un alumno desde el dashboard sin poder romper las reglas duras.

**Hito 2: Bot para alumnos, núcleo.** Cancelar una clase y reponerla.
- WhatsApp con API oficial de Meta, coexistencia y línea dedicada.
- Conversación 100% natural. Identificación por teléfono autorizado.
- Cancelación de una clase, con rechazo si faltan menos de 48 horas (la clase se da por tomada), y reposición con cupos reales según reglas simples y configurables (máximo de clases por mes, una cancelación por mes, reposición hasta el mes siguiente).
- Silencio del bot 15 minutos desde el último mensaje del dueño, y reproceso de mensajes pendientes.
- Traspaso a una persona con resumen, aviso por Telegram e interruptor global.
- Una o dos preguntas aclaratorias cuando no entiende, y luego traspaso.
- Hecho cuando: un alumno real cancela y repone por WhatsApp sin que el dueño intervenga, y el calendario queda consistente.

**Hito 3: Recordatorios y confirmaciones.**
- Mensajes un día antes y una hora antes de cada clase recurrente, con plantillas aprobadas de Meta.
- Confirmación al alumno de cada cambio registrado.
- Los feriados y cierres cargados evitan recordatorios de clases que no se dictan.

**Hito 4: Ausencias, taller sin asistencia, sesiones virtuales y estado de pago.**
- Ausencia de 2 semanas, de hasta 2 meses y por salud.
- Horas de taller sin asistencia y sesiones virtuales con el Maestro David.
- Seguimiento del estado de pago y reglas asociadas (por ejemplo, el 50% durante la ausencia).
- Aquí se definen los efectos cruzados y el significado de "acumulable".

**Hito 5: Taller asistido ocasional para no alumnos.**
- Búsqueda de espacios, bloqueo del cupo mientras la persona paga, enlace de WOP, aviso por Telegram con aceptar o rechazar, y devolución al segundo pagador.
- Nivel avanzado definido por el dueño en el dashboard.

**Hito 6: Endurecimiento y extras.**
- Tratamiento de datos personales con asesoría legal, retención de datos y topes de gasto por conversación.
- Manejo de números desconocidos y mensajes atrasados.
- Turnero web autogestionable como segunda opción.
- Revisión de los nodos del guion que quedaron fuera (lista de espera de principiantes, alquiler de taller, experiencias): se decide si el bot los atiende o siguen en manos de una persona.
- Medida de éxito y línea base de tiempos, si el dueño la quiere.

### Siguiente paso

Ejecutar `/egm-draft` para el **Hito 1**, con las decisiones de este documento, y pedir al dueño los datos para cargarlo: grupos, cupos, horarios recurrentes, alumnos con sus teléfonos autorizados y estado de pago actual.
