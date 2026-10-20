import axios from 'axios';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import { logInfo, logWarn, logError } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const OPENAI_API_KEY = process.env['OPENAI_API_KEY'] || '';
const TELEGRAM_BOT_TOKEN = process.env['TELEGRAM_BOT_TOKEN'] || '';

async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export interface TranscribeProgressCallback {
    (stage: 'downloading' | 'transcribing'): Promise<void> | void;
}

export async function transcribeTelegramVoice(
    fileId: string,
    onProgress?: TranscribeProgressCallback
): Promise<string> {
    if (!OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY no configurada');
    }

    const tStart = Date.now();
    logInfo(`[Voice] Iniciando procesamiento de audio fileId=${fileId}`);

    let filePath: string | null = null;
    let attempts = 0;

    // 1. Obtener file_path de Telegram con reintentos
    while (attempts < 3 && !filePath) {
        attempts++;
        const t0 = Date.now();
        try {
            logInfo(`[Voice] 1/3 Solicitando getFile a Telegram (intento ${attempts})...`);
            const fileInfoRes = await axios.get(
                `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`,
                { timeout: 30000 }
            );

            if (fileInfoRes.data?.ok && fileInfoRes.data?.result?.file_path) {
                filePath = fileInfoRes.data.result.file_path;
                logInfo(`[Voice] getFile exitoso en ${Date.now() - t0}ms: path=${filePath}`);
            } else {
                throw new Error('Respuesta inválida de getFile en Telegram');
            }
        } catch (err: any) {
            logWarn(`[Voice] Intento ${attempts} de getFile falló en ${Date.now() - t0}ms: ${err.message}`);
            if (attempts < 3) await sleep(1500);
            else throw new Error(`Telegram getFile excedió el tiempo o falló: ${err.message}`);
        }
    }

    if (!filePath) {
        throw new Error('No se pudo obtener la ruta del archivo de audio de Telegram');
    }

    // Notificar progreso de descarga si callback disponible
    if (onProgress) {
        try { await onProgress('downloading'); } catch {}
    }

    // 2. Descargar el archivo de audio con reintentos y timeout extendido (60s)
    const fileDownloadUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${filePath}`;
    let audioBuffer: Buffer | null = null;
    attempts = 0;

    while (attempts < 3 && !audioBuffer) {
        attempts++;
        const t0 = Date.now();
        try {
            logInfo(`[Voice] 2/3 Descargando audio desde Telegram CDN (intento ${attempts})...`);
            const audioResponse = await axios.get(fileDownloadUrl, {
                responseType: 'arraybuffer',
                timeout: 60000
            });
            audioBuffer = Buffer.from(audioResponse.data);
            logInfo(`[Voice] Descarga exitosa en ${Date.now() - t0}ms (${audioBuffer.length} bytes)`);
        } catch (err: any) {
            logWarn(`[Voice] Intento ${attempts} de descarga de audio falló en ${Date.now() - t0}ms: ${err.message}`);
            if (attempts < 3) await sleep(1500);
            else throw new Error(`La descarga del audio desde Telegram excedió el tiempo: ${err.message}`);
        }
    }

    if (!audioBuffer) {
        throw new Error('No se pudo descargar el archivo de audio');
    }

    // Notificar progreso de transcripción si callback disponible
    if (onProgress) {
        try { await onProgress('transcribing'); } catch {}
    }

    // 3. Enviar a Whisper con FormData y timeout extendido (90s)
    const tWhisper = Date.now();
    logInfo(`[Voice] 3/3 Enviando ${audioBuffer.length} bytes a Whisper API (timeout: 90s)...`);

    const blob = new Blob([new Uint8Array(audioBuffer)], { type: 'audio/ogg' });
    const formData = new FormData();
    formData.append('file', blob, 'voice.oga');
    formData.append('model', 'whisper-1');
    formData.append('language', 'es');
    formData.append('prompt', 'Punto Fusión, tienda joyería y orfebrería, Cafe La Catalina, empanadas, almojábana, broca, plata pura 1000 bolsas de 10 gramos, lijas, segueta, alicate, fresas cónicas, engaste, lima, buril, borrador');

    try {
        const whisperResponse = await axios.post(
            'https://api.openai.com/v1/audio/transcriptions',
            formData,
            {
                headers: {
                    'Authorization': `Bearer ${OPENAI_API_KEY}`
                },
                timeout: 90000
            }
        );

        const transcribedText = whisperResponse.data?.text || '';
        logInfo(`[Voice] Whisper completado en ${Date.now() - tWhisper}ms (total: ${Date.now() - tStart}ms): "${transcribedText}"`);
        return transcribedText.trim();
    } catch (err: any) {
        logError(`[Voice] Whisper falló en ${Date.now() - tWhisper}ms:`, err);
        throw new Error(`OpenAI Whisper excedió el tiempo o falló: ${err.message}`);
    }
}
