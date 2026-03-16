import axios from 'axios';

// Cliente para Punto Fusión API (Lógica de Negocio)
export const api = axios.create({
    baseURL: import.meta.env.VITE_PF_API_URL || 'http://localhost:3100/api',
    headers: {
        'Content-Type': 'application/json',
    },
});

// Cliente para Agendador Calendar API
export const calendarApi = axios.create({
    baseURL: import.meta.env.VITE_AGENDADOR_API_URL || 'https://agendador.smartnexo.com/api',
    headers: {
        'Content-Type': 'application/json',
    },
});
