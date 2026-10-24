import { supabase } from '../supabase.js';
import { getShopifyClient } from './shopify.js';
import { logInfo, logError } from './logger.js';

export interface RecordOrderItem {
    variantId?: number | string | null | undefined;
    title: string;
    quantity: number;
    price: number | string;
}

export interface RecordOrderParams {
    shopifyOrderId?: string | number | null | undefined;
    orderNumber: string;
    isDraft?: boolean | undefined;
    customerName: string;
    customerPhone?: string | null | undefined;
    advisorUsername?: string | null | undefined;
    chatId?: string | number | null | undefined;
    totalPrice: number | string;
    currency?: string | undefined;
    items: RecordOrderItem[];
    source?: string | undefined;
    note?: string | null | undefined;
}

/**
 * Formatea un monto numérico en formato de Colones de Costa Rica (₡XX.XXX)
 */
export function formatCRC(amount: number | string): string {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(num)) return '₡0';
    // Formato con separador de miles '.' sin decimales innecesarios
    const parts = Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `₡${parts}`;
}

/**
 * Guarda una orden en Supabase (pf_daily_orders y pf_daily_order_items)
 */
export async function recordOrderInSupabase(params: RecordOrderParams): Promise<string | null> {
    try {
        const total = typeof params.totalPrice === 'string' ? parseFloat(params.totalPrice) : params.totalPrice;
        
        // 1. Insertar en pf_daily_orders
        const { data: orderData, error: orderError } = await supabase
            .from('pf_daily_orders')
            .insert({
                shopify_order_id: params.shopifyOrderId ? String(params.shopifyOrderId) : null,
                order_number: params.orderNumber,
                is_draft: !!params.isDraft,
                customer_name: params.customerName.trim(),
                customer_phone: params.customerPhone || null,
                advisor_username: params.advisorUsername || null,
                chat_id: params.chatId ? String(params.chatId) : null,
                total_price: isNaN(total) ? 0 : total,
                currency: params.currency || 'CRC',
                items: params.items,
                source: params.source || 'telegram_bot',
                note: params.note || null
            })
            .select('id')
            .single();

        if (orderError) {
            logError('❌ Error insertando orden en Supabase pf_daily_orders:', orderError);
            return null;
        }

        const orderId = orderData.id;

        // 2. Insertar ítems en pf_daily_order_items
        if (params.items && params.items.length > 0) {
            const itemsToInsert = params.items.map(it => {
                const price = typeof it.price === 'string' ? parseFloat(it.price) : (it.price || 0);
                const qty = it.quantity || 1;
                return {
                    order_id: orderId,
                    shopify_order_id: params.shopifyOrderId ? String(params.shopifyOrderId) : null,
                    customer_name: params.customerName.trim(),
                    variant_id: it.variantId ? String(it.variantId) : null,
                    product_title: it.title || 'Producto',
                    quantity: qty,
                    unit_price: isNaN(price) ? 0 : price,
                    subtotal: isNaN(price) ? 0 : (price * qty)
                };
            });

            const { error: itemsError } = await supabase
                .from('pf_daily_order_items')
                .insert(itemsToInsert);

            if (itemsError) {
                logError('⚠️ Error insertando ítems en Supabase pf_daily_order_items:', itemsError);
            }
        }

        logInfo(`💾 Orden ${params.orderNumber} para ${params.customerName} guardada en Supabase (UUID: ${orderId})`);
        return orderId;
    } catch (err: any) {
        logError('❌ Excepción al guardar orden en Supabase:', err);
        return null;
    }
}

/**
 * Sincroniza órdenes desde Shopify hacia Supabase para una fecha dada (CR time)
 * Garantiza que pedidos tomados por fuera o antes del despliegue queden registrados.
 */
export async function syncShopifyOrdersForDate(targetDateStr?: string): Promise<number> {
    try {
        const targetDate = targetDateStr || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Costa_Rica' });
        const client = await getShopifyClient();

        // Rango de búsqueda: desde ayer para asegurar cubrir todo el día según zona horaria
        const yesterday = new Date(Date.now() - 36 * 60 * 60 * 1000);
        const [ordersRes, draftsRes] = await Promise.all([
            client.get('/orders.json?status=any&created_at_min=' + yesterday.toISOString() + '&limit=100').catch(() => ({ data: { orders: [] } })),
            client.get('/draft_orders.json?status=any&limit=50').catch(() => ({ data: { draft_orders: [] } }))
        ]);

        const rawOrders = [
            ...((ordersRes.data?.orders || []).map((o: any) => ({ ...o, isDraft: false }))),
            ...((draftsRes.data?.draft_orders || []).map((d: any) => ({ ...d, isDraft: true })))
        ];

        // Filtrar órdenes que corresponden a la fecha de Costa Rica
        const matchingOrders = rawOrders.filter(o => {
            const oDateCR = new Date(o.created_at).toLocaleDateString('en-CA', { timeZone: 'America/Costa_Rica' });
            return oDateCR === targetDate;
        });

        if (matchingOrders.length === 0) return 0;

        // Consultar cuáles ya están en Supabase
        const shopifyIds = matchingOrders.map(o => String(o.id));
        const { data: existingRows } = await supabase
            .from('pf_daily_orders')
            .select('shopify_order_id')
            .in('shopify_order_id', shopifyIds);

        const existingSet = new Set((existingRows || []).map((r: any) => String(r.shopify_order_id)));

        let newSynced = 0;
        for (const o of matchingOrders) {
            if (existingSet.has(String(o.id))) continue;

            const custName = o.customer 
                ? `${o.customer.first_name || ''} ${o.customer.last_name || ''}`.trim()
                : (o.billing_address ? `${o.billing_address.first_name || ''} ${o.billing_address.last_name || ''}`.trim() : 'Cliente sin nombre');

            const items: RecordOrderItem[] = (o.line_items || []).map((li: any) => ({
                variantId: li.variant_id,
                title: li.title || li.name || 'Producto',
                quantity: li.quantity || 1,
                price: parseFloat(li.price || '0')
            }));

            const createdDate = new Date(o.created_at);

            // Insertar con la fecha original de creación de la orden
            const total = parseFloat(o.total_price || '0');
            const { data: insertedOrder, error: insErr } = await supabase
                .from('pf_daily_orders')
                .insert({
                    shopify_order_id: String(o.id),
                    order_number: o.name || `#${o.order_number || o.id}`,
                    is_draft: !!o.isDraft,
                    customer_name: custName || 'Cliente',
                    customer_phone: o.customer?.phone || null,
                    advisor_username: o.tags?.includes('telegram-bot') ? 'TelegramBot' : 'Shopify',
                    total_price: isNaN(total) ? 0 : total,
                    currency: o.currency || 'CRC',
                    items: items,
                    source: o.tags?.includes('telegram-bot') ? 'telegram_bot' : 'shopify_sync',
                    note: o.note || null,
                    created_at: createdDate.toISOString()
                })
                .select('id')
                .single();

            if (!insErr && insertedOrder) {
                if (items.length > 0) {
                    const itemRows = items.map(it => {
                        const price = typeof it.price === 'string' ? parseFloat(it.price) : (it.price || 0);
                        const qty = it.quantity || 1;
                        return {
                            order_id: insertedOrder.id,
                            shopify_order_id: String(o.id),
                            customer_name: custName || 'Cliente',
                            variant_id: it.variantId ? String(it.variantId) : null,
                            product_title: it.title,
                            quantity: qty,
                            unit_price: price,
                            subtotal: price * qty,
                            created_at: createdDate.toISOString()
                        };
                    });
                    await supabase.from('pf_daily_order_items').insert(itemRows);
                }
                newSynced++;
            }
        }

        if (newSynced > 0) {
            logInfo(`🔄 Sincronizadas ${newSynced} órdenes de Shopify del día ${targetDate} a Supabase.`);
        }
        return newSynced;
    } catch (err: any) {
        logError('❌ Error sincronizando órdenes de Shopify:', err);
        return 0;
    }
}

export interface StudentDailySummary {
    customerName: string;
    totalAmount: number;
    orders: Array<{
        orderNumber: string;
        isDraft: boolean;
        items: RecordOrderItem[];
    }>;
    aggregatedItems: Map<string, { title: string; quantity: number; subtotal: number }>;
}

/**
 * Genera el estado de cuenta consolidado por alumno para una fecha en específico (por defecto hoy en Costa Rica).
 */
export async function generateDailyAccountStatement(targetDateStr?: string): Promise<string> {
    const todayCR = targetDateStr || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Costa_Rica' });

    // 1. Sincronizar primero para garantizar que nada quede por fuera
    await syncShopifyOrdersForDate(todayCR);

    // 2. Consultar todas las órdenes de Supabase para este día
    // En Costa Rica (UTC-6), el día va de [todayCR 00:00:00-06] a [todayCR 23:59:59.999-06]
    const startOfDayUTC = new Date(`${todayCR}T00:00:00-06:00`).toISOString();
    const endOfDayUTC = new Date(`${todayCR}T23:59:59.999-06:00`).toISOString();

    const { data: orders, error } = await supabase
        .from('pf_daily_orders')
        .select('*')
        .gte('created_at', startOfDayUTC)
        .lte('created_at', endOfDayUTC)
        .order('created_at', { ascending: true });

    if (error) {
        logError('❌ Error consultando pf_daily_orders en Supabase:', error);
        return `❌ Ocurrió un error al consultar el estado de cuenta en la base de datos: ${error.message}`;
    }

    // Formatear encabezado de fecha
    const parts = todayCR.split('-').map(Number);
    const year = parts[0] || new Date().getFullYear();
    const month = parts[1] || (new Date().getMonth() + 1);
    const day = parts[2] || new Date().getDate();
    const dateObj = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    const dateOptions: Intl.DateTimeFormatOptions = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        timeZone: 'UTC'
    };
    const dateFormatted = dateObj.toLocaleDateString('es-CR', dateOptions);
    const dateCapitalized = dateFormatted.charAt(0).toUpperCase() + dateFormatted.slice(1);

    const nowCR = new Date().toLocaleTimeString('es-CR', { 
        timeZone: 'America/Costa_Rica', 
        hour: '2-digit', 
        minute: '2-digit', 
        hour12: true 
    });

    if (!orders || orders.length === 0) {
        return `📊 *ESTADO DE CUENTA DIARIO - ALUMNOS*\n` +
               `📅 *Fecha:* ${dateCapitalized}\n` +
               `⏰ *Generado:* ${nowCR} (Costa Rica)\n\n` +
               `ℹ️ _No se registran compras ni pedidos de alumnos para el día de hoy._`;
    }

    // 3. Consolidar por alumno
    const studentsMap = new Map<string, StudentDailySummary>();
    let grandTotal = 0;

    for (const order of orders) {
        const rawName = (order.customer_name || 'Sin nombre').trim();
        // Clave normalizada para agrupar variaciones leves de mayúsculas/minúsculas
        const normKey = rawName.toLowerCase();

        let summary = studentsMap.get(normKey);
        if (!summary) {
            summary = {
                customerName: rawName,
                totalAmount: 0,
                orders: [],
                aggregatedItems: new Map()
            };
            studentsMap.set(normKey, summary);
        }

        const orderTotal = parseFloat(order.total_price || '0');
        summary.totalAmount += orderTotal;
        grandTotal += orderTotal;

        const items: RecordOrderItem[] = Array.isArray(order.items) ? order.items : [];
        summary.orders.push({
            orderNumber: order.order_number,
            isDraft: !!order.is_draft,
            items: items
        });

        // Consolidar ítems del alumno
        for (const it of items) {
            const itTitle = it.title || 'Producto';
            const itPrice = typeof it.price === 'string' ? parseFloat(it.price) : (it.price || 0);
            const itQty = it.quantity || 1;
            const subtotal = itPrice * itQty;

            const existingAgg = summary.aggregatedItems.get(itTitle);
            if (existingAgg) {
                existingAgg.quantity += itQty;
                existingAgg.subtotal += subtotal;
            } else {
                summary.aggregatedItems.set(itTitle, {
                    title: itTitle,
                    quantity: itQty,
                    subtotal: subtotal
                });
            }
        }
    }

    // 4. Armar el reporte en Markdown
    let report = `📊 *ESTADO DE CUENTA DIARIO - ALUMNOS*\n`;
    report += `📅 *Fecha:* ${dateCapitalized}\n`;
    report += `⏰ *Hora:* ${nowCR} (Costa Rica)\n`;
    report += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    // Ordenar alumnos alfabéticamente
    const sortedStudents = Array.from(studentsMap.values()).sort((a, b) => 
        a.customerName.localeCompare(b.customerName, 'es', { sensitivity: 'base' })
    );

    for (const student of sortedStudents) {
        report += `👤 *${student.customerName}*\n`;
        
        // Detalle de ítems consolidados
        for (const item of student.aggregatedItems.values()) {
            report += `  • ${item.quantity}x ${item.title} (${formatCRC(item.subtotal)})\n`;
        }

        // Números de orden asociados
        const orderRefs = student.orders.map(o => o.orderNumber).join(', ');
        report += `  _Ref: ${orderRefs}_\n`;
        report += `  👉 *Total a pagar:* *${formatCRC(student.totalAmount)}*\n\n`;
    }

    report += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    report += `💰 *GRAN TOTAL DEL DÍA:* *${formatCRC(grandTotal)}*\n`;
    report += `👥 *Total Alumnos:* ${sortedStudents.length}\n`;
    report += `📦 *Total Pedidos:* ${orders.length}\n`;

    return report;
}

/**
 * Determina si un mensaje de texto solicita el estado de cuenta diario.
 */
export function isDailyReportRequest(text: string): boolean {
    if (!text) return false;
    const clean = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // Comandos directos
    if (clean === '/reporte' || clean === '/resumen' || clean === '/estadodecuenta' || clean === '/cierre') {
        return true;
    }

    // Patrones de lenguaje natural
    const patterns = [
        /estado de cuenta/i,
        /valor a pagar/i,
        /compras de alumnos/i,
        /consolida el valor/i,
        /cuanto deben los alumnos/i,
        /cuanto debe cada alumno/i,
        /pedidos del dia/i,
        /ventas de hoy/i,
        /cierre del dia/i,
        /cierre de hoy/i,
        /cuentas del dia/i,
        /reporte del dia/i,
        /reporte de hoy/i
    ];

    return patterns.some(p => p.test(clean));
}
