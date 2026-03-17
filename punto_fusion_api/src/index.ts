import express from 'express';
import cors from 'cors';
import 'dotenv/config';

import studentsRouter from './routes/students.js';
import contactsRouter from './routes/contacts.js';
import requestsRouter from './routes/requests.js';
import waitlistRouter from './routes/waitlist.js';
import paymentsRouter from './routes/payments.js';
import servicesRouter from './routes/services.js';
import alegraRouter from './routes/alegra.js';
import classesRouter from './routes/classes.js';
import billingRouter from './routes/billing.js';

const app = express();

app.use(cors());
app.use(express.json());

// ─── Rutas ──────────────────────────────────────────────
app.use('/api/students', studentsRouter);
app.use('/api/contacts', contactsRouter);
app.use('/api/requests', requestsRouter);
app.use('/api/waitlist', waitlistRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/services', servicesRouter);
app.use('/api/alegra', alegraRouter);
app.use('/api/classes', classesRouter);
app.use('/api/billing', billingRouter);

// ─── Health check ───────────────────────────────────────
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'punto_fusion_api', time: new Date().toISOString() });
});

// ─── Iniciar servidor ───────────────────────────────────
const PORT = process.env['PORT'] || 3100;

app.listen(PORT, () => {
    console.log(`🔥 Punto Fusión API corriendo en http://localhost:${PORT}`);
});
