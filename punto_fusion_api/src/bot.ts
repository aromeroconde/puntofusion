import { Bot } from 'grammy';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import { processConversationMessage, resetSession } from './lib/orderAgent.js';
import { transcribeTelegramVoice } from './lib/transcriber.js';
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

// Comando /start o /reiniciar
bot.command(['start', 'reiniciar', 'nuevo'], async (ctx) => {
    resetSession(ctx.chat.id);
    await ctx.reply(
        `👋 *¡Hola! Soy el asistente interno de pedidos de Punto Fusión.*\n\n` +
        `Puedes hablarme por **nota de voz** o **escribirme** en lenguaje natural y mantendré la conversación hasta confirmar el pedido en Shopify.\n\n` +
        `📝 *Ejemplo por voz o texto:*\n` +
        `_"fresas cónicas para engaste para Marta Peraza en borrador"_\n` +
        `_"una cegueta de 15 cm para Pepito Pérez"_\n\n` +
        `_(Si en algún momento deseas empezar de cero, envía /reiniciar)_`,
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
        await ctx.reply(response, { parse_mode: 'Markdown' });
    } catch (error: any) {
        logError(`[Chat ${ctx.chat.id}] Error procesando mensaje de texto:`, error);
        await ctx.reply(`❌ Ocurrió un error al procesar tu solicitud: ${error.message}`);
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
        await ctx.reply(response, { parse_mode: 'Markdown' });

    } catch (error: any) {
        logError(`[Chat ${ctx.chat.id}] Error procesando audio:`, error);
        
        let userMsg = `❌ Error procesando la nota de voz: ${error.message}`;
        if (error.message && (error.message.toLowerCase().includes('timeout') || error.message.toLowerCase().includes('excedió el tiempo'))) {
            userMsg = `⚠️ *Tiempo de espera agotado al procesar el audio*\n\n` +
                      `La descarga desde Telegram o la transcripción tardó más de lo habitual debido a congestión de la red.\n\n` +
                      `👉 Por favor reenvía la nota de voz o, si prefieres, escríbeme el pedido en texto.`;
        }

        await ctx.reply(userMsg, { parse_mode: 'Markdown' });
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
