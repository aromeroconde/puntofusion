import { Bot, Context } from 'grammy';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import { processConversationMessage, resetSession, handlePriceInquiry } from './lib/orderAgent.js';
import { transcribeTelegramVoice } from './lib/transcriber.js';
import { generateDailyAccountStatement } from './lib/dailyReport.js';
import { logInfo, logError } from './lib/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const TELEGRAM_BOT_TOKEN = process.env['TELEGRAM_BOT_TOKEN'] || '';

if (!TELEGRAM_BOT_TOKEN) {
    console.error('❌ TELEGRAM_BOT_TOKEN no está definido en el archivo .env');
    process.exit(1);
}

export const bot = new Bot(TELEGRAM_BOT_TOKEN);

bot.catch((err) => {
    logError('🔴 Error capturado en bot de Telegram:', err.error || err);
});

/**
 * Envía respuestas a Telegram asegurando:
 * 1. Chunking inteligente si el mensaje excede el límite de 4096 caracteres de Telegram.
 * 2. Fallback a texto plano si falla el parseo de Markdown (evita 400 Bad Request).
 */
export async function replySafely(ctx: Context, fullText: string): Promise<void> {
    const MAX_CHUNK_LENGTH = 3800; // Margen de seguridad sobre el límite de 4096

    if (!fullText) return;

    if (fullText.length <= MAX_CHUNK_LENGTH) {
        try {
            await ctx.reply(fullText, { parse_mode: 'Markdown' });
            return;
        } catch (err: any) {
            logError('Error enviando con parse_mode Markdown, reintentando sin formato:', err);
            await ctx.reply(fullText);
            return;
        }
    }

    // Dividir en bloques respetando saltos de párrafo/alumnos
    const chunks: string[] = [];
    const paragraphs = fullText.split('\n\n');
    let currentChunk = '';

    for (const para of paragraphs) {
        if ((currentChunk + '\n\n' + para).length > MAX_CHUNK_LENGTH) {
            if (currentChunk.trim().length > 0) {
                chunks.push(currentChunk.trim());
                currentChunk = '';
            }
            if (para.length > MAX_CHUNK_LENGTH) {
                const lines = para.split('\n');
                for (const line of lines) {
                    if ((currentChunk + '\n' + line).length > MAX_CHUNK_LENGTH) {
                        if (currentChunk.trim().length > 0) {
                            chunks.push(currentChunk.trim());
                            currentChunk = '';
                        }
                    }
                    currentChunk = currentChunk ? `${currentChunk}\n${line}` : line;
                }
            } else {
                currentChunk = para;
            }
        } else {
            currentChunk = currentChunk ? `${currentChunk}\n\n${para}` : para;
        }
    }

    if (currentChunk.trim().length > 0) {
        chunks.push(currentChunk.trim());
    }

    for (const chunk of chunks) {
        try {
            await ctx.reply(chunk, { parse_mode: 'Markdown' });
        } catch {
            await ctx.reply(chunk);
        }
    }
}

// Comando /reporte, /cierre, /resumen o /estadodecuenta
bot.command(['reporte', 'resumen', 'cierre', 'estadodecuenta'], async (ctx) => {
    await ctx.replyWithChatAction('typing');
    try {
        logInfo(`[Chat ${ctx.chat.id}] Solicitud de estado de cuenta vía comando /${ctx.message?.text?.split(' ')[0]}`);
        const statement = await generateDailyAccountStatement();
        await replySafely(ctx, statement);
    } catch (err: any) {
        logError('Error generando estado de cuenta por comando:', err);
        await replySafely(ctx, `❌ Error generando el estado de cuenta: ${err.message}`);
    }
});

// Comando /precio o /precios
bot.command(['precio', 'precios'], async (ctx) => {
    const query = ctx.match?.trim();
    if (!query) {
        await replySafely(
            ctx,
            `🏷️ *Consulta de precios:*\n\n` +
            `Por favor escribe el nombre del producto después del comando.\n` +
            `_Ejemplos:_\n` +
            `• \`/precio hilo 1mm\`\n` +
            `• \`/precio esmeralda 2mm\`\n` +
            `• \`/precio almojabana\`\n` +
            `• \`/precio piedras calibradas\`\n\n` +
            `_O simplemente pregúntame por voz o texto: "¿A cómo está el hilo de 1mm?"_`
        );
        return;
    }

    await ctx.replyWithChatAction('typing');
    try {
        logInfo(`[Chat ${ctx.chat.id}] Consulta de precio por comando /precio: "${query}"`);
        const response = await handlePriceInquiry(ctx.chat.id, query);
        await replySafely(ctx, response);
    } catch (err: any) {
        logError('Error consultando precio por comando:', err);
        await replySafely(ctx, `❌ Error consultando el precio: ${err.message}`);
    }
});

// Comando /start o /reiniciar
bot.command(['start', 'reiniciar', 'nuevo'], async (ctx) => {
    resetSession(ctx.chat.id);
    await ctx.reply(
        `👋 *¡Hola! Soy el asistente interno de Punto Fusión.*\n\n` +
        `Puedes hablarme por **nota de voz** o **escribirme** en lenguaje natural para gestionar pedidos, consultar consumos o consultar precios de productos.\n\n` +
        `📝 *Ejemplos por voz o texto:*\n` +
        `• _"fresas cónicas para engaste para Marta Peraza" (Pedido)_\n` +
        `• _"¿A cómo está el hilo de 1mm?" (Consulta de precio)_\n` +
        `• _"¿Cuánto valen las piedras calibradas?" (Consulta de precio)_\n` +
        `• _"Dame el consumo de Caro Madrigal de esta semana" (Reporte)_\n\n` +
        `_(Comandos directos: /precio [producto], /reporte, /reiniciar)_`,
        { parse_mode: 'Markdown' }
    );
});

// Manejador central de mensajes de texto
bot.on('message:text', async (ctx) => {
    const text = ctx.message.text.trim();
    if (text.startsWith('/')) return;

    await ctx.replyWithChatAction('typing');

    try {
        const username = ctx.from?.username || ctx.from?.first_name || 'Asesor';
        logInfo(`[Chat ${ctx.chat.id}] Texto recibido de @${username}: "${text}"`);
        const response = await processConversationMessage(ctx.chat.id, text, username);
        logInfo(`[Chat ${ctx.chat.id}] Bot responde a @${username}:\n${response}`);
        await replySafely(ctx, response);
    } catch (error: any) {
        logError(`[Chat ${ctx.chat.id}] Error procesando mensaje de texto:`, error);
        await replySafely(ctx, `❌ Ocurrió un error al procesar tu solicitud: ${error.message}`);
    }
});

// Manejador de notas de voz y audios
bot.on(['message:voice', 'message:audio'], async (ctx) => {
    const username = ctx.from?.username || ctx.from?.first_name || 'Asesor';
    await ctx.replyWithChatAction('typing');

    // Mantener indicador de "escribiendo..." activo durante el procesamiento del audio
    const typingInterval = setInterval(() => {
        ctx.replyWithChatAction('typing').catch(() => {});
    }, 4000);

    try {
        const fileId = ctx.message.voice?.file_id || ctx.message.audio?.file_id;
        const duration = ctx.message.voice?.duration || ctx.message.audio?.duration || 0;
        if (!fileId) {
            await ctx.reply('❌ No se encontró el archivo de audio.');
            return;
        }

        const durMin = Math.floor(duration / 60);
        const durSec = duration % 60;
        const durStr = duration > 0 
            ? (durMin > 0 ? `${durMin}:${durSec.toString().padStart(2, '0')} min` : `${durSec}s`)
            : 'audio';

        logInfo(`[Chat ${ctx.chat.id}] Nota de voz recibida de @${username} (duración: ${duration}s, fileId: ${fileId})`);
        const statusMsg = await ctx.reply(`🎙️ _Descargando nota de voz (${durStr})..._`, { parse_mode: 'Markdown' });

        const transcribedText = await transcribeTelegramVoice(fileId, async (stage) => {
            if (stage === 'transcribing') {
                try {
                    await ctx.api.editMessageText(
                        ctx.chat.id,
                        statusMsg.message_id,
                        `🎙️ _Transcribiendo audio (${durStr}) con IA..._`,
                        { parse_mode: 'Markdown' }
                    );
                } catch {}
            }
        });

        if (!transcribedText) {
            await ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id, '❌ No se detectó ninguna voz en el audio.');
            return;
        }

        // Mostrar lo que se escuchó
        await ctx.api.editMessageText(
            ctx.chat.id,
            statusMsg.message_id,
            `🎙️ *Nota de voz (${durStr}):* _"${transcribedText}"_`,
            { parse_mode: 'Markdown' }
        );

        // Procesar en la conversación
        logInfo(`[Chat ${ctx.chat.id}] Procesando orden para: "${transcribedText}"`);
        const response = await processConversationMessage(ctx.chat.id, transcribedText, username);
        logInfo(`[Chat ${ctx.chat.id}] Bot responde a @${username}:\n${response}`);
        await replySafely(ctx, response);

    } catch (error: any) {
        logError(`[Chat ${ctx.chat.id}] Error procesando audio:`, error);
        
        let userMsg = `❌ Error procesando la nota de voz: ${error.message}`;
        if (error.message && (error.message.toLowerCase().includes('timeout') || error.message.toLowerCase().includes('excedió el tiempo'))) {
            userMsg = `⚠️ *Tiempo de espera agotado al procesar el audio*\n\n` +
                      `La descarga desde Telegram o la transcripción tardó más de lo habitual debido a congestión de la red.\n\n` +
                      `👉 Por favor reenvía la nota de voz o, si prefieres, escríbeme el pedido en texto.`;
        }

        await replySafely(ctx, userMsg);
    } finally {
        clearInterval(typingInterval);
    }
});

export async function startBot() {
    logInfo('🤖 Iniciando bot conversacional de Telegram (@PuntoFusionShopBot)...');
    bot.start({
        onStart: (info) => {
            logInfo(`✅ Bot @${info.username} iniciado (100% conversacional, voz y texto, sin botones).`);
        }
    });
}
