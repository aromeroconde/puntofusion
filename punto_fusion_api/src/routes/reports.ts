import { Router } from 'express';
import { generateDailyAccountStatement, generateStudentConsumptionStatement } from '../lib/dailyReport.js';

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

// GET /api/reports/student?student=Caro%20Madrigal&period=esta%20semana
router.get('/student', async (req, res) => {
    try {
        const student = typeof req.query['student'] === 'string' ? req.query['student'] : '';
        if (!student) {
            res.status(400).json({ success: false, error: 'Parámetro ?student es requerido' });
            return;
        }
        const period = typeof req.query['period'] === 'string' ? req.query['period'] : 'hoy';
        const statement = await generateStudentConsumptionStatement(student, period);
        res.json({
            success: true,
            student: student,
            period: period,
            report: statement
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
