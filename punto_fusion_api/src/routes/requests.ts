import { Router } from 'express';
import { supabase } from '../supabase.js';

const router = Router();

// ─── Crear solicitud ────────────────────────────────────
// POST /api/requests
// Acepta contact_id directo O full_name + whatsapp para crear contacto on-the-fly
router.post('/', async (req, res) => {
    try {
        const {
            contact_id, full_name, whatsapp, email,
            student_id, service_id, internal_tag,
            objective, level, desired_datetime, has_files, payload,
        } = req.body as {
            contact_id?: string;
            full_name?: string;
            whatsapp?: string;
            email?: string;
            student_id?: string;
            service_id?: string;
            internal_tag?: string;
            objective?: string;
            level?: string;
            desired_datetime?: string;
            has_files?: boolean;
            payload?: Record<string, unknown>;
        };

        let resolvedContactId = contact_id;

        // Si no se pasa contact_id, necesitamos full_name + whatsapp para crear/encontrar el contacto
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
                // Crear nuevo contacto
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
        }

        const { data, error } = await supabase
            .from('pf_requests')
            .insert({
                contact_id: resolvedContactId,
                student_id: student_id ?? null,
                service_id: service_id ?? null,
                internal_tag: internal_tag ?? null,
                objective: objective ?? null,
                level: level ?? null,
                desired_datetime: desired_datetime ?? null,
                has_files: has_files ?? false,
                payload: payload ?? {},
            })
            .select('*, contact:pf_contacts(*)')
            .single();

        if (error) throw error;
        res.status(201).json(data);
    } catch (err) {
        console.error('Error en POST /requests:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// ─── Listar solicitudes ─────────────────────────────────
router.get('/', async (req, res) => {
    try {
        const { contact_id, status, internal_tag } = req.query as {
            contact_id?: string;
            status?: string;
            internal_tag?: string;
        };

        let query = supabase
            .from('pf_requests')
            .select('*, contact:pf_contacts(*), service:pf_services(*)')
            .order('created_at', { ascending: false })
            .limit(100);

        if (contact_id) query = query.eq('contact_id', contact_id);
        if (status) query = query.eq('status', status);
        if (internal_tag) query = query.eq('internal_tag', internal_tag);

        const { data, error } = await query;
        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error('Error en GET /requests:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// ─── Obtener solicitud por ID ───────────────────────────
router.get('/:id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('pf_requests')
            .select('*, contact:pf_contacts(*), service:pf_services(*)')
            .eq('id', req.params['id'])
            .maybeSingle();

        if (error) throw error;
        if (!data) {
            res.status(404).json({ error: 'Solicitud no encontrada.' });
            return;
        }
        res.json(data);
    } catch (err) {
        console.error('Error en GET /requests/:id:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// ─── Actualizar estado de solicitud ─────────────────────
router.patch('/:id/status', async (req, res) => {
    try {
        const { status } = req.body as { status?: string };
        if (!status) {
            res.status(400).json({ error: 'Se requiere el campo "status".' });
            return;
        }

        const updateData: Record<string, unknown> = { status };
        if (status === 'cerrado') updateData['closed_at'] = new Date().toISOString();

        const { data, error } = await supabase
            .from('pf_requests')
            .update(updateData)
            .eq('id', req.params['id'])
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error('Error en PATCH /requests/:id/status:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

export default router;
