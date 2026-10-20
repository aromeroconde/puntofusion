import fs from 'fs';
import path from 'path';

const LOG_FILE = process.env['BOT_LOG_FILE'] || path.resolve(process.cwd(), 'bot.log');

export function logInfo(message: string, meta?: any) {
    const timestamp = new Date().toISOString();
    const metaStr = meta !== undefined ? ' ' + (typeof meta === 'object' ? JSON.stringify(meta) : String(meta)) : '';
    const line = `[${timestamp}] [INFO] ${message}${metaStr}\n`;
    process.stdout.write(line);
    try {
        fs.appendFileSync(LOG_FILE, line);
    } catch {}
}

export function logWarn(message: string, meta?: any) {
    const timestamp = new Date().toISOString();
    const metaStr = meta !== undefined ? ' ' + (typeof meta === 'object' ? JSON.stringify(meta) : String(meta)) : '';
    const line = `[${timestamp}] [WARN] ${message}${metaStr}\n`;
    process.stdout.write(line);
    try {
        fs.appendFileSync(LOG_FILE, line);
    } catch {}
}

export function logError(message: string, err?: any) {
    const timestamp = new Date().toISOString();
    let errStr = '';
    if (err) {
        if (err.response) {
            errStr = ` [HTTP ${err.response.status}] ${JSON.stringify(err.response.data)}`;
        }
        if (err.stack) {
            errStr += `\nStack: ${err.stack}`;
        } else if (err.message) {
            errStr += ` Message: ${err.message}`;
        } else {
            errStr += ` ${JSON.stringify(err)}`;
        }
    }
    const line = `[${timestamp}] [ERROR] ${message}${errStr}\n`;
    process.stderr.write(line);
    try {
        fs.appendFileSync(LOG_FILE, line);
    } catch {}
}
