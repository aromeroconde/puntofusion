# Documentación Completa de la API de Agendador (v1)

Base URL de Producción: `https://agendador.smartnexo.com/api`

Esta API RESTful gestiona recursos, tipos de eventos, horarios semanales, organizaciones y reservas. Todas las respuestas están en formato JSON.

---

## 1. Organizations (Organizaciones)

Representa el negocio o ente principal.

*   `GET /organizations`: Obtiene todas las organizaciones.
*   `GET /organizations/:id`: Obtiene una organización específica por ID.
*   `POST /organizations`: Crea una organización.
    *   **Body**:
        ```json
        {
          "name": "Barbería Don Carlos",
          "slug": "barberia-don-carlos",
          "timezone": "America/Bogota"
        }
        ```
    > **Nota:** El campo `timezone` es **obligatorio** y debe ser un nombre IANA válido (ej: `"America/Bogota"`, `"America/Mexico_City"`, `"US/Eastern"`).

*   `PUT /organizations/:id`: Actualiza una organización.
    *   **Body**:
        ```json
        {
          "name": "Barbería Don Carlos",
          "slug": "barberia-don-carlos",
          "timezone": "America/Bogota"
        }
        ```
    > Si se incluye `timezone`, se valida que sea un nombre IANA válido.

*   `DELETE /organizations/:id`: Elimina una organización.

---

## 2. Resources (Recursos)

Representa al prestador del servicio (ej. Médicos, Abogados, Salas).

*   `GET /resources`: Obtiene todos los recursos. Se puede filtrar opcionalmente por query: `?organizationId=ID`
*   `GET /resources/:id`: Obtiene un recurso específico.
*   `POST /resources`: Crea un recurso.
    *   **Body**:
        ```json
        {
          "organizationId": "UUID-de-la-organizacion",
          "name": "Carlos Silva",
          "email": "carlos@barberia.com"
        }
        ```
*   `PUT /resources/:id`: Actualiza un recurso.
    *   **Body**:
        ```json
        {
          "name": "Carlos Silva",
          "email": "carlos@barberia.com"
        }
        ```
*   `DELETE /resources/:id`: Elimina un recurso permanentemente.

---

## 3. Event Types (Tipos de Eventos)

Define los servicios que el recurso ofrece (ej. Consulta General, Profilaxis).

*   `GET /event-types`: Obtiene todos los tipos de eventos. Filtro: `?resourceId=ID`
*   `GET /event-types/:id`: Obtiene uno específico.
*   `POST /event-types`: Crea un tipo de evento.
    *   **Body:**
        ```json
        {
          "resourceId": "UUID",
          "title": "Limpieza",
          "slug": "limpieza-dental",
          "duration": 30,
          "allowOverlap": false,
          "overlapMinutes": 0,
          "maxCapacity": 1
        }
        ```
*   `PUT /event-types/:id`: Actualiza un evento o lo apaga temporalmente.
    *   **Body:**
        ```json
        {
          "title": "Limpieza",
          "slug": "limpieza-dental",
          "duration": 30,
          "allowOverlap": false,
          "overlapMinutes": 0,
          "maxCapacity": 1,
          "isActive": true
        }
        ```
*   `DELETE /event-types/:id`: Elimina un tipo de evento.

---

## 4. Schedules (Horarios de Atención Semanal del Recurso)

Configura los rangos horarios disponibles **del recurso** por día de la semana. Define cuándo el recurso está disponible en general.

*   `GET /schedules`: Obtiene todos los horarios. Filtro: `?resourceId=ID`
*   `GET /schedules/:id`: Obtiene un registro de horario por su ID.
*   `POST /schedules`: Crea un fragmento de horario.
    *   **Body:**
        ```json
        {
          "resourceId": "UUID",
          "dayOfWeek": 1, 
          "startTime": "08:00",
          "endTime": "17:00"
        }
        ```
    > `dayOfWeek`: 0=Dom, 1=Lun, 2=Mar, 3=Mié, 4=Jue, 5=Vie, 6=Sáb

*   `PUT /schedules/:id`: Actualiza la hora de inicio o fin, o el día.
    *   **Body:**
        ```json
        {
          "dayOfWeek": 2,
          "startTime": "09:00",
          "endTime": "18:00"
        }
        ```
*   `DELETE /schedules/:id`: Elimina un bloque de horario.

---

## 4.1 Event Type Schedules (Horarios Específicos por Tipo de Evento)

Configura ventanas horarias **específicas para un tipo de evento**, dentro del horario del recurso. Permite que un servicio solo se ofrezca en ciertos bloques de tiempo, con soporte para múltiples bloques por día.

**Ejemplo:** El recurso trabaja de 08:00-17:00, pero "Capacitación" solo se ofrece:
- Lunes: 08:00-10:00 y 14:00-16:00 (2 registros)
- Miércoles: 15:00-17:00 (1 registro)

Si un tipo de evento **no tiene** horarios específicos, usa el horario completo del recurso (backward-compatible).

*   `GET /event-type-schedules`: Lista los horarios. Filtro: `?eventTypeId=ID`
*   `GET /event-type-schedules/:id`: Obtiene un registro específico.
*   `POST /event-type-schedules`: Crea un bloque de horario para un tipo de evento.
    *   **Body:**
        ```json
        {
          "eventTypeId": "UUID",
          "dayOfWeek": 1,
          "startTime": "08:00",
          "endTime": "10:00"
        }
        ```
    > Se pueden crear múltiples registros para el mismo día (ej: Lunes 08:00-10:00 + Lunes 14:00-16:00).
    > `startTime` debe ser anterior a `endTime`. Formato: `HH:mm`.
    > Devuelve error 409 si ya existe un horario para ese evento, día y hora de inicio.

*   `PUT /event-type-schedules/:id`: Actualiza un bloque de horario.
    *   **Body:**
        ```json
        {
          "dayOfWeek": 3,
          "startTime": "15:00",
          "endTime": "17:00"
        }
        ```
*   `DELETE /event-type-schedules/:id`: Elimina un bloque de horario.

---

## 5. Availability (Disponibilidad en Tiempo Real)

Calcula los espacios de tiempo disponibles intersectando:
1. **Horario del Recurso** (Schedule) — cuándo está disponible en general
2. **Horarios del Tipo de Evento** (EventTypeSchedule) — si tiene ventanas específicas
3. **Reservas existentes** (Bookings) — descarta tiempos ya ocupados
4. **Duración del servicio** — genera slots del tamaño correcto
5. **Capacidad máxima** — permite múltiples reservas simultáneas si `maxCapacity > 1`

*   `GET /availability?resourceId=UUID&eventTypeId=UUID&date=YYYY-MM-DD`
    *   **Respuesta**: `{ "slots": [...], "timezone": "America/Bogota" }`
    *   Si el `eventTypeId` tiene `isActive=false`, devuelve slots vacíos.
    *   Si el tipo de evento tiene horarios específicos, los slots se generan solo dentro de esas ventanas (intersectados con el horario del recurso).
    *   Si NO tiene horarios específicos, usa el horario completo del recurso.

---

## 6. Bookings (Reservas / Citas)

El almacenamiento final de un espacio bloqueado.

*   `GET /bookings`: Lista todas las reservas. Filtro: `?resourceId=ID&eventTypeId=ID`
*   `GET /bookings/:id`: Trae el detalle de una reserva específica.
*   `POST /bookings`: Efectúa una nueva reserva.
    *   **Body:**
        ```json
        {
          "resourceId": "UUID",
          "eventTypeId": "UUID",
          "startTime": "2026-03-02T08:00:00.000Z",
          "customerName": "Nombre Apellido",
          "customerEmail": "email@example.com",
          "customerPhone": "+573001234567",
          "notes": "Notas opcionales"
        }
        ```
    > `customerPhone` es obligatorio. `customerEmail` es opcional.
    > Si la capacidad máxima del tipo de evento ya está ocupada para ese horario, devuelve error 409.

*   `PUT /bookings/:id`: Reprograma la reserva cambiando su hora de inicio.
    *   **Body:**
        ```json
        {
          "newStartTime": "2026-03-02T09:00:00.000Z"
        }
        ```
*   `DELETE /bookings/:id`: Cancela una reserva (Soft-delete). Su estado cambia a `CANCELLED`, y ese slot volverá a aparecer en `/availability`.

---

## 7. URLs de Acceso a la Aplicación

La aplicación provee dos interfaces web principales (Client-Facing y Admin Panel), ambas dependientes del ID de la Organización para su correcto funcionamiento.

### Turnero Cliente (Client-Facing UI)
Esta es la URL pública que compartes con tus clientes para que agenden citas.
Doble acceso (producción):
- `https://agendador.smartnexo.com/?orgId=UUID_DE_LA_ORGANIZACION`

La vista detecta automáticamente la organización e inicia el flujo de selección (Especialista -> Evento -> Día/Hora).

### Panel de Administración (Backoffice)
Esta URL es secreta/privada para uso de los administradores y recepcionistas de la clínica para cancelar, re-agendar o visualizar todas las citas, así como para modificar los horarios y tipos de evento de sus profesionales.
- `https://agendador.smartnexo.com/admin.html?orgId=UUID_DE_LA_ORGANIZACION`

> **Nota de Seguridad Frontend**: Por simplicidad inicial, el panel de administración usa validación laxa por URL. Para ambientes de muy alta seguridad, cualquier acción destructiva (`DELETE / PUT`) sobre los endpoints en el backend requeriría de Bearer tokens.
