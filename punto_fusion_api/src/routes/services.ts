import { Router } from 'express';
import { supabase } from '../supabase.js';

const router = Router();

// ─── Listar servicios activos ───────────────────────────
router.get('/', async (req, res) => {
    try {
        const { service, subservice } = req.query as { service?: string; subservice?: string };

        let query = supabase
            .from('pf_services')
            .select('*')
            .eq('is_active', true)
            .order('name', { ascending: true });

        if (service) query = query.eq('service', service);
        if (subservice) query = query.eq('subservice', subservice);

        const { data, error } = await query;
        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error('Error en GET /services:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// ─── Obtener servicio por ID ────────────────────────────
router.get('/:id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('pf_services')
            .select('*')
            .eq('id', req.params['id'])
            .maybeSingle();

        if (error) throw error;
        if (!data) {
            res.status(404).json({ error: 'Servicio no encontrado.' });
            return;
        }
        res.json(data);
    } catch (err) {
        console.error('Error en GET /services/:id:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

export default router;
