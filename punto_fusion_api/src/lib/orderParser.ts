import axios from 'axios';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const OPENAI_API_KEY = process.env['OPENAI_API_KEY'] || '';

export interface ParsedItem {
    raw_text: string;
    product_search: string;
    quantity: number;
    specification?: string;
}

export interface ParsedOrder {
    customer_name: string;
    customer_phone?: string;
    items: ParsedItem[];
    notes?: string;
    wants_draft?: boolean;
}

export async function parseOrderMessage(text: string): Promise<ParsedOrder | null> {
    if (!OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY no configurada');
    }

    const prompt = `Eres un asistente que analiza mensajes internos de un equipo de ventas en una tienda de joyería y herramientas.
Tu labor es extraer de manera estructurada los productos pedidos, sus cantidades, especificaciones (medidas, tamaños, etc.) y los datos del cliente (nombre, teléfono), además de si pidió guardarla explícitamente en borrador.

Mensaje del asesor:
"${text}"

Devuelve ÚNICAMENTE un objeto JSON válido con la siguiente estructura (sin formato Markdown adicional, solo el JSON):
{
  "customer_name": "Nombre del cliente o 'Cliente por definir'",
  "customer_phone": "Teléfono si se menciona o null",
  "notes": "Notas adicionales o null",
  "wants_draft": true si el usuario dijo que la guarde como borrador o draft, false si no lo dijo,
  "items": [
    {
      "raw_text": "texto exacto del producto",
      "product_search": "término clave para buscar el producto en el catálogo (ej: marco de segueta, alicate corta tubo, fresas conicas engaste)",
      "quantity": 1,
      "specification": "especificación adicional como medida o tamaño si existe, o null"
    }
  ]
}`;

    try {
        const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.1,
                response_format: { type: 'json_object' }
            },
            {
                headers: {
                    'Authorization': `Bearer ${OPENAI_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const content = response.data.choices[0]?.message?.content;
        if (!content) return null;

        const parsed = JSON.parse(content) as ParsedOrder;
        return parsed;
    } catch (error: any) {
        console.error('Error al parsear el mensaje con OpenAI:', error?.response?.data || error.message);
        return null;
    }
}
