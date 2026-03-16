import { Router, Request, Response } from 'express';
import { supabase } from '../supabase.js';
import alegraApi from '../lib/alegra.js';

const router = Router();

// CONSTANTE: ID del Consumidor Final en Alegra
const CONSUMIDOR_FINAL_CONTACT_ID = process.env.ALEGRA_CONSUMER_ID || '1';

router.post('/generate-monthly', async (req: Request, res: Response) => {
    try {
        // 1. Obtener a todos los alumnos ACTIVOS que tengan un código de facturación (alegra_item_reference)
        const { data: students, error: studentsError } = await supabase
            .from('pf_students')
            .select('*, contact:pf_contacts(*)')
            .eq('status', 'activo')
            .not('alegra_item_reference', 'is', null);

        if (studentsError) throw studentsError;

        if (!students || students.length === 0) {
            res.status(200).json({ message: 'No hay alumnos activos con código de producto asignado para facturar.' });
            return;
        }

        // 2. Traer el catálogo completo de productos de Alegra para resolver la Referencia -> ID
        const itemsRes = await alegraApi.get('/items?limit=100');
        const alegraItems = itemsRes.data || [];

        // Construir un diccionario donde la LLAVE es el código "JWTA" y el VALOR es el objeto Item completo de Alegra
        const itemsDict: Record<string, any> = {};
        for (const item of alegraItems) {
            let refString = '';
            if (typeof item.reference === 'string') {
                refString = item.reference;
            } else if (item.reference && typeof item.reference.reference === 'string') {
                refString = item.reference.reference;
            }
            if (refString) {
                itemsDict[refString.trim().toUpperCase()] = item;
            }
        }

        const results = {
            total_processed: 0,
            invoices_created: 0,
            errors: [] as string[]
        };

        // 3. Iterar sobre cada alumno y emitir factura
        for (const student of students) {
            results.total_processed++;
            try {
                const itemRef = (student.alegra_item_reference as string).trim().toUpperCase();
                const alegraItem = itemsDict[itemRef];

                if (!alegraItem) {
                    results.errors.push(`Estudiante ${student.contact?.full_name}: No se encontró un producto en Alegra con el código "${itemRef}"`);
                    continue;
                }

                // Armar el payload para Alegra (usando Cotizaciones)
                const targetDate = new Date();
                const targetDateStr = targetDate.toISOString().split('T')[0];
                const estimatePayload = {
                    date: targetDateStr,
                    dueDate: new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0).toISOString().split('T')[0],
                    client: {
                        id: student.requires_invoice && student.alegra_contact_id
                            ? student.alegra_contact_id
                            : CONSUMIDOR_FINAL_CONTACT_ID
                    },
                    items: [
                        {
                            id: alegraItem.id,
                            price: alegraItem.price?.[0]?.price || 0,
                            quantity: 1,
                            description: `Mensualidad: ${alegraItem.name} - Estudiante: ${student.contact?.full_name}`,
                            tax: [{ id: '3' }] // IVA del 13% para Costa Rica
                        }
                    ],
                    observations: `Facturación automatizada PF - Alumno: ${student.contact?.full_name}`
                };

                // Llamar a Alegra para crear Cotización
                const alegraRes = await alegraApi.post('/estimates', estimatePayload);
                if (alegraRes.status === 201 || alegraRes.status === 200) {
                    results.invoices_created++;
                } else {
                    results.errors.push(`Estudiante ${student.contact?.full_name}: Error de Alegra -> ${JSON.stringify(alegraRes.data)}`);
                }
            } catch (err: any) {
                console.error(`Error procesando estudiante ${student.id}:`, err?.response?.data || err.message);
                results.errors.push(`Estudiante ${student.contact?.full_name}: Error interno -> ${err.message}`);
            }
        }

        res.status(200).json(results);
    } catch (error: any) {
        console.error('Error in POST /generate-monthly:', error);
        res.status(500).json({ error: 'Error interno generando facturación masiva' });
    }
});

export default router;
