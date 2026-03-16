import { Router } from 'express';
import { supabase } from '../supabase.js';

const router = Router();

// ─── Agregar a la lista de espera ───────────────────────
router.post('/', async (req, res) => {
    try {
        const { contact_id, service_id, preference } = req.body as {
            contact_id: string;
            service_id?: string;
            preference?: Record<string, unknown>;
        };

        if (!contact_id) {
            res.status(400).json({ error: 'Se requiere el campo "contact_id".' });
            return;
        }

        // Verificar duplicado
        let dupQuery = supabase
            .from('pf_waitlist')
            .select('id')
            .eq('contact_id', contact_id)
            .eq('status', 'waiting');

        if (service_id) dupQuery = dupQuery.eq('service_id', service_id);
        else dupQuery = dupQuery.is('service_id', null);

        const { data: existing } = await dupQuery.maybeSingle();

        if (existing) {
            res.status(409).json({ error: 'El contacto ya está en la lista de espera para este servicio.', entry: existing });
            return;
        }

        const { data, error } = await supabase
            .from('pf_waitlist')
            .insert({
                contact_id,
                service_id: service_id ?? null,
                preference: preference ?? {},
                status: 'waiting',
            })
            .select()
            .single();

        if (error) throw error;
        res.status(201).json(data);
    } catch (err) {
        console.error('Error en POST /waitlist:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// ─── Listar lista de espera ─────────────────────────────
router.get('/', async (req, res) => {
    try {
        const { service_id, status } = req.query as { service_id?: string; status?: string };

        let query = supabase
            .from('pf_waitlist')
            .select('*, contact:pf_contacts(*), service:pf_services(*)')
            .order('created_at', { ascending: true });

        if (service_id) query = query.eq('service_id', service_id);
        if (status) query = query.eq('status', status);

        const { data, error } = await query;
        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error('Error en GET /waitlist:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// ─── Actualizar estado ──────────────────────────────────
router.patch('/:id', async (req, res) => {
    try {
        const { status } = req.body as { status?: string };
        if (!status) {
            res.status(400).json({ error: 'Se requiere el campo "status".' });
            return;
        }

        const { data, error } = await supabase
            .from('pf_waitlist')
            .update({ status })
            .eq('id', req.params['id'])
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error('Error en PATCH /waitlist/:id:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

export default router;
