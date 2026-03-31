# Punto Fusión - Scope para Chatbot WhatsApp (n8n)

## Descripción General

Punto Fusión es un sistema de gestión para una academia de baile que incluye:
- **Base de datos**: Supabase (contactos, estudiantes, pagos, servicios)
- **Reservas**: Agendador (sistema de clases)
- **Facturación**: Alegra
- **MCP Server**: Servidor MCP (Model Context Protocol) para integración con chatbots

El chatbot se conectará a la API de Punto Fusión como "cerebro" para resolver consultas y acciones de clientes por WhatsApp.

---

## Servicios Desplegados

### API (Punto Fusión)
- **URL**: `https://puntofusion.smartnexo.com/api`
- **Estado**: ✅ Funcionando
- **Puerto**: 3100

### Web (Punto Fusión)
- **URL**: `https://puntofusion.smartnexo.com`
- **Estado**: ✅ Funcionando
- **Puerto**: 80

### MCP Server (Chatbot)
- **URL**: `https://mcp.puntofusion.smartnexo.com/mcp`
- **Estado**: ✅ Funcionando
- **Puerto**: 3200
- **Transporte**: HTTP (Streamable HTTP Transport)

---

## MCP Server - Para el Chatbot

El MCP server expone herramientas que el chatbot puede usar directamente. El chatbot (vía n8n) se conecta al MCP server y ejecuta las herramientas necesarias.

### Conexión desde n8n
```
URL: https://mcp.puntofusion.smartnexo.com/mcp
Método: POST
Content-Type: application/json
```

### Herramientas MCP Disponibles

| Herramienta | Descripción | Uso en Chatbot |
|-------------|-------------|----------------|
| `pf_health_check` | Verificar estado de la API | Diagnóstico |
| `pf_verify_contact_by_whatsapp` | Verificar si un teléfono existe | Primer contacto |
| `pf_check_student` | Verificar si es alumno activo | Autenticar usuario |
| `pf_create_student` | Crear nuevo alumno | Inscripción |
| `pf_get_student` | Obtener perfil del alumno | Consultar datos |
| `pf_get_student_bookings` | Obtener próximas clases | "¿Cuándo es mi próxima clase?" |
| `pf_check_reschedule_eligibility` | Verificar si puede reprogramar | "¿Puedo cambiar mi clase?" |
| `pf_reschedule_class` | Ejecutar reprogramación | "Mueve mi clase al martes" |
| `pf_sync_student_schedule` | Sincronizar horario fijo | Automatización mensual |
| `pf_get_available_slots` | Ver cupos disponibles | "¿Qué horarios hay?" |
| `pf_list_students` | Listar todos los alumnos | Consultas admin |
| `pf_list_scheduled_students` | Listar alumnos con horario | Automatización |
| `pf_list_payments` | Listar todos los pagos | Historial de pagos |
| `pf_get_payment` | Obtener detalle de pago | Consultar pago específico |
| `pf_list_services` | Listar servicios disponibles | "¿Qué clases ofrecen?" |
| `pf_list_invoices` | Listar facturas | Consultas de facturación |
| `pf_list_alegra_contacts` | Listar contactos de Alegra | Sistema de facturación |
| `pf_create_invoice` | Crear factura en Alegra | Generar facturas |

### Formato de Llamada MCP

Para ejecutar una herramienta MCP, n8n envía:

```json
POST https://mcp.puntofusion.smartnexo.com/mcp
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "pf_verify_contact_by_whatsapp",
    "arguments": {
      "whatsapp": "+573001234567"
    }
  }
}
```

Respuesta:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\"id\":\"...\",\"full_name\":\"...\",\"whatsapp\":\"...\"}"
      }
    ]
  }
}
```

---

## Endpoints Disponibles (API Directa)

Si el chatbot necesita llamar directamente a la API (sin MCP), estos son los endpoints:

### 1. Contactos
| Método | Endpoint | Descripción | Input | Output |
|--------|----------|-------------|-------|--------|
| POST | `/api/contacts/upsert` | Crear/actualizar contacto por WhatsApp | `{whatsapp, full_name?, city?, country?}` | Contacto creado/actualizado |
| GET | `/api/contacts` | Listar contactos (últimos 100) | - | Array de contactos |
| GET | `/api/contacts/:id` | Obtener contacto por ID | ID en URL | Datos del contacto |

### 2. Estudiantes
| Método | Endpoint | Descripción | Input | Output |
|--------|----------|-------------|-------|--------|
| POST | `/api/students/check` | Verificar si es alumno activo | `{whatsapp}` | `{is_student: boolean, contact: {...}, student: {...}}` |
| POST | `/api/students` | Crear nuevo alumno | `{full_name, whatsapp, email?, level?, ...}` | Alumno creado |
| GET | `/api/students` | Listar todos los alumnos | - | Array de alumnos |
| GET | `/api/students/:id` | Obtener datos de un alumno | ID en URL | Datos completos |
| PATCH | `/api/students/:id` | Actualizar datos del alumno | `{level?, group_schedule?, ...}` | Alumno actualizado |

### 3. Horarios y Reservas
| Método | Endpoint | Descripción | Input | Output |
|--------|----------|-------------|-------|--------|
| GET | `/api/students/:id/bookings` | Próximas clases del alumno | ID del estudiante | Array de reservas |
| GET | `/api/students/scheduled` | Alumnos con horario fijo | - | Array de alumnos |
| POST | `/api/students/:id/sync-schedule` | Sincronizar reservas del mes | ID del estudiante | `{created, skipped, ...}` |
| GET | `/api/students/:id/entitlements` | Elegibilidad para reprogramar | bookingId opcional | `{can_reschedule: boolean, ...}` |
| POST | `/api/students/:id/reschedule` | Reprogramar una clase | `{bookingIdToCancel, ...}` | `{booking, reschedules_used}` |
| GET | `/api/students/available_slots` | Cupos disponibles | eventTypeId, fechas | Array de horarios |

### 4. Pagos y Facturación
| Método | Endpoint | Descripción | Input | Output |
|--------|----------|-------------|-------|--------|
| GET | `/api/payments` | Listar pagos | - | Array de pagos |
| GET | `/api/payments/:id` | Ver detalle de pago | ID del pago | Datos del pago |
| GET | `/api/billing` | Ver facturas | - | Array de facturas |

### 5. Servicios
| Método | Endpoint | Descripción | Input | Output |
|--------|----------|-------------|-------|--------|
| GET | `/api/services` | Listar servicios disponibles | - | Array de servicios |

### 6. Alegra (Facturación)
| Método | Endpoint | Descripción | Input | Output |
|--------|----------|-------------|-------|--------|
| GET | `/api/alegra/contacts` | Contactos en Alegra | - | Contactos de Alegra |
| POST | `/api/alegra/invoices` | Crear factura | `{contactId, items[]}` | Factura creada |

### 7. Utilidades
| Método | Endpoint | Descripción | Output |
|--------|----------|-------------|--------|
| GET | `/api/health` | Verificar API | `{status: "ok"}` |
| GET | `/mcp/health` | Verificar MCP | `{status: "ok"}` |

---

## Base de Datos (Supabase)

### Tablas Principales

**pf_contacts** - Contactos/leads
- `id` (uuid)
- `full_name` (text)
- `whatsapp` (text, unique)
- `email` (text)
- `city` (text)
- `country` (text)
- `preferred_channel` (text)
- `created_at` (timestamp)

**pf_students** - Alumnos
- `id` (uuid)
- `contact_id` (uuid, FK a pf_contacts)
- `level` (text) - nivel de baile
- `group_schedule` (text) - formato "eventTypeId|scheduleId"
- `status` (text) - "activo", "inactivo", "graduado"
- `start_date` (timestamp)
- `notes` (text)
- `requires_invoice` (boolean)
- `reschedules_used` (integer) - reprogramaciones del mes
- `alegbra_contact_id` (text)
- `alegbra_item_reference` (text)

**pf_payments** - Pagos
- `id` (uuid)
- `student_id` (uuid, FK)
- `amount` (decimal)
- `date` (date)
- `status` (text)
- `invoice_id` (text)

---

## Reglas de Negocio

### Reprogramación de Clases
- **Límite**: 1 reprogramación por mes por estudiante
- **Anticipación**: Mínimo 48 horas antes de la clase
- **Verificación**: Consultar elegibilidad antes de procesar

### Alumnos Activos
- Un contacto se considera "alumno" si tiene registro en `pf_students` con `status = 'activo'`
- Para consultar, usar `pf_check_student` con el WhatsApp

### Horarios Fijos
- Los horarios se sincronizan con Agendador
- Formato del campo `group_schedule`: `eventTypeId|scheduleId`
- Ejemplo: "123|456" donde 123 = tipo de clase, 456 = horario específico

---

## Casos de Uso para el Chatbot

### 1. Verificar si es Cliente (Primer Contacto)
**Flujo MCP**: Usuario envía WhatsApp → Chatbot ejecuta `pf_verify_contact_by_whatsapp` → Retorna si es activo o no

### 2. Consultar Próxima Clase
**Flujo MCP**: Alumno consulta → Chatbot ejecuta `pf_get_student_bookings` → Muestra fecha/hora de próxima clase

### 3. Reprogramar Clase
**Flujo MCP**: Alumno pide cambiar → Chatbot ejecuta `pf_check_reschedule_eligibility` → Si eligible, ejecuta `pf_reschedule_class`

### 4. Inscribirse como Alumno
**Flujo MCP**: Nuevo contacto → Chatbot ejecuta `pf_create_student` → Se crea registro

### 5. Consultar Facturas/Pagos
**Flujo MCP**: Alumno consulta → Chatbot ejecuta `pf_list_payments` → Muestra historial de pagos

### 6. Ver Servicios Disponibles
**Flujo MCP**: Usuario pregunta por clases → Chatbot ejecuta `pf_list_services` → Lista opciones

### 7. Contacto Nuevo (Lead)
**Flujo MCP**: Usuario nuevo → Chatbot ejecuta `pf_verify_contact_by_whatsapp` → Guarda como lead

---

## Configuración del Chatbot

### Opción 1: Usar MCP Server (Recomendado)
```
URL MCP: https://mcp.puntofusion.smartnexo.com/mcp
Transporte: HTTP (Streamable HTTP)
```

### Opción 2: Usar API Directa
```
URL API: https://puntofusion.smartnexo.com/api
```

### Autenticación
Las llamadas no requieren autenticación. Para producción, considerar agregar API key.

### Formato de Respuestas
Todas las respuestas son JSON. Manejar errores con codes HTTP estándar (200, 400, 404, 500).

---

## Notas Técnicas

- **Puerto de la API**: 3100
- **Puerto del MCP**: 3200
- **Timeout recomendado**: 30 segundos para operaciones que consultan Agendador
- **Rate limiting**: No implementado actualmente
- **Webhooks**: No disponibles por ahora

---

## Ejemplo de Llamadas

### Via MCP Server
```json
POST https://mcp.puntofusion.smartnexo.com/mcp
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "pf_verify_contact_by_whatsapp",
    "arguments": {
      "whatsapp": "+573001234567"
    }
  }
}
```

### Via API Directa
```json
POST https://puntofusion.smartnexo.com/api/students/check
Body: {"whatsapp": "+573001234567"}
```

---

## Contacto
- **Desarrollador**: Punto Fusión API
- **Soporte técnico**: Consultar documentación de API interna
- **Repositorio**: https://github.com/aromeroconde/puntofusion