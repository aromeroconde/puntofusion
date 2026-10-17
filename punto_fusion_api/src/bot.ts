import { Bot } from 'grammy';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import { processConversationMessage, resetSession } from './lib/orderAgent.js';
import { transcribeTelegramVoice } from './lib/transcriber.js';

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
    console.error('🔴 Error capturado en bot de Telegram:', err.error || err);
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
        const response = await processConversationMessage(ctx.chat.id, text, username);
        await ctx.reply(response, { parse_mode: 'Markdown' });
    } catch (error: any) {
        console.error('Error procesando mensaje:', error);
        await ctx.reply(`❌ Ocurrió un error: ${error.message}`);
    }
});

// Manejador de notas de voz y audios
bot.on(['message:voice', 'message:audio'], async (ctx) => {
    await ctx.replyWithChatAction('typing');

    try {
        const fileId = ctx.message.voice?.file_id || ctx.message.audio?.file_id;
        if (!fileId) {
            await ctx.reply('❌ No se encontró el archivo de audio.');
            return;
        }

        const statusMsg = await ctx.reply('🎙️ _Escuchando tu nota de voz..._', { parse_mode: 'Markdown' });
        const transcribedText = await transcribeTelegramVoice(fileId);

        if (!transcribedText) {
            await ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id, '❌ No se detectó ninguna voz en el audio.');
            return;
        }

        // Mostrar lo que se escuchó
        await ctx.api.editMessageText(
            ctx.chat.id,
            statusMsg.message_id,
            `🎙️ *Nota de voz:* _"${transcribedText}"_`,
            { parse_mode: 'Markdown' }
        );

        // Procesar en la conversación
        const username = ctx.from?.username || ctx.from?.first_name || 'Asesor';
        const response = await processConversationMessage(ctx.chat.id, transcribedText, username);
        await ctx.reply(response, { parse_mode: 'Markdown' });

    } catch (error: any) {
        console.error('Error al procesar audio:', error);
        await ctx.reply(`❌ Error procesando la nota de voz: ${error.message}`);
    }
});

export async function startBot() {
    console.log('🤖 Iniciando bot conversacional de Telegram (@PuntoFusionShopBot)...');
    bot.start({
        onStart: (info) => {
            console.log(`✅ Bot @${info.username} iniciado (100% conversacional, voz y texto, sin botones).`);
        }
    });
}
