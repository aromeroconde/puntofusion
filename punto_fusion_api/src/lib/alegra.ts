import axios from 'axios';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load variables outside index.ts as a fallback or early load
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const ALEGRA_USER = process.env.ALEGRA_USER;
const ALEGRA_TOKEN = process.env.ALEGRA_TOKEN;

if (!ALEGRA_USER || !ALEGRA_TOKEN) {
    console.warn('⚠️ Credenciales de Alegra no encontradas en .env. Las integraciones de facturación podrían fallar.');
}

const alegraApi = axios.create({
    baseURL: 'https://api.alegra.com/api/v1',
    headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${ALEGRA_USER}:${ALEGRA_TOKEN}`).toString('base64')}`
    }
});

export default alegraApi;
