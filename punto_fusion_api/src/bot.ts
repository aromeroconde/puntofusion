import { Bot } from 'grammy';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import { processConversationMessage, resetSession } from './lib/orderAgent.js';
import { transcribeTelegramVoice } from './lib/transcriber.js';
import { generateDailyAccountStatement } from './lib/dailyReport.js';
import { supabase } from './supabase.js';
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

// Registro en memoria de chats activos para el cierre programado
export const activeChatIds = new Set<number>();

bot.use(async (ctx, next) => {
    if (ctx.chat?.id) {
        activeChatIds.add(ctx.chat.id);
    }
    await next();
});

// Comando /reporte, /cierre, /resumen o /estadodecuenta
bot.command(['reporte', 'resumen', 'cierre', 'estadodecuenta'], async (ctx) => {
    await ctx.replyWithChatAction('typing');
    try {
        logInfo(`[Chat ${ctx.chat.id}] Solicitud de estado de cuenta vía comando /${ctx.message?.text?.split(' ')[0]}`);
        const statement = await generateDailyAccountStatement();
        await ctx.reply(statement, { parse_mode: 'Markdown' });
    } catch (err: any) {
        logError('Error generando estado de cuenta por comando:', err);
        await ctx.reply(`❌ Error generando el estado de cuenta: ${err.message}`);
    }
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
        logInfo(`[Chat ${ctx.chat.id}] Bot responde a @${username}:\n${response}`);
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
        logInfo(`[Chat ${ctx.chat.id}] Bot responde a @${username}:\n${response}`);
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

let lastReportDateSent = '';

function startDailyReportScheduler() {
    logInfo('🕒 Programador de cierre de jornada diario iniciado (hora objetivo: 18:30 Costa Rica).');
    
    // Verificar cada 60 segundos si es hora del cierre del día (18:30 Costa Rica / 6:30 PM)
    setInterval(async () => {
        try {
            const now = new Date();
            const dateStrCR = now.toLocaleDateString('en-CA', { timeZone: 'America/Costa_Rica' });
            const timeParts = now.toLocaleTimeString('en-US', { timeZone: 'America/Costa_Rica', hour12: false }).split(':');
            const hour = parseInt(timeParts[0] || '0', 10);
            const minute = parseInt(timeParts[1] || '0', 10);

            // Hora objetivo: 18:30 (6:30 PM Costa Rica)
            if (hour === 18 && minute === 30 && lastReportDateSent !== dateStrCR) {
                lastReportDateSent = dateStrCR;
                logInfo(`⏰ Disparando envío automático del estado de cuenta de cierre (${dateStrCR} 18:30 CR)...`);

                const statement = await generateDailyAccountStatement(dateStrCR);
                
                // Destinatarios: chats activos en memoria + últimos de la base de datos
                const recipientChats = new Set<number>(activeChatIds);
                
                const { data: dbChats } = await supabase
                    .from('pf_daily_orders')
                    .select('chat_id')
                    .not('chat_id', 'is', null)
                    .order('created_at', { ascending: false })
                    .limit(20);

                if (dbChats) {
                    for (const r of dbChats) {
                        const num = Number(r.chat_id);
                        if (!isNaN(num) && num !== 0) recipientChats.add(num);
                    }
                }

                if (process.env['TELEGRAM_REPORT_CHAT_ID']) {
                    const envChats = process.env['TELEGRAM_REPORT_CHAT_ID'].split(',').map(s => Number(s.trim()));
                    envChats.forEach(id => { if (!isNaN(id) && id !== 0) recipientChats.add(id); });
                }

                const finalMsg = `🔔 *CIERRE AUTOMÁTICO DE JORNADA*\n\n` + statement;
                for (const targetChatId of recipientChats) {
                    try {
                        await bot.api.sendMessage(targetChatId, finalMsg, { parse_mode: 'Markdown' });
                        logInfo(`✅ Estado de cuenta automático enviado al chat ${targetChatId}`);
                    } catch (sendErr: any) {
                        logError(`⚠️ No se pudo enviar el reporte automático al chat ${targetChatId}:`, sendErr.message);
                    }
                }
            }
        } catch (err: any) {
            logError('❌ Error en scheduler de estado de cuenta:', err);
        }
    }, 60000);
}

export async function startBot() {
    logInfo('🤖 Iniciando bot conversacional de Telegram (@PuntoFusionShopBot)...');
    startDailyReportScheduler();
    bot.start({
        onStart: (info) => {
            logInfo(`✅ Bot @${info.username} iniciado (100% conversacional, voz y texto, sin botones).`);
        }
    });
}
