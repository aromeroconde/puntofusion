import axios from 'axios';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const OPENAI_API_KEY = process.env['OPENAI_API_KEY'] || '';
const TELEGRAM_BOT_TOKEN = process.env['TELEGRAM_BOT_TOKEN'] || '';

async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export async function transcribeTelegramVoice(fileId: string): Promise<string> {
    if (!OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY no configurada');
    }

    let filePath: string | null = null;
    let attempts = 0;

    // 1. Obtener file_path de Telegram con reintentos para evitar Gateway Timeouts (504)
    while (attempts < 3 && !filePath) {
        attempts++;
        try {
            const fileInfoRes = await axios.get(
                `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`,
                { timeout: 15000 }
            );

            if (fileInfoRes.data?.ok && fileInfoRes.data?.result?.file_path) {
                filePath = fileInfoRes.data.result.file_path;
            } else {
                throw new Error('Respuesta inválida de getFile en Telegram');
            }
        } catch (err: any) {
            console.warn(`Intento ${attempts} de getFile falló:`, err.message);
            if (attempts < 3) await sleep(1000);
            else throw err;
        }
    }

    if (!filePath) {
        throw new Error('No se pudo obtener la ruta del archivo de audio de Telegram');
    }

    // 2. Descargar el archivo de audio con reintentos
    const fileDownloadUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${filePath}`;
    let audioBuffer: Buffer | null = null;
    attempts = 0;

    while (attempts < 3 && !audioBuffer) {
        attempts++;
        try {
            const audioResponse = await axios.get(fileDownloadUrl, {
                responseType: 'arraybuffer',
                timeout: 25000
            });
            audioBuffer = Buffer.from(audioResponse.data);
        } catch (err: any) {
            console.warn(`Intento ${attempts} de descarga de audio falló:`, err.message);
            if (attempts < 3) await sleep(1000);
            else throw err;
        }
    }

    if (!audioBuffer) {
        throw new Error('No se pudo descargar el archivo de audio');
    }

    // 3. Enviar a Whisper con FormData nativo
    const blob = new Blob([new Uint8Array(audioBuffer)], { type: 'audio/ogg' });
    const formData = new FormData();
    formData.append('file', blob, 'voice.oga');
    formData.append('model', 'whisper-1');
    formData.append('language', 'es');
    formData.append('prompt', 'Punto Fusión, tienda joyería y orfebrería, Cafe La Catalina, empanadas, almojábana, broca, plata pura 1000 bolsas de 10 gramos, lijas, segueta, alicate, fresas cónicas, engaste, lima, buril, borrador');

    const whisperResponse = await axios.post(
        'https://api.openai.com/v1/audio/transcriptions',
        formData,
        {
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            timeout: 30000
        }
    );

    const transcribedText = whisperResponse.data?.text || '';
    return transcribedText.trim();
}
