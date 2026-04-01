import { Router } from 'express';
import { supabase } from '../supabase.js';
import { agendador } from '../agendador.js';

const router = Router();

// ─── Listar servicios activos (desde Agendador + Supabase) ──────
router.get('/', async (req, res) => {
    try {
        // 1. Obtener tipos de eventos directamente del Agendador
        console.log('Consultando servicios al Agendador...');
        const { data: eventTypes } = await agendador.get('/event-types');

        // 2. (Opcional) Combinar con metadatos de Supabase si existen
        const { data: dbServices } = await supabase
            .from('pf_services')
            .select('*')
            .eq('is_active', true);

        // Si el agendador tiene datos, los priorizamos
        if (eventTypes && eventTypes.length > 0) {
            // Mapeamos los EventTypes del agendador al formato de "Service"
            const enrichedServices = eventTypes.map((et: any) => ({
                id: et.id,
                name: et.title,
                description: et.description || '',
                duration: et.length,
                price: et.price || 0, // Si el agendador tiene precio
                is_active: true,
                source: 'agendador',
                metadata: et
            }));

            res.json(enrichedServices);
            return;
        }

        // Si el agendador falló o está vacío, devolvemos lo de la DB
        res.json(dbServices || []);
    } catch (err: any) {
        console.error('Error en GET /services:', err?.response?.data || err.message);
        // Fallback a base de datos si falla el agendador
        try {
            const { data } = await supabase.from('pf_services').select('*').eq('is_active', true);
            res.json(data || []);
        } catch (dbErr) {
            res.status(500).json({ error: 'Error al obtener servicios de ambas fuentes.' });
        }
    }
});

// ─── Obtener servicio por ID ────────────────────────────
router.get('/:id', async (req, res) => {
    try {
        // Intentar obtener del agendador primero
        try {
            const { data: et } = await agendador.get(`/event-types/${req.params['id']}`);
            if (et) {
                res.json({
                    id: et.id,
                    name: et.title,
                    description: et.description || '',
                    duration: et.length,
                    is_active: true,
                    source: 'agendador',
                    metadata: et
                });
                return;
            }
        } catch (e) { }

        // Si no en Supabase
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
