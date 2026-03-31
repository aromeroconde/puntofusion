# Punto Fusión - Scope para Chatbot WhatsApp (n8n)

## Descripción General

Punto Fusión es un sistema de gestión para una academia de baile que incluye:
- **Base de datos**: Supabase (contactos, estudiantes, pagos, servicios)
- **Reservas**: Agendador (sistema de clases)
- **Facturación**: Alegra

El chatbot se conectará a la API de Punto Fusión como "cerebro" para resolver consultas y acciones de clientes por WhatsApp.

---

## Endpoints Disponibles

### 1. Contactos
**Gestión de contactos (prospectos, leads, clientes)**

| Método | Endpoint | Descripción | Input | Output |
|--------|----------|-------------|-------|--------|
| POST | `/api/contacts/upsert` | Crear/actualizar contacto por WhatsApp | `{whatsapp, full_name?, city?, country?}` | Contacto creado/actualizado |
| GET | `/api/contacts` | Listar contactos (últimos 100) | - | Array de contactos |
| GET | `/api/contacts/:id` | Obtener contacto por ID | ID en URL | Datos del contacto |

---

### 2. Estudiantes (Alumnos)
**Gestión de estudiantes activos**

| Método | Endpoint | Descripción | Input | Output |
|--------|----------|-------------|-------|--------|
| POST | `/api/students/check` | Verificar si alguien es alumno activo | `{whatsapp}` | `{is_student: boolean, contact: {...}, student: {...}}` |
| POST | `/api/students` | Crear nuevo alumno (matricular) | `{full_name, whatsapp, email?, level?, group_schedule?, status?, start_date?, notes?, requires_invoice?}` | Alumno creado |
| GET | `/api/students` | Listar todos los alumnos | - | Array de alumnos |
| GET | `/api/students/:id` | Obtener datos de un alumno | ID en URL | Datos completos del alumno |
| PATCH | `/api/students/:id` | Actualizar datos del alumno | `{level?, group_schedule?, status?, notes?, requires_invoice?}` | Alumno actualizado |

---

### 3. Horarios y Reservas
**Sincronización con Agendador**

| Método | Endpoint | Descripción | Input | Output |
|--------|----------|-------------|-------|--------|
| GET | `/api/students/:id/bookings` | Ver próximas clases del alumno | ID del estudiante | Array de reservas futuras |
| GET | `/api/students/scheduled` | Listar alumnos con horario fijo | - | Array de alumnos programados |
| POST | `/api/students/:id/sync-schedule` | Sincronizar reservas del mes | ID del estudiante | `{created, skipped, total_dates, errors}` |
| GET | `/api/students/:id/entitlements?bookingId=` | Consultar elegibilidad para reprogramar | bookingId opcional | `{can_reschedule: boolean, reason, message}` |
| POST | `/api/students/:id/reschedule` | Reprogramar una clase | `{bookingIdToCancel, newEventTypeId, newStartTime}` | `{booking, reschedules_used}` |
| GET | `/api/students/available_slots?eventTypeId=&startDate=&endDate=` | Ver cupos disponibles | eventTypeId, fechas | Array de horarios disponibles |

---

### 4. Pagos y Facturación
**Gestión de pagos y faktur"""

| Método | Endpoint | Descripción | Input | Output |
|--------|----------|-------------|-------|--------|
| GET | `/api/payments` | Listar pagos | - | Array de pagos |
| GET | `/api/payments/:id` | Ver detalle de un pago | ID del pago | Datos del pago |
| GET | `/api/billing` | Ver facturas | - | Array de facturas |

---

### 5. Servicios
**Clases extras, paquetes, membresías**

| Método | Endpoint | Descripción | Input | Output |
|--------|----------|-------------|-------|--------|
| GET | `/api/services` | Listar servicios disponibles | - | Array de servicios |

---

### 6. Alegra (Facturación)
**Integración con sistema de facturación**

| Método | Endpoint | Descripción | Input | Output |
|--------|----------|-------------|-------|--------|
| GET | `/api/alegra/contacts` | Listar contactos en Alegra | - | Contactos de Alegra |
| POST | `/api/alegra/invoices` | Crear factura | `{contactId, items[], concept?}` | Factura creada |

---

### 7. Utilidades

| Método | Endpoint | Descripción | Output |
|--------|----------|-------------|--------|
| GET | `/api/health` | Verificar que la API está funcionando | `{status: "ok"}` |
| GET | `/health` | Health check alternativo | `{status: "ok"}` |

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
- Para consultar, usar `POST /api/students/check` con el WhatsApp

### Horarios Fijos
- Los horarios se sincronizan con Agendador
- Formato del campo `group_schedule`: `eventTypeId|scheduleId`
- Ejemplo: "123|456" donde 123 = tipo de clase, 456 = horario específico

---

## Casos de Uso para el Chatbot

### 1. Verificar si es Cliente
**Flujo**: Usuario envía WhatsApp → Chatbot consulta `/api/students/check` → Retorna si es activo o no

### 2. Consultar Próxima Clase
**Flujo**: Alumno consulta → Chatbot llama `/api/students/:id/bookings` → Muestra fecha/hora de próxima clase

### 3. Reprogramar Clase
**Flujo**: Alumno pide cambiar → Chatbot verifica elegibilidad (`/api/students/:id/entitlements`) → Si eligible, procesa `/api/students/:id/reschedule`

### 4. Inscribirse como Alumno
**Flujo**: Nuevo contacto → Chatbot llama `/api/students` con datos → Se crea registro

### 5. Consultar Facturas/Pagos
**Flujo**: Alumno consulta → Chatbot llama `/api/payments` → Muestra historial de pagos

### 6. Ver Servicios Disponibles
**Flujo**: Usuario pregunta por clases extra → Chatbot llama `/api/services` → Lista opciones

### 7. Contacto Nuevo (Lead)
**Flujo**: Usuario nuevo → Chatbot registra en `/api/contacts/upsert` → Guarda como lead

---

## Configuración del Chatbot

### URL Base
```
https://puntofusion.smartnexo.com/api
```

### Autenticación
Las llamadas no requieren autenticación (API pública dentro de la red interna). Para producción, considerar agregar API key.

### Formato de Respuestas
Todas las respuestas son JSON. Manejar errores con codes HTTP estándar (200, 400, 404, 500).

---

## Notas Técnicas

- **Puerto de la API**: 3100
- **Timeout recomendado**: 30 segundos para operaciones que consultan Agendador
- **Rate limiting**: No implementado actualmente
- **Webhooks**: No disponibles por ahora

---

## Ejemplo de Llamadas desde n8n

### Verificar Alumno
```json
POST https://puntofusion.smartnexo.com/api/students/check
Body: {"whatsapp": "+573001234567"}
```

### Obtener Próximas Clases
```json
GET https://puntofusion.smartnexo.com/api/students/UUID-ESTUDIANTE/bookings
```

### Reprogramar
```json
POST https://puntofusion.smartnexo.com/api/students/UUID-ESTUDIANTE/reschedule
Body: {
  "bookingIdToCancel": "UUID-RESERVA",
  "newEventTypeId": "UUID-NUEVA-CLASE",
  "newStartTime": "2026-04-15T14:00:00"
}
```

---

## Contacto
- **Desarrollador**: Punto Fusión API
- **Soporte técnico**: Consultar documentación de API interna