import { Router } from 'express';
import { supabase } from '../supabase.js';
import { agendador } from '../agendador.js';
import { format, parseISO, startOfWeek, addDays } from 'date-fns';

const router = Router();

// ─── Calendario: horarios programados + bookings locales ────
// GET /api/bookings/calendar?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
router.get('/calendar', async (req, res) => {
    try {
        const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };

        if (!startDate || !endDate) {
            res.status(400).json({ error: 'Faltan parámetros: startDate, endDate.' });
            return;
        }

        // 1. Obtener event-types y schedules del Agendador
        const [eventTypesRes, schedulesRes] = await Promise.all([
            agendador.get('/event-types').catch(() => ({ data: [] })),
            agendador.get('/event-type-schedules').catch(() => ({ data: [] })),
        ]);

        const eventTypes: any[] = eventTypesRes.data || [];
        const schedules: any[] = schedulesRes.data || [];

        // 2. Obtener bookings locales en el rango de fechas
        const { data: localBookings, error: bookingsError } = await supabase
            .from('pf_bookings')
            .select('id, event_type_id, agendador_booking_id, student_id, status, start_at, contact:pf_contacts(full_name)')
            .gte('start_at', `${startDate}T00:00:00Z`)
            .lte('start_at', `${endDate}T23:59:59Z`)
            .neq('status', 'cancelado');

        if (bookingsError) throw bookingsError;

        // 3. Agrupar por día → clase
        const days: Record<string, any[]> = {};

        // Poblar schedules (horarios programados)
        for (const schedule of schedules) {
            const et = eventTypes.find((e: any) => e.id === schedule.eventTypeId);
            if (!et) continue;

            const dayOfWeek = schedule.dayOfWeek; // 0=Dom, 1=Lun, ..., 6=Sab
            const duration = et.duration || 60;
            const maxCapacity = et.capacity || 15;

            // Generar fechas de este schedule en el rango
            const start = parseISO(startDate);
            const end = parseISO(endDate);
            for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
                if (d.getDay() === dayOfWeek) {
                    const dateStr = format(d, 'yyyy-MM-dd');
                    const startDateTime = `${dateStr}T${schedule.startTime}:00`;

                    // Calcular endTime
                    const [hours, minutes] = schedule.startTime.split(':').map(Number);
                    const endDateObj = new Date(d);
                    endDateObj.setHours(hours, minutes + duration, 0, 0);
                    const endTimeStr = `${String(endDateObj.getHours()).padStart(2, '0')}:${String(endDateObj.getMinutes()).padStart(2, '0')}`;

                    // Buscar bookings de esta clase en este día
                    const classBookings = (localBookings || []).filter(b => {
                        if (b.event_type_id !== schedule.eventTypeId) return false;
                        const bDate = b.start_at?.substring(0, 10);
                        return bDate === dateStr;
                    });

                    if (!days[dateStr]) days[dateStr] = [];

                    days[dateStr].push({
                        eventTypeId: schedule.eventTypeId,
                        title: et.title,
                        startTime: schedule.startTime,
                        endTime: endTimeStr,
                        duration,
                        maxCapacity,
                        bookedCount: classBookings.length,
                        bookings: classBookings.map(b => ({
                            id: b.id,
                            studentName: (b.contact as any)?.full_name || 'Desconocido',
                            status: b.status,
                        })),
                    });
                }
            }
        }

        // Formatear respuesta
        const result = Object.entries(days)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, classes]) => ({ date, classes }));

        res.json({ days: result });
    } catch (err: any) {
        console.error('Error en GET /bookings/calendar:', err?.response?.data || err.message);
        res.status(500).json({ error: 'Error al obtener el calendario.' });
    }
});

// ─── Listar bookings locales con filtros ──────────────────
// GET /api/bookings?student_id=&event_type_id=&status=&start_after=&start_before=
router.get('/', async (req, res) => {
    try {
        const { student_id, event_type_id, status, start_after, start_before } = req.query as Record<string, string | undefined>;

        let query = supabase
            .from('pf_bookings')
            .select('*, contact:pf_contacts(full_name, whatsapp), student:pf_students(id, level)')
            .order('start_at', { ascending: true });

        if (student_id) query = query.eq('student_id', student_id);
        if (event_type_id) query = query.eq('event_type_id', event_type_id);
        if (status) query = query.eq('status', status);
        if (start_after) query = query.gte('start_at', start_after);
        if (start_before) query = query.lte('start_at', start_before);

        const { data, error } = await query;

        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error('Error en GET /bookings:', err);
        res.status(500).json({ error: 'Error al listar bookings.' });
    }
});

// ─── Reconciliación: sincronizar Agendador → pf_bookings ──
// POST /api/bookings/reconcile
router.post('/reconcile', async (_req, res) => {
    try {
        // 1. Traer todos los bookings del Agendador
        const { data: agendadorBookings } = await agendador.get('/bookings');
        const allAgendadorBookings: any[] = agendadorBookings || [];

        // 2. Traer todos los pf_bookings que tienen agendador_booking_id
        const { data: localBookings, error: localError } = await supabase
            .from('pf_bookings')
            .select('id, agendador_booking_id, status');

        if (localError) throw localError;

        const localByAgendadorId = new Map(
            (localBookings || [])
                .filter(b => b.agendador_booking_id)
                .map(b => [b.agendador_booking_id, b])
        );

        let created = 0;
        let updated = 0;
        let skipped = 0;

        for (const ab of allAgendadorBookings) {
            const existing = localByAgendadorId.get(ab.id);

            if (existing) {
                // Verificar si el status cambió en el Agendador
                const isCancelled = ab.status === 'CANCELLED';
                if (isCancelled && existing.status !== 'cancelado') {
                    await supabase.from('pf_bookings')
                        .update({ status: 'cancelado' })
                        .eq('id', existing.id);
                    updated++;
                } else {
                    skipped++;
                }
                continue;
            }

            // No existe localmente → crear
            // Buscar contacto por phone
            const phone = ab.customerPhone;
            if (!phone) {
                skipped++;
                continue;
            }

            const { data: contact } = await supabase
                .from('pf_contacts')
                .select('id')
                .eq('whatsapp', phone)
                .maybeSingle();

            if (!contact) {
                skipped++;
                continue;
            }

            // Buscar student_id a partir del contacto
            const { data: student } = await supabase
                .from('pf_students')
                .select('id')
                .eq('contact_id', contact.id)
                .maybeSingle();

            const isCancelled = ab.status === 'CANCELLED';

            await supabase.from('pf_bookings').insert({
                contact_id: contact.id,
                student_id: student?.id || null,
                event_type_id: ab.eventTypeId || null,
                agendador_booking_id: ab.id,
                start_at: ab.startTime,
                end_at: ab.endTime,
                status: isCancelled ? 'cancelado' : 'confirmado',
                payment_required: true
            });
            created++;
        }

        res.json({ created, updated, skipped, total_agendador: allAgendadorBookings.length });
    } catch (err: any) {
        console.error('Error en POST /bookings/reconcile:', err?.response?.data || err.message);
        res.status(500).json({ error: 'Error en la reconciliación.' });
    }
});

export default router;
