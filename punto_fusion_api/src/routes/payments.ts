import { Router } from 'express';
import { supabase } from '../supabase.js';

const router = Router();

// ─── Registrar un pago ──────────────────────────────────
router.post('/', async (req, res) => {
    try {
        const { booking_id, method, amount, currency, reference_text, proof_attachment_id } = req.body as {
            booking_id: string;
            method?: 'sinpe' | 'otro';
            amount?: number;
            currency?: string;
            reference_text?: string;
            proof_attachment_id?: string;
        };

        if (!booking_id) {
            res.status(400).json({ error: 'Se requiere el campo "booking_id".' });
            return;
        }

        const { data, error } = await supabase
            .from('pf_payments')
            .insert({
                booking_id,
                method: method ?? 'sinpe',
                amount: amount ?? null,
                currency: currency ?? 'CRC',
                reference_text: reference_text ?? null,
                proof_attachment_id: proof_attachment_id ?? null,
                paid_at: new Date().toISOString(),
            })
            .select()
            .single();

        if (error) throw error;
        res.status(201).json(data);
    } catch (err) {
        console.error('Error en POST /payments:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// ─── Verificar / rechazar un pago ───────────────────────
router.patch('/:id/verify', async (req, res) => {
    try {
        const { status } = req.body as { status?: 'verificado' | 'rechazado' };
        if (!status || !['verificado', 'rechazado'].includes(status)) {
            res.status(400).json({ error: 'Se requiere "status": "verificado" o "rechazado".' });
            return;
        }

        const { data: payment, error } = await supabase
            .from('pf_payments')
            .update({
                status,
                verified_at: status === 'verificado' ? new Date().toISOString() : null,
            })
            .eq('id', req.params['id'])
            .select()
            .single();

        if (error) throw error;

        // Si se verificó, confirmar la reserva
        if (status === 'verificado' && payment) {
            await supabase
                .from('pf_bookings')
                .update({ status: 'confirmado' })
                .eq('id', payment.booking_id);
        }

        res.json(payment);
    } catch (err) {
        console.error('Error en PATCH /payments/:id/verify:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// ─── Listar pagos ───────────────────────────────────────
router.get('/', async (req, res) => {
    try {
        const { booking_id } = req.query as { booking_id?: string };

        let query = supabase
            .from('pf_payments')
            .select('*')
            .order('created_at', { ascending: false });

        if (booking_id) query = query.eq('booking_id', booking_id);

        const { data, error } = await query;
        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error('Error en GET /payments:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

export default router;
