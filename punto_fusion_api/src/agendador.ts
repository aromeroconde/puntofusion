import axios from 'axios';

const AGENDADOR_URL = process.env['AGENDADOR_API_URL'] || 'https://agendador.smartnexo.com/api';

export const agendador = axios.create({
    baseURL: AGENDADOR_URL,
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json'
    }
});
