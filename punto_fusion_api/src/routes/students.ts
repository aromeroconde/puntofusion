import { Router } from 'express';
import { supabase } from '../supabase.js';
import { agendador } from '../agendador.js';
import { eachDayOfInterval, parseISO, format } from 'date-fns';

const router = Router();

// ─── Verificar si un usuario es alumno (por WhatsApp) ───
// POST /api/students/check
router.post('/check', async (req, res) => {
    try {
        const { whatsapp } = req.body as { whatsapp?: string };
        if (!whatsapp) {
            res.status(400).json({ error: 'Se requiere el campo "whatsapp".' });
            return;
        }

        // Buscar contacto por WhatsApp
        const { data: contact, error: contactError } = await supabase
            .from('pf_contacts')
            .select('id, full_name, whatsapp, city, country')
            .eq('whatsapp', whatsapp)
            .maybeSingle();

        if (contactError) throw contactError;

        if (!contact) {
            res.json({ is_student: false, contact: null, student: null });
            return;
        }

        // Buscar si tiene perfil de alumno activo
        const { data: student, error: studentError } = await supabase
            .from('pf_students')
            .select('id, level, group_schedule, status')
            .eq('contact_id', contact.id)
            .eq('status', 'activo')
            .maybeSingle();

        if (studentError) throw studentError;

        res.json({
            is_student: !!student,
            contact,
            student,
        });
    } catch (err) {
        console.error('Error en /students/check:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// ─── Crear nuevo alumno ─────────────────────────────────
// POST /api/students
// Acepta contact_id directo O full_name + whatsapp para crear contacto on-the-fly
router.post('/', async (req, res) => {
    try {
        const {
            contact_id, full_name, whatsapp, email,
            level,
            group_schedule,
            status,
            start_date,
            notes,
            requires_invoice,
            alegra_contact_id,
            alegra_item_reference
        } = req.body as {
            contact_id?: string;
            full_name?: string;
            whatsapp?: string;
            email?: string;
            level?: string;
            group_schedule?: string;
            status?: string;
            start_date?: string;
            notes?: string;
            requires_invoice?: boolean;
            alegra_contact_id?: string;
            alegra_item_reference?: string;
        };

        let resolvedContactId = contact_id;

        if (!resolvedContactId) {
            if (!full_name || !whatsapp) {
                res.status(400).json({ error: 'Se requiere "contact_id" o "full_name" + "whatsapp".' });
                return;
            }

            // Buscar contacto existente por whatsapp
            const { data: existing } = await supabase
                .from('pf_contacts')
                .select('id')
                .eq('whatsapp', whatsapp)
                .maybeSingle();

            if (existing) {
                resolvedContactId = existing.id;
            } else {
                const contactInsert: Record<string, unknown> = { full_name, whatsapp };
                if (email) contactInsert['email'] = email;
                const { data: newContact, error: contactErr } = await supabase
                    .from('pf_contacts')
                    .insert(contactInsert)
                    .select('id')
                    .single();
                if (contactErr) throw contactErr;
                resolvedContactId = newContact.id;
            }
        } else {
            // Verificar si el contacto existe
            const { data: contact, error: contactError } = await supabase
                .from('pf_contacts')
                .select('id')
                .eq('id', resolvedContactId)
                .maybeSingle();

            if (contactError) throw contactError;
            if (!contact) {
                res.status(404).json({ error: 'Contacto no encontrado.' });
                return;
            }
        }

        // Crear el registro en pf_students
        const { data: student, error: studentError } = await supabase
            .from('pf_students')
            .insert({
                contact_id: resolvedContactId,
                level: level || null,
                group_schedule: group_schedule || null,
                status: status || 'activo',
                start_date: start_date ? new Date(start_date).toISOString() : new Date().toISOString(),
                notes: notes || null,
                requires_invoice: requires_invoice !== undefined ? requires_invoice : false,
                alegra_contact_id: alegra_contact_id || null,
                alegra_item_reference: alegra_item_reference || null
            })
            .select('*, contact:pf_contacts(*)')
            .single();

        if (studentError) throw studentError;

        res.status(201).json(student);
    } catch (err) {
        console.error('Error en POST /students:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// ─── Listar alumnos ─────────────────────────────────────
router.get('/', async (_req, res) => {
    try {
        const { data, error } = await supabase
            .from('pf_students')
            .select('*, contact:pf_contacts(*)')
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error('Error en GET /students:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// ─── Obtener alumnos con horario fijo para la automatización n8n ────
// GET /api/students/scheduled
router.get('/scheduled', async (_req, res) => {
    try {
        // 1. Obtener todos los alumnos activos que tengan un horario asignado
        const { data: students, error } = await supabase
            .from('pf_students')
            .select('*, contact:pf_contacts(*)')
            .eq('status', 'activo')
            .not('group_schedule', 'is', null);

        if (error) throw error;

        const scheduledStudents = (students || []).filter(s =>
            s.group_schedule && (s.group_schedule as string).includes('|')
        );

        if (scheduledStudents.length === 0) {
            res.json([]);
            return;
        }

        // 2. Obtener la metadata de EventTypes y Schedules de Agendador
        const [eventTypesRes, schedulesRes] = await Promise.all([
            agendador.get('/event-types').catch(() => ({ data: [] })),
            agendador.get('/event-type-schedules').catch(() => ({ data: [] })),
        ]);

        const eventTypes = eventTypesRes.data || [];
        const schedules = schedulesRes.data || [];

        // Nombres de los días (cero inicial = Domingo)
        const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

        // 3. Mapear y enriquecer los datos
        const enriched = scheduledStudents.map(student => {
            const parts = (student.group_schedule as string).split('|');
            const eventTypeId = parts[0];
            const scheduleId = parts[1];

            const et = eventTypes.find((e: any) => e.id === eventTypeId);
            const sch = schedules.find((s: any) => s.id === scheduleId);

            return {
                student_id: student.id,
                level: student.level,
                contact_name: student.contact?.full_name || '',
                contact_whatsapp: student.contact?.whatsapp || '',
                class_name: et ? et.title : 'Clase Desconocida',
                class_day: sch && sch.dayOfWeek !== undefined ? DAY_NAMES[sch.dayOfWeek] : 'Día Desconocido',
                class_time: sch ? sch.startTime : 'Hora Desconocida',
                group_schedule: student.group_schedule
            };
        });

        res.json(enriched);

    } catch (err: any) {
        console.error('Error en GET /students/scheduled:', err?.response?.data || err.message);
        res.status(500).json({ error: 'Error al obtener alumnos programados.' });
    }
});

// ─── Listar cupos disponibles (Proxy Agregador) ────────────
// GET /api/students/available_slots
router.get('/available_slots', async (req, res) => {
    try {
        const { eventTypeId, startDate, endDate } = req.query as { eventTypeId?: string; startDate?: string; endDate?: string };

        if (!eventTypeId || !startDate || !endDate) {
            res.status(400).json({ error: 'Faltan parámetros obligatorios: eventTypeId, startDate, endDate.' });
            return;
        }

        // 1. Obtener el resourceId asociado al eventType
        const { data: eventType } = await agendador.get(`/event-types/${eventTypeId}`);
        const resourceId = eventType.resourceId;

        if (!resourceId) {
            res.status(404).json({ error: 'No se encontró el recurso asociado al tipo de evento en el Agendador.' });
            return;
        }

        // 2. Generar el listado de fechas en el rango (usando date-fns)
        const days = eachDayOfInterval({
            start: parseISO(startDate),
            end: parseISO(endDate)
        });

        // 3. Consultar disponibilidad día por día
        const availabilityPromises = days.map(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            return agendador.get('/availability', {
                params: { resourceId, eventTypeId, date: dateStr }
            }).catch(err => {
                console.error(`Error consultando disponibilidad para ${dateStr}:`, err.message);
                return { data: { slots: [] } }; // Fallback silencioso por día
            });
        });

        const responses = await Promise.all(availabilityPromises);

        // 4. Consolidar resultados
        const allSlots = responses.flatMap(r => r.data.slots || []);

        // El MCP server espera un array de objetos con startTime, endTime y disponible=true (ya que el agendador solo devuelve libres)
        const formattedSlots = allSlots.map((s: any) => ({
            startTime: s.startTime,
            endTime: s.endTime,
            available: true
        }));

        res.json(formattedSlots);

    } catch (err: any) {
        console.error('Error en GET /students/available_slots:', err?.response?.data || err.message);
        res.status(500).json({ error: 'Error al procesar la disponibilidad en el Agendador.' });
    }
});

// ─── Obtener alumno por ID ──────────────────────────────
router.get('/:id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('pf_students')
            .select('*, contact:pf_contacts(*)')
            .eq('id', req.params['id'])
            .maybeSingle();

        if (error) throw error;
        if (!data) {
            res.status(404).json({ error: 'Alumno no encontrado.' });
            return;
        }
        res.json(data);
    } catch (err) {
        console.error('Error en GET /students/:id:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// ─── Actualizar alumno ──────────────────────────────────
router.patch('/:id', async (req, res) => {
    try {
        const { level, group_schedule, status, notes, requires_invoice, alegra_contact_id, alegra_item_reference } = req.body as {
            level?: string;
            group_schedule?: string | null;
            status?: string;
            notes?: string;
            requires_invoice?: boolean;
            alegra_contact_id?: string | null;
            alegra_item_reference?: string | null;
        };

        const updateData: Record<string, unknown> = {};
        if (level !== undefined) updateData['level'] = level;
        if (group_schedule !== undefined) updateData['group_schedule'] = group_schedule;
        if (status !== undefined) updateData['status'] = status;
        if (notes !== undefined) updateData['notes'] = notes;
        if (requires_invoice !== undefined) updateData['requires_invoice'] = requires_invoice;
        if (alegra_contact_id !== undefined) updateData['alegra_contact_id'] = alegra_contact_id;
        if (alegra_item_reference !== undefined) updateData['alegra_item_reference'] = alegra_item_reference;

        if (Object.keys(updateData).length === 0) {
            res.status(400).json({ error: 'No se enviaron campos para actualizar.' });
            return;
        }

        const { data, error } = await supabase
            .from('pf_students')
            .update(updateData)
            .eq('id', req.params['id'])
            .select('*, contact:pf_contacts(*)')
            .single();

        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error('Error en PATCH /students/:id:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// ─── Sincronizar horario fijo del alumno → Agendador ────
// POST /api/students/:id/sync-schedule
// Crea las reservas del mes en curso (o del próximo si se pasa ?month=next)
router.post('/:id/sync-schedule', async (req, res) => {
    try {
        const studentId = req.params['id'];
        const monthParam = (req.query['month'] as string) || 'current';

        // 1) Obtener alumno con su contacto
        const { data: student, error: stuErr } = await supabase
            .from('pf_students')
            .select('*, contact:pf_contacts(*)')
            .eq('id', studentId)
            .single();

        if (stuErr || !student) {
            res.status(404).json({ error: 'Alumno no encontrado.' });
            return;
        }

        if (!student.group_schedule) {
            res.status(400).json({ error: 'El alumno no tiene una clase/horario asignado.' });
            return;
        }

        // 2) Parsear group_schedule → "eventTypeId|scheduleId"
        const parts = (student.group_schedule as string).split('|');
        const eventTypeId = parts[0];
        const scheduleId = parts[1];

        if (!eventTypeId || !scheduleId) {
            res.status(400).json({ error: 'El campo group_schedule debe tener formato eventTypeId|scheduleId.' });
            return;
        }

        // 3) Obtener datos del EventType (para resourceId) y del Schedule (para dayOfWeek y startTime)
        const [eventTypeRes, scheduleRes] = await Promise.all([
            agendador.get(`/event-types/${eventTypeId}`),
            agendador.get(`/event-type-schedules/${scheduleId}`),
        ]);

        const eventType = eventTypeRes.data;
        const schedule = scheduleRes.data;

        if (!eventType || !schedule) {
            res.status(404).json({ error: 'EventType o Schedule no encontrado en el Agendador.' });
            return;
        }

        const resourceId = eventType.resourceId;
        const dayOfWeek = schedule.dayOfWeek; // 0=Dom, 1=Lun, ..., 6=Sáb
        const startTime = schedule.startTime; // "09:00"

        // 4) Calcular las fechas del mes que corresponden al dayOfWeek
        const now = new Date();
        let year: number, month: number; // month = 0-indexed

        if (monthParam === 'next') {
            // Próximo mes
            month = now.getMonth() + 1;
            year = now.getFullYear();
            if (month > 11) { month = 0; year++; }
        } else {
            // Mes actual
            month = now.getMonth();
            year = now.getFullYear();
        }

        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const datesInMonth: string[] = [];

        // Iterar por todos los días del mes
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            if (date.getDay() === dayOfWeek) {
                // Solo incluir fechas futuras (desde hoy en adelante)
                if (date >= today) {
                    // Formato YYYY-MM-DDTHH:mm:00 (hora local Colombia)
                    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T${startTime}:00`;
                    datesInMonth.push(dateStr);
                }
            }
        }

        if (datesInMonth.length === 0) {
            res.json({ message: 'No hay fechas pendientes para este mes.', created: 0, skipped: 0, errors: [] });
            return;
        }

        // 5) Obtener reservas existentes para evitar duplicados
        const existingBookingsRes = await agendador.get('/bookings', {
            params: { resourceId }
        });
        const existingBookings = existingBookingsRes.data || [];

        // Nombres del alumno para la reserva
        const customerName = student.contact?.full_name || 'Alumno';
        const customerEmail = student.contact?.email || '';
        const customerPhone = student.contact?.whatsapp || '';

        // 6) Crear reservas para cada fecha
        let created = 0;
        let skipped = 0;
        const errors: string[] = [];

        for (const startTimeISO of datesInMonth) {
            // Verificar si ya existe una reserva para este alumno en esta fecha/hora/eventType
            const alreadyExists = existingBookings.some((b: any) => {
                if (b.eventTypeId !== eventTypeId) return false;
                if (b.status === 'CANCELLED') return false;
                if (b.customerPhone !== customerPhone && b.customerName !== customerName) return false;
                // Comparar la fecha (YYYY-MM-DD)
                const existingDate = b.startTime.substring(0, 10);
                const newDate = startTimeISO.substring(0, 10);
                return existingDate === newDate;
            });

            if (alreadyExists) {
                skipped++;
                continue;
            }

            try {
                await agendador.post('/bookings', {
                    resourceId,
                    eventTypeId,
                    startTime: startTimeISO,
                    customerName,
                    customerEmail,
                    customerPhone,
                    notes: `Reserva automática — Clase fija sincronizada desde Punto Fusión`,
                });
                created++;
            } catch (bookErr: any) {
                const msg = bookErr?.response?.data?.error || bookErr.message;
                errors.push(`${startTimeISO}: ${msg}`);
            }
        }

        // 7) Reiniciar contador de reprogramaciones a 0
        await supabase
            .from('pf_students')
            .update({ reschedules_used: 0 })
            .eq('id', studentId);

        res.json({
            message: `Sincronización completada para ${customerName}.`,
            created,
            skipped,
            total_dates: datesInMonth.length,
            errors,
        });
    } catch (err: any) {
        console.error('Error en POST /students/:id/sync-schedule:', err?.response?.data || err.message);
        res.status(500).json({ error: 'Error interno al sincronizar horario.' });
    }
});

// ─── Consultar elegibilidad para reprogramar ────────────
// GET /api/students/:id/entitlements?bookingId=...
router.get('/:id/entitlements', async (req, res) => {
    try {
        const studentId = req.params['id'];
        const bookingId = req.query['bookingId'] as string | undefined;

        // 1. Obtener alumno
        const { data: student, error: stuErr } = await supabase
            .from('pf_students')
            .select('reschedules_used, level, status')
            .eq('id', studentId)
            .single();

        if (stuErr || !student) {
            res.status(404).json({ error: 'Alumno no encontrado.' });
            return;
        }

        if (student.status !== 'activo') {
            res.json({ can_reschedule: false, reason: 'student_inactive', message: 'El alumno no está activo.' });
            return;
        }

        // 2. Verificar límite (1 al mes)
        if (student.reschedules_used >= 1) {
            res.json({ can_reschedule: false, reason: 'limit_reached', message: 'Ya utilizaste tu único cambio permitido para este mes.' });
            return;
        }

        // 3. Verificar regla de las 48 horas (si se pasó un bookingId)
        if (bookingId) {
            try {
                // El agendador podría no devolver array en /bookings?id= sino devolver 200 array o 404, por seguridad iteramos si es array.
                const bookingRes = await agendador.get(`/bookings`, { params: { id: bookingId } });
                const bookings = Array.isArray(bookingRes.data) ? bookingRes.data : [];
                const booking = bookings.find((b: any) => b.id === bookingId);

                if (!booking) {
                    res.status(404).json({ error: 'Reserva no encontrada en el Agendador.' });
                    return;
                }

                if (booking.status === 'CANCELLED') {
                    res.json({ can_reschedule: false, reason: 'already_cancelled', message: 'Esta clase ya está cancelada.' });
                    return;
                }

                // Calcular diferencia de horas
                const startTime = new Date(booking.startTime);
                const now = new Date();
                const diffHours = (startTime.getTime() - now.getTime()) / (1000 * 60 * 60);

                if (diffHours < 48) {
                    res.json({
                        can_reschedule: false,
                        reason: 'time_limit',
                        message: `Debes avisar con al menos 48 horas de anticipación. Faltan ${Math.floor(diffHours)} horas para la clase.`,
                        startTime: booking.startTime
                    });
                    return;
                }

            } catch (err) {
                console.error('Error al obtener la reserva desde Agendador:', err);
                res.status(500).json({ error: 'Error al contactar al Agendador para verificar la reserva.' });
                return;
            }
        }

        // Si pasa todas las validaciones
        res.json({ can_reschedule: true, reason: 'eligible', remaining: 1 - student.reschedules_used });
    } catch (err) {
        console.error('Error en GET /students/:id/entitlements:', err);
        res.status(500).json({ error: 'Error interno al consultar elegibilidad.' });
    }
});

// ─── Ejecutar Reprogramación / Anticipación ─────────────
// POST /api/students/:id/reschedule
// Body esperado: { bookingIdToCancel: "uuid", newEventTypeId: "uuid", newStartTime: "YYYY-MM-DDTHH:mm:00" }
router.post('/:id/reschedule', async (req, res) => {
    try {
        const studentId = req.params['id'];
        const { bookingIdToCancel, newEventTypeId, newStartTime } = req.body;

        if (!bookingIdToCancel || !newEventTypeId || !newStartTime) {
            res.status(400).json({ error: 'Faltan campos obligatorios: bookingIdToCancel, newEventTypeId, newStartTime' });
            return;
        }

        // 1. Obtener alumno para sacar data de contacto y validar límite
        const { data: student, error: stuErr } = await supabase
            .from('pf_students')
            .select('*, contact:pf_contacts(*)')
            .eq('id', studentId)
            .single();

        if (stuErr || !student) {
            res.status(404).json({ error: 'Alumno no encontrado.' });
            return;
        }

        if (student.reschedules_used >= 1) {
            res.status(403).json({ error: 'Límite de reprogramaciones mensuales alcanzado (1).' });
            return;
        }

        // 2. Obtener datos de la reserva original (para copiar info y cancelarla luego)
        let originalBooking;
        let eventType;
        try {
            const [booksRes, evTypesRes] = await Promise.all([
                agendador.get('/bookings', { params: { id: bookingIdToCancel } }),
                agendador.get(`/event-types/${newEventTypeId}`)
            ]);

            const bookingsList = Array.isArray(booksRes.data) ? booksRes.data : [];
            originalBooking = bookingsList.find((b: any) => b.id === bookingIdToCancel);
            eventType = evTypesRes.data;

            if (!originalBooking || !eventType) throw new Error('Booking o EventType no encontrado');
        } catch (err) {
            res.status(404).json({ error: 'La reserva original o el nuevo tipo de evento no existen en el Agendador.' });
            return;
        }

        if (originalBooking.status === 'CANCELLED') {
            res.status(400).json({ error: 'La reserva original ya se encuentra CANCELADA.' });
            return;
        }

        const resourceId = eventType.resourceId;
        const customerName = student.contact?.full_name || originalBooking.customerName || 'Alumno';
        const customerEmail = student.contact?.email || originalBooking.customerEmail || '';
        const customerPhone = student.contact?.whatsapp || originalBooking.customerPhone || '';

        // 3. VALIDACIÓN ATÓMICA DE CUPO: Intentar crear la NUEVA reserva primero
        let newBooking;
        try {
            const createRes = await agendador.post('/bookings', {
                resourceId,
                eventTypeId: newEventTypeId,
                startTime: newStartTime,
                customerName,
                customerEmail,
                customerPhone,
                notes: `Reprogramación de la clase del ${originalBooking.startTime} (Booking original: ${bookingIdToCancel})`,
            });
            newBooking = createRes.data;
        } catch (err: any) {
            // Si el Agendador responde 409, es que no hay cupo.
            if (err.response && err.response.status === 409) {
                res.status(409).json({ error: 'No hay cupos disponibles en el horario seleccionado.', details: err.response.data });
                return;
            }
            throw err; // Otro tipo de error
        }

        // 4. Si llegamos aquí, la creación fue exitosa. Procedemos a CANCELAR la vieja reserva.
        try {
            await agendador.put(`/bookings/${bookingIdToCancel}`, {
                status: 'CANCELLED',
                notes: `Cancelado por reprogramación a la clase de ${newStartTime}`
            });
        } catch (cancelErr) {
            console.error('¡CUIDADO! Se creó la nueva reserva pero falló la cancelación de la antigua:', cancelErr);
            // Idealmente aquí se podría implementar un rollback, pero por ahora lo registramos.
        }

        // 5. Incrementar el contador `reschedules_used` en la base de datos
        await supabase
            .from('pf_students')
            .update({ reschedules_used: student.reschedules_used + 1 })
            .eq('id', studentId);

        res.json({
            message: 'Reprogramación exitosa.',
            booking: newBooking,
            reschedules_used: student.reschedules_used + 1
        });

    } catch (err: any) {
        console.error('Error en POST /students/:id/reschedule:', err?.response?.data || err.message);
        res.status(500).json({ error: 'Error interno al procesar la reprogramación.' });
    }
});

// ─── Listar próximas reservas del alumno ────────────────
// GET /api/students/:id/bookings
router.get('/:id/bookings', async (req, res) => {
    try {
        const studentId = req.params['id'];

        // 1. Obtener datos del alumno para tener su contact_email
        const { data: student, error: studentError } = await supabase
            .from('pf_students')
            .select('*, contact:pf_contacts(*)')
            .eq('id', studentId)
            .single();

        if (studentError || !student) {
            res.status(404).json({ error: 'Alumno no encontrado.' });
            return;
        }

        const email = student.contact?.email;
        if (!email) {
            res.status(400).json({ error: 'El contacto del alumno no tiene email registrado para buscar en Agendador.' });
            return;
        }

        // 2. Consultar reservas en Agendador por email
        const { data: bookings } = await agendador.get('/bookings', {
            params: { email, status: 'confirmed' }
        });

        // 3. Filtrar solo las que sean futuras
        const now = new Date();
        const futureBookings = (bookings || []).filter((b: any) => new Date(b.startTime) > now);

        res.json(futureBookings);
    } catch (err: any) {
        console.error('Error en GET /students/:id/bookings:', err?.response?.data || err.message);
        res.status(500).json({ error: 'Error al obtener las reservas del alumno.' });
    }
});




export default router;
