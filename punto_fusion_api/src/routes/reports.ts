import { Router } from 'express';
import { generateDailyAccountStatement } from '../lib/dailyReport.js';

const router = Router();

// GET /api/reports/daily?date=YYYY-MM-DD
router.get('/daily', async (req, res) => {
    try {
        const dateStr = typeof req.query['date'] === 'string' ? req.query['date'] : undefined;
        const statement = await generateDailyAccountStatement(dateStr);
        res.json({
            success: true,
            date: dateStr || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Costa_Rica' }),
            report: statement
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
