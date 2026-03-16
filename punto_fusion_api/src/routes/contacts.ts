import { Router } from 'express';
import { supabase } from '../supabase.js';

const router = Router();

// ─── Buscar o crear contacto ────────────────────────────
// POST /api/contacts/upsert
router.post('/upsert', async (req, res) => {
    try {
        const { whatsapp, full_name, city, country, preferred_channel } = req.body as {
            whatsapp?: string;
            full_name?: string;
            city?: string;
            country?: string;
            preferred_channel?: 'mensaje' | 'llamada' | 'visita';
        };

        if (!whatsapp) {
            res.status(400).json({ error: 'Se requiere el campo "whatsapp".' });
            return;
        }

        const { data, error } = await supabase
            .from('pf_contacts')
            .upsert(
                {
                    whatsapp,
                    full_name: full_name ?? null,
                    city: city ?? null,
                    country: country ?? null,
                    preferred_channel: preferred_channel ?? null,
                    last_seen_at: new Date().toISOString(),
                },
                { onConflict: 'whatsapp' }
            )
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error('Error en /contacts/upsert:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// ─── Listar contactos ───────────────────────────────────
router.get('/', async (_req, res) => {
    try {
        const { data, error } = await supabase
            .from('pf_contacts')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100);

        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error('Error en GET /contacts:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// ─── Obtener contacto por ID ────────────────────────────
router.get('/:id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('pf_contacts')
            .select('*')
            .eq('id', req.params['id'])
            .maybeSingle();

        if (error) throw error;
        if (!data) {
            res.status(404).json({ error: 'Contacto no encontrado.' });
            return;
        }
        res.json(data);
    } catch (err) {
        console.error('Error en GET /contacts/:id:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

export default router;
