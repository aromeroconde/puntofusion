import { Router, Request, Response } from 'express';
import alegraApi from '../lib/alegra.js';
import { supabase } from '../supabase.js';

const router = Router();

// GET /api/alegra/contacts?identification=XXX
router.get('/contacts', async (req: Request, res: Response): Promise<void> => {
    try {
        const { identification } = req.query;

        if (!identification || typeof identification !== 'string') {
            res.status(400).json({ error: 'Identification (NIT/CC) is required' });
            return;
        }

        // Alegra API search format
        const response = await alegraApi.get('/contacts', {
            params: {
                identification: identification,
                type: 'client'
            }
        });

        const contacts = response.data;

        if (contacts && contacts.length > 0) {
            // Return the first exact match
            const contact = contacts[0];
            res.json({
                id: contact.id,
                name: contact.name,
                identification: contact.identification,
                email: contact.email || null,
                phone: contact.phonePrimary || contact.mobile || null
            });
        } else {
            res.status(404).json({ error: 'Contact not found in Alegra' });
        }

    } catch (error: any) {
        console.error('Error fetching Alegra contact:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to search contact in Alegra', details: error.response?.data });
    }
});

// GET /api/alegra/contacts/:id
router.get('/contacts/:id', async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const response = await alegraApi.get(`/contacts/${id}`);
        const contact = response.data;
        res.json({
            id: contact.id,
            name: contact.name,
            identification: contact.identification,
            email: contact.email || null,
            phone: contact.phonePrimary || contact.mobile || null
        });
    } catch (error: any) {
        console.error('Error fetching Alegra contact by ID:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to fetch contact from Alegra by ID', details: error.response?.data });
    }
});

// GET /api/alegra/items?query=XXX (Optional, for admin panel to search products to link)
router.get('/items', async (req: Request, res: Response): Promise<void> => {
    try {
        const { query } = req.query;

        const response = await alegraApi.get('/items', {
            params: {
                query: query ? String(query) : ''
            }
        });

        const items = response.data.map((item: any) => ({
            id: item.id,
            name: item.name,
            price: item.price !== undefined && item.price.length ? item.price[0].price : 0
        }));

        res.json(items);

    } catch (error: any) {
        console.error('Error fetching Alegra items:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to fetch items from Alegra', details: error.response?.data });
    }
});

// GET /api/alegra/items/reference/:ref
router.get('/items/reference/:ref', async (req: Request, res: Response): Promise<void> => {
    try {
        const { ref } = req.params;
        if (!ref) {
            res.status(400).json({ error: 'Reference code is required' });
            return;
        }

        const targetRef = String(ref).trim().toUpperCase();

        const response = await alegraApi.get('/items', {
            params: { query: targetRef }
        });
        const items = response.data || [];

        const foundItem = items.find((item: any) => {
            let refString = '';
            if (typeof item.reference === 'string') {
                refString = item.reference;
            } else if (item.reference && typeof item.reference.reference === 'string') {
                refString = item.reference.reference;
            }
            return refString && refString.trim().toUpperCase() === targetRef;
        });

        if (foundItem) {
            res.json({
                id: foundItem.id,
                name: foundItem.name,
                price: foundItem.price !== undefined && foundItem.price.length ? foundItem.price[0].price : 0,
                reference: targetRef
            });
        } else {
            res.status(404).json({ error: 'Item not found in Alegra via this reference' });
        }

    } catch (error: any) {
        console.error('Error fetching Alegra item by ref:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to search item in Alegra', details: error.response?.data });
    }
});

// GET /api/alegra/invoices/pending
router.get('/invoices/pending', async (req: Request, res: Response): Promise<void> => {
    try {
        // 1. Obtener alumnos activos que generan factura
        const { data: activeStudents, error } = await supabase
            .from('pf_students')
            .select('id, contact:pf_contacts(full_name), alegra_contact_id, requires_invoice')
            .eq('status', 'activo')
            .eq('requires_invoice', true)
            .not('alegra_contact_id', 'is', null);

        if (error) throw error;

        // Mapear IDs de Alegra para fácil búsqueda. 
        const activeAlegraContactIds = new Set(
            activeStudents?.map(s => String(s.alegra_contact_id)) || []
        );

        if (activeAlegraContactIds.size === 0) {
            res.json([]);
            return;
        }

        // 2. Obtener TODAS las COTIZACIONES y FACTURAS abiertas de Alegra 
        const [estimatesRes, invoicesRes] = await Promise.all([
            alegraApi.get('/estimates', { params: { status: 'unbilled', limit: 30 } }),
            alegraApi.get('/invoices', { params: { status: 'open', limit: 30 } })
        ]);

        const allOpenEstimates = estimatesRes.data || [];
        const allOpenInvoices = invoicesRes.data || [];

        // 3. Filtrar y unificar
        const processAlegraDocs = (docs: any[], type: 'estimate' | 'invoice') => {
            return docs
                .filter((doc: any) => doc.client && doc.client.id && activeAlegraContactIds.has(String(doc.client.id)))
                .map((doc: any) => {
                    const student = activeStudents?.find(s => String(s.alegra_contact_id) === String(doc.client.id));
                    const studentName = student && student.contact ? (student.contact as any).full_name : doc.client.name;
                    return {
                        id: doc.id,
                        type, // 'estimate' o 'invoice'
                        number: doc.numberTemplate?.fullNumber || doc.id,
                        date: doc.date,
                        dueDate: doc.dueDate,
                        clientId: doc.client.id,
                        clientName: doc.client.name,
                        studentName: studentName,
                        studentId: student?.id,
                        total: doc.total,
                        balance: type === 'invoice' ? doc.balance : doc.total,
                        status: doc.status
                    };
                });
        };

        const pendingInvoices = [
            ...processAlegraDocs(allOpenInvoices, 'invoice'),
            ...processAlegraDocs(allOpenEstimates, 'estimate')
        ];

        res.json(pendingInvoices);

    } catch (error: any) {
        console.error('Error fetching Alegra pending invoices/estimates:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to fetch pending invoices', details: error.response?.data });
    }
});

// POST /api/alegra/estimates (Manual Cobro)
router.post('/estimates', async (req: Request, res: Response): Promise<void> => {
    try {
        const { studentId, reference, price, description } = req.body;

        if (!studentId) {
            res.status(400).json({ error: 'studentId is required' });
            return;
        }

        // 1. Fetch student data
        const { data: student, error: studentError } = await supabase
            .from('pf_students')
            .select('alegra_contact_id, alegra_item_reference')
            .eq('id', studentId)
            .single();

        if (studentError || !student) {
            res.status(404).json({ error: 'Student not found in database' });
            return;
        }

        if (!student.alegra_contact_id) {
            res.status(400).json({ error: 'Student does not have an Alegra Contact ID linked' });
            return;
        }

        // 2. Determine reference
        const targetRef = reference || student.alegra_item_reference;
        if (!targetRef) {
            res.status(400).json({ error: 'No item reference found for this student. Please provide one or link it in their profile.' });
            return;
        }

        // 3. Resolve Alegra Item ID from reference
        const itemsRes = await alegraApi.get('/items', { params: { query: targetRef } });
        const items = itemsRes.data || [];
        const foundItem = items.find((item: any) => {
            let itemRef = '';
            if (typeof item.reference === 'string') itemRef = item.reference;
            else if (item.reference?.reference) itemRef = item.reference.reference;
            return itemRef.trim().toUpperCase() === targetRef.trim().toUpperCase();
        });

        if (!foundItem) {
            res.status(404).json({ error: `Item with reference "${targetRef}" not found in Alegra.` });
            return;
        }

        // 4. Create Estimate in Alegra
        const estimateData = {
            date: new Date().toISOString().split('T')[0],
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 days from now
            client: { id: student.alegra_contact_id },
            items: [
                {
                    id: foundItem.id,
                    price: price || (foundItem.price && foundItem.price.length ? foundItem.price[0].price : 0),
                    quantity: 1,
                    description: description || `Cobro manual - ${foundItem.name}`
                }
            ],
            status: 'unbilled'
        };

        const response = await alegraApi.post('/estimates', estimateData);
        res.json({ success: true, estimate: response.data });

    } catch (error: any) {
        console.error('Error creating manual estimate in Alegra:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to create manual estimate', details: error.response?.data || error.message });
    }
});

// POST /api/alegra/invoices/:id/pay
router.post('/invoices/:id/pay', async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { type = 'estimate', amount } = req.body;

        if (type === 'estimate') {
            // Lógica para cotizaciones (mocks preventivos que no aceptan abonos)
            const estimateRes = await alegraApi.get(`/estimates/${id}`);
            const estimate = estimateRes.data;

            if (!estimate || estimate.status !== 'unbilled') {
                res.status(400).json({ error: `Estimate not found or is not unbilled. Current status: ${estimate?.status}` });
                return;
            }

            // Pasamos la cotización a estado "accepted" para darla como "pagada" simbólicamente en nuestras pruebas
            const paymentRes = await alegraApi.put(`/estimates/${id}`, { status: 'accepted' });
            res.json({ success: true, payment: paymentRes.data });
        } else if (type === 'invoice') {
            // Lógica REAL para facturas electrónicas timbradas (pagos parciales / totales)
            const invoiceRes = await alegraApi.get(`/invoices/${id}`);
            const invoice = invoiceRes.data;

            if (!invoice || invoice.status !== 'open') {
                res.status(400).json({ error: `Invoice not found or is not open. Current status: ${invoice?.status}` });
                return;
            }

            const paymentAmount = amount ? Number(amount) : invoice.balance;

            const paymentData = {
                date: new Date().toISOString().split('T')[0],
                client: { id: invoice.client.id },
                bankAccount: { id: 1 }, // Default bank account (can be parameterized later)
                type: 'in',
                invoices: [
                    {
                        id: invoice.id,
                        amount: paymentAmount
                    }
                ]
            };

            const paymentRes = await alegraApi.post('/payments', paymentData);
            res.json({ success: true, payment: paymentRes.data });
        } else {
            res.status(400).json({ error: 'Invalid document type. Must be estimate or invoice.' });
        }

    } catch (error: any) {
        console.error('Error processing Alegra payment:', error.response?.data || error.message);
        const detail = error.response?.data?.message || error.response?.data || error.message;
        res.status(500).json({ error: 'Failed to complete payment in Alegra', details: detail });
    }
});

export default router;
