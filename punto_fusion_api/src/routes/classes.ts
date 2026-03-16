import { Router, Request, Response } from 'express';
import alegraApi from '../lib/alegra.js';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// GET /api/classes - Get all class mappings
router.get('/', async (req: Request, res: Response) => {
    try {
        const classes = await prisma.classMapping.findMany({
            orderBy: { name: 'asc' }
        });
        res.json(classes);
    } catch (error) {
        console.error('Error fetching classes:', error);
        res.status(500).json({ error: 'Failed to fetch classes' });
    }
});

// POST /api/classes - Create a new mapping
router.post('/', async (req: Request, res: Response): Promise<void> => {
    try {
        const { agendador_event_type_id, alegra_item_id, name, price } = req.body;

        if (!agendador_event_type_id || !alegra_item_id || !name || price === undefined) {
            res.status(400).json({ error: 'Missing required fields' });
            return;
        }

        const newClass = await prisma.classMapping.create({
            data: {
                agendador_event_type_id,
                alegra_item_id,
                name,
                price: Number(price)
            }
        });

        res.status(201).json(newClass);
    } catch (error: any) {
        console.error('Error creating class mapping:', error);
        if (error.code === 'P2002') {
            res.status(409).json({ error: 'A mapping for this event type ID already exists' });
        } else {
            res.status(500).json({ error: 'Failed to create class mapping' });
        }
    }
});

// DELETE /api/classes/:id - Delete a mapping
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
    try {
        const id = req.params['id'] as string;
        await prisma.classMapping.delete({
            where: { id }
        });
        res.json({ success: true });
    } catch (error: any) {
        console.error('Error deleting class mapping:', error);
        if (error.code === 'P2025') {
            res.status(404).json({ error: 'Class mapping not found' });
        } else {
            res.status(500).json({ error: 'Failed to delete class mapping' });
        }
    }
});

// PUT /api/classes/:id - Update a mapping
router.put('/:id', async (req: Request, res: Response): Promise<void> => {
    try {
        const id = req.params['id'] as string;
        const { agendador_event_type_id, alegra_item_id, name, price } = req.body;

        const dataToUpdate: any = {
            agendador_event_type_id,
            alegra_item_id,
            name
        };
        if (price !== undefined) {
            dataToUpdate.price = Number(price);
        }

        const mappedClass = await prisma.classMapping.update({
            where: { id },
            data: dataToUpdate
        });

        res.json(mappedClass);
    } catch (error: any) {
        console.error('Error updating class mapping:', error);
        res.status(500).json({ error: 'Failed to update class mapping' });
    }
});


export default router;
