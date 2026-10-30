import axios from 'axios';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import { logInfo, logWarn, logError } from './logger.js';
import {
    getCatalogProducts,
    searchShopifyCustomers,
    searchShopifyCustomersSmart,
    searchProductsSmart,
    MatchedProductGroup,
    createShopifyOrder,
    createShopifyDraftOrder,
    checkTodayDuplicates,
    MatchedVariant,
    MatchedCustomer
} from './shopify.js';
import {
    recordOrderInSupabase,
    generateDailyAccountStatement,
    generateStudentConsumptionStatement,
    parseStudentConsumptionQuery,
    isDailyReportRequest
} from './dailyReport.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const OPENAI_API_KEY = process.env['OPENAI_API_KEY'] || '';
const OPENAI_MODEL = process.env['OPENAI_MODEL'] || 'gpt-6-luna';

export interface OrderItem {
    productTitle: string;
    variantTitle: string;
    variantId?: number | undefined;
    quantity: number;
    price: string;
    isCustom?: boolean | undefined;
}

export interface SessionCustomer {
    id?: number | undefined;
    name: string;
    phone?: string | undefined;
    isExisting?: boolean | undefined;
    ordersCount?: number | undefined;
}

export interface PendingVariantClarification {
    productTitle: string;
    quantity: number;
    variants: MatchedVariant[];
}

export interface PendingCustomerClarification {
    originalQuery: string;
    candidates: MatchedCustomer[];
}

export interface CustomProductSuggestion {
    productId: number;
    productTitle: string;
    variantId?: number;
    variantTitle: string;
    price: string;
}

export interface PendingCustomProductClarification {
    title: string;
    quantity: number;
    unitPrice: number;
    originalQuery: string;
    suggestions: CustomProductSuggestion[];
}

export interface ChatSession {
    chatId: number;
    customer: SessionCustomer | null;
    items: OrderItem[];
    wantsDraft: boolean;
    pendingVariant?: PendingVariantClarification | null;
    pendingCustomer?: PendingCustomerClarification | null;
    pendingCustomProduct?: PendingCustomProductClarification | null;
    pendingConfirmation: boolean;
    lastReportPeriod?: string;
    lastReportStudent?: string;
    lastUpdate: number;
}

const sessions = new Map<number, ChatSession>();

export function getSession(chatId: number): ChatSession {
    let session = sessions.get(chatId);
    if (!session) {
        session = {
            chatId,
            customer: null,
            items: [],
            wantsDraft: false,
            pendingVariant: null,
            pendingCustomer: null,
            pendingCustomProduct: null,
            pendingConfirmation: false,
            lastUpdate: Date.now()
        };
        sessions.set(chatId, session);
    }
    session.lastUpdate = Date.now();
    return session;
}

export function resetSession(chatId: number) {
    sessions.delete(chatId);
}

// Representación semántica y de alta legibilidad del catálogo para el prompt de la IA
function buildCatalogText(products: any[]): string {
    return products.map(p => {
        const vTitles = (p.variants || []).map((v: any) => v.title === 'Default Title' ? 'Único' : v.title).join(', ');
        const basePrice = p.variants?.[0]?.price ? ` (₡${parseFloat(p.variants[0].price).toLocaleString('es-CR')})` : '';
        return `- "${p.title}" [Variantes: ${vTitles}]${basePrice}`;
    }).join('\n');
}

export interface AIMatchedItem {
    product_title: string;
    variant_title: string;
    quantity: number;
}

export interface AICustomItem {
    title: string;
    quantity: number;
    unit_price: number;
}

export interface AINeedsClarification {
    product_title: string;
    quantity?: number | undefined;
}

export interface AIOrderAnalysis {
    intent?: 'order' | 'general_report' | 'student_report' | 'confirmation' | 'cancellation';
    student_name?: string | null;
    period?: string | null;
    is_cancellation?: boolean;
    is_confirmation?: boolean;
    is_report_request?: boolean;
    customer_name?: string | null;
    wants_draft?: boolean | null;
    matched_items: AIMatchedItem[];
    custom_items: AICustomItem[];
    needs_clarification: AINeedsClarification[];
    not_found: string[];
}

// Análisis 100% IA del mensaje contra el catálogo dinámico de Shopify
async function analyzeOrderWithAI(
    text: string,
    session: ChatSession,
    catalogText: string
): Promise<AIOrderAnalysis | null> {
    const prompt = `Eres el cerebro conversacional de ventas y operaciones con Inteligencia Artificial de la tienda "Punto Fusión" (taller/escuela de joyería, herramientas, metales y cafetería).
Tu misión es interpretar semánticamente el mensaje del asesor (texto o transcripción de audio) y clasificar su intención con total precisión:

CLASIFICACIÓN DE INTENCIÓN (intent):
1. "general_report": Cuando el usuario solicita un reporte general, cierre del día, consolidado, total de ventas, balance, o detalle de compras de todos los clientes/alumnos (ej: "Pásame el detalle x cliente", "Haz cierre del día", "Cómo van las ventas de hoy", "Cuánto se ha vendido hoy", "Dame el consolidado", "Cuentas del día", "Reporte general").
   - Define "period": el período solicitado si se menciona ("hoy", "ayer", "esta semana", "este mes", etc., por defecto "hoy").

2. "student_report": Cuando el usuario solicita el consumo, compras, saldo, cuenta o detalle de un alumno o cliente específico (ej: "dame el consumo de Caro Madrigal de esta semana", "cuánto debe Liliana", "qué ha pedido Marta hoy", "detalle de pedidos de Juan Manuel", "estado de cuenta de Pepito", "dame el mismo detalle para Marta").
   - Define "student_name": nombre del alumno extraído del mensaje (ej: "Caro Madrigal", "Liliana", "Marta").
   - Define "period": el período solicitado ("hoy", "ayer", "esta semana", "este mes", etc.). Si el usuario dice "el mismo detalle", "igual para", o no especifica un período, asigna como período el último consultado: "${session.lastReportPeriod || "hoy"}".

3. "cancellation": Cuando el usuario cancela la orden actual ("cancelar", "cancela", "olvídalo", "descartar").

4. "confirmation": Cuando el usuario confirma el pedido pendiente ("sí", "dale", "confirmar", "ok", "guardar").

5. "order": Cuando el usuario está ordenando productos, creando o modificando un pedido (ej: "una cegueta para Pepito", "2 empanadas y un café para Marta").

Catálogo actual de productos y variantes en Shopify:
${catalogText}

Estado actual de la sesión:
- Cliente actual: ${session.customer ? session.customer.name : "NINGUNO (FALTA INDICAR CLIENTE)"}
- Ítems ya en el pedido: ${JSON.stringify(session.items)}
- Esperando aclaración de variante: ${session.pendingVariant ? JSON.stringify(session.pendingVariant) : "NO"}
- Esperando confirmación final: ${session.pendingConfirmation ? "SÍ" : "NO"}
- Último período consultado en reportes: ${session.lastReportPeriod || "hoy"}

Mensaje nuevo del asesor:
"${text}"

Reglas semánticas clave para pedidos ("order"):
1. DISTINCIÓN CRÍTICA DE METALES:
   - "Plata 1000", "plata mil", "plata pura" o "bolsas de plata 1000" corresponde SIEMPRE al producto: "Plata pura (1000) bolsas de 10 gramos". (NO es Plata 950).
   - Medidas de hilo de plata (ej: "hilo 1mm", "hilo de 1 mm", "hilo 0.8mm", "hilo 2mm", "1 gramo de hilo 1mm", "hilo de plata 1 milímetro") corresponden al producto: "Hilo en plata 950 - por gramo" con su variante de medida correspondiente ("0.5mm", "0.8mm", "1mm", "2mm", "3mm", "3.4mm cuadrado"). Solo si piden "hilo delgado" sin medida corresponde a "Hilo en plata delgado - por gramo".
   - Láminas o chapas de plata con medida o espesor corresponden al producto: "Lamina en plata 950 - por gramo".
   - Tubos de plata con medida corresponden a: "Tubo en plata 950 - por gramo".
   - Bisel de plata corresponde a: "Bisel en plata 950 - por gramo".
   - "Plata 950" sin forma específica corresponde a "Plata 950".
2. PIEDRAS Y GEMAS:
   - "Piedras calibradas", "piedra calibrada" o gemas con medida (ej: "4 piedras calibradas de 1.5 milímetros", "esmeralda calibrada 2mm", "esmeralda 2mm", "piedras 2mm") corresponden a "Piedras Calibradas LG".
   - Si piden "esmeralda 2mm" o "esmeralda calibrada 2mm", la variante exacta en catálogo es "Esmeralda colombiana 2mm". Si piden 2.5mm es "Esmeralda colombiana 2.5mm".
   - Si piden medidas numéricas (1mm, 1.5mm, 2mm, 2.5mm, 3mm) corresponden a las variantes "1mm", "1.5mm", "2mm", "2.5mm", "3mm".
3. CAFETERÍA Y ALIMENTOS:
   - "Cafe La Catalina": Alimentos preparados y bebidas de cafetería (empanadas colombianas, almojábanas, pastelitos de plátano y yuca, café, té, granola, refrescos, cervezas). Usa la variante exacta correspondiente (ej: "Empanadas colombianas - unidad", "Almojabana - unidad").
   - "Helados la paletea": Helados, paletas, conos o sándwiches de helado corresponden SIEMPRE y ÚNICAMENTE al producto "Helados la paletea" (NUNCA a Cafe La Catalina).
4. HERRAMIENTAS: Medidas de brocas corresponden al producto: "Brocas- varias medidas" (ej: variante "0.9mm"). Lijas corresponden a "Lijas - diferentes granos".
5. ACLARACIÓN: Si el usuario pide un producto que tiene varias variantes y NO especificó cuál:
   - Si pide "un helado", colócalo en needs_clarification con product_title: "Helados la paletea".
   - Si estamos esperando variante y el usuario la indica (ej: "el cono sencillo" o "1"), identifícala en matched_items.
6. PRODUCTOS NO ENCONTRADOS O NUEVOS:
   - Si un producto NO figura en el catálogo o no estás seguro, colócalo en not_found.
   - Solo incluye en custom_items si el usuario pide explícitamente un ítem personalizado con precio o divisa específica (ej: "facturar 472 dólares" o "piedra de 75 dólares").
7. REGLA ANTI-DUPLICADOS CRÍTICA:
   - En matched_items y custom_items incluye ÚNICAMENTE productos NUEVOS pedidos expresamente en el "Mensaje nuevo del asesor".
   - NUNCA repitas productos que ya figuran en "Ítems ya en el pedido" con la misma variante o descripción.
   - Si el mensaje nuevo del asesor es solo un nombre de persona (ej: "Liliana"), una aclaración de cliente, o no menciona productos nuevos, devuelve matched_items: [] y custom_items: [].

Devuelve ÚNICAMENTE un JSON con esta estructura exacta:
{
  "intent": "general_report" | "student_report" | "order" | "confirmation" | "cancellation",
  "student_name": "Nombre de alumno si es student_report o null",
  "period": "hoy" | "ayer" | "esta_semana" | "este_mes" | null,
  "customer_name": "Nombre de cliente si se menciona o null",
  "wants_draft": true/false/null,
  "matched_items": [
    {
      "product_title": "Nombre exacto del producto según catálogo",
      "variant_title": "Nombre exacto de la variante según catálogo o 'Único'",
      "quantity": 1
    }
  ],
  "custom_items": [
    {
      "title": "Descripción",
      "quantity": 1,
      "unit_price": 39000
    }
  ],
  "needs_clarification": [
    {
      "product_title": "Nombre exacto del producto",
      "quantity": 1
    }
  ],
  "not_found": []
}`;

    try {
        const payload: any = {
            model: OPENAI_MODEL,
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: 'json_object' }
        };
        if (OPENAI_MODEL.startsWith('gpt-4')) {
            payload.temperature = 0.1;
        }

        const t0 = Date.now();
        logInfo(`[AI] Enviando prompt a ${OPENAI_MODEL}...`);
        const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            payload,
            {
                headers: {
                    'Authorization': `Bearer ${OPENAI_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                timeout: 45000
            }
        );

        const content = response.data.choices[0]?.message?.content;
        logInfo(`[AI] Respuesta recibida de ${OPENAI_MODEL} en ${Date.now() - t0}ms`);
        return content ? JSON.parse(content) : null;
    } catch (err: any) {
        logError('Error analizando con IA:', err);
        return null;
    }
}

// Resolver cliente en Shopify
async function resolveCustomer(name: string): Promise<SessionCustomer> {
    const matches = await searchShopifyCustomers(name);
    if (matches.length > 0) {
        const top = matches[0]!;
        return {
            id: top.id,
            name: top.fullName,
            phone: top.phone,
            isExisting: true,
            ordersCount: top.ordersCount
        };
    }
    return {
        name: name.trim(),
        isExisting: false,
        ordersCount: 0
    };
}

// Generar resumen y confirmación
async function generateSummaryText(session: ChatSession): Promise<string> {
    let total = 0;
    let itemsTxt = '';

    for (const item of session.items) {
        const subtotal = parseFloat(item.price) * item.quantity;
        total += subtotal;
        
        let itemLabel = item.productTitle;
        if (item.variantTitle && item.variantTitle !== 'Único' && item.variantTitle !== 'Default Title') {
            if (item.productTitle === 'Cafe La Catalina') {
                itemLabel = `${item.variantTitle} _(Cafetería)_`;
            } else {
                itemLabel = `${item.productTitle} _(${item.variantTitle})_`;
            }
        }
        
        itemsTxt += `• ${item.quantity}x *${itemLabel}* — ₡${subtotal.toLocaleString('es-CR')}\n`;
    }

    const customerTxt = session.customer!.isExisting
        ? `${session.customer!.name} _(Cliente habitual - ${session.customer!.ordersCount} pedidos)_`
        : `${session.customer!.name} _(Nuevo cliente)_`;

    const destino = session.wantsDraft ? 'Borradores (Draft Order)' : 'Pedidos Oficiales';

    let msg = `📋 *Resumen del Pedido Preparado*\n\n`;
    msg += `👤 *Cliente:* ${customerTxt}\n`;
    if (session.customer!.phone) msg += `📞 *Teléfono:* ${session.customer!.phone}\n`;
    msg += `\n📦 *Productos:*\n${itemsTxt}\n`;
    msg += `💰 *Total:* ₡${total.toLocaleString('es-CR')}\n`;
    msg += `📌 *Destino:* ${destino} de Shopify\n\n`;

    // Verificación de pedidos duplicados del mismo día
    let duplicateAlert = '';
    try {
        const duplicates = await checkTodayDuplicates(session.customer!, session.items);
        if (duplicates.length > 0) {
            duplicateAlert += `⚠️ *¡Atención! Posible pedido duplicado de hoy:*\n`;
            for (const dup of duplicates) {
                const tipo = dup.isDraft ? 'el borrador' : 'el pedido';
                duplicateAlert += `Ya existe ${tipo} *${dup.orderNumber}* (${dup.createdAtTime}) para este cliente con:\n`;
                for (const mItem of dup.matchingItems) {
                    duplicateAlert += `  • *${mItem}*\n`;
                }
            }
            duplicateAlert += `\n¿Confirmas que este es un *nuevo pedido adicional*, o deseas cancelarlo?\n_(Responde "sí" para registrarlo de todas formas o "cancelar")_`;
        }
    } catch (e: any) {
        console.error('Error verificando duplicados:', e);
    }

    if (duplicateAlert) {
        msg += duplicateAlert;
    } else {
        msg += `¿Confirmas para registrarlo en Shopify? _(Responde "sí" para confirmar o "cancelar")_`;
    }

    return msg;
}

/**
 * Prepara la pregunta interactiva antes de crear un producto nuevo / personalizado en Shopify.
 * Si existen productos o variantes similares en el catálogo oficial, los presenta numerados.
 */
async function prepareCustomProductQuestion(
    title: string,
    quantity: number,
    unitPrice: number,
    originalText: string,
    session: ChatSession
): Promise<string> {
    const searchGroups = await searchProductsSmart(title);
    const suggestions: CustomProductSuggestion[] = [];

    for (const g of searchGroups.slice(0, 3)) {
        if (g.score >= 35) {
            if (g.selectedVariant) {
                suggestions.push({
                    productId: g.productId,
                    productTitle: g.title,
                    variantId: g.selectedVariant.variantId,
                    variantTitle: g.selectedVariant.title,
                    price: g.selectedVariant.price
                });
            } else if (g.variants && g.variants.length > 0) {
                for (const v of g.variants.slice(0, 2)) {
                    suggestions.push({
                        productId: g.productId,
                        productTitle: g.title,
                        variantId: v.variantId,
                        variantTitle: v.title,
                        price: v.price
                    });
                }
            }
        }
    }

    session.pendingCustomProduct = {
        title,
        quantity,
        unitPrice,
        originalQuery: originalText,
        suggestions
    };

    let msg = '';
    if (session.items.length > 0) {
        msg += `✅ Productos listos en el pedido:\n`;
        for (const it of session.items) {
            const vDisplay = it.variantTitle && it.variantTitle !== 'Único' ? ` (${it.variantTitle})` : '';
            msg += `• ${it.quantity}x *${it.productTitle}*${vDisplay}\n`;
        }
        msg += `\n`;
    }

    if (suggestions.length > 0) {
        msg += `⚠️ No encontré *"${title}"* exactamente con ese nombre en el inventario.\n\n`;
        msg += `Encontré estas opciones que sí existen en el catálogo:\n`;
        suggestions.forEach((s, idx) => {
            const priceFormatted = parseFloat(s.price).toLocaleString('es-CR');
            msg += `${idx + 1}. *${s.productTitle}* _(${s.variantTitle})_ — ₡${priceFormatted}\n`;
        });
        const createIdx = suggestions.length + 1;
        const priceTxt = unitPrice > 0 ? ` (₡${unitPrice.toLocaleString('es-CR')})` : '';
        msg += `${createIdx}. *Crear como producto nuevo / personalizado*${priceTxt}\n\n`;
        msg += `¿Deseas seleccionar una opción del catálogo o crearlo como producto nuevo?\n`;
        msg += `_(Si el producto sí existe con otro nombre, dime cómo aparece para buscarlo)_`;
    } else {
        const priceTxt = unitPrice > 0 ? ` (₡${unitPrice.toLocaleString('es-CR')})` : '';
        msg += `⚠️ El producto *"${title}"* no aparece en el catálogo de Shopify.\n\n`;
        msg += `1. *El producto sí existe* (dime cómo aparece registrado en el inventario para buscarlo)\n`;
        msg += `2. *Crear como producto nuevo / personalizado*${priceTxt}\n\n`;
        msg += `¿Deseas buscarlo de nuevo o crearlo como producto nuevo?`;
    }

    return msg;
}

// Orquestador principal de mensajes conversacionales (100% IA Semántica)
export async function processConversationMessage(chatId: number, text: string, advisorUsername: string): Promise<string> {
    const session = getSession(chatId);

    // Cancelación inmediata por palabra clave directa
    const lowerText = text.toLowerCase().trim();
    if (lowerText === 'cancelar' || lowerText === 'cancela' || (lowerText === 'no' && session.pendingConfirmation && !session.pendingCustomer && !session.pendingCustomProduct)) {
        resetSession(chatId);
        return '❌ Pedido cancelado. La orden fue descartada. ¿En qué más te puedo ayudar?';
    }

    // 0a. Eliminación directa de ítems ("quita X", "elimina X", "borra X")
    const quitaMatch = lowerText.match(/^(?:quita|quitar|elimina|eliminar|borra|borrar)\s+(.+)$/i);
    if (quitaMatch && session.items.length > 0) {
        const target = quitaMatch[1]!.toLowerCase().trim();
        const removeIdx = session.items.findIndex(it => 
            it.productTitle.toLowerCase().includes(target) ||
            it.variantTitle.toLowerCase().includes(target) ||
            target.includes(it.productTitle.toLowerCase()) ||
            (it.variantTitle && target.includes(it.variantTitle.toLowerCase())) ||
            target.split(/\s+/).every(w => w.length >= 3 && (it.productTitle.toLowerCase().includes(w) || it.variantTitle.toLowerCase().includes(w)))
        );
        if (removeIdx >= 0) {
            const removed = session.items.splice(removeIdx, 1)[0]!;
            const rTitle = `${removed.productTitle}${removed.variantTitle && removed.variantTitle !== 'Único' ? ` (${removed.variantTitle})` : ''}`;
            if (session.items.length === 0) {
                session.pendingConfirmation = false;
                return `🗑️ Eliminé *${rTitle}* del pedido. El pedido quedó vacío. ¿Qué producto deseas agregar?`;
            }
            if (session.customer) {
                session.pendingConfirmation = true;
                const summary = await generateSummaryText(session);
                return `🗑️ Eliminé *${rTitle}* del pedido.\n\n` + summary;
            } else {
                return `🗑️ Eliminé *${rTitle}* del pedido.`;
            }
        }
    }

    // 0b. Respuesta directa a confirmación pendiente de creación de producto / aclaración fuera de catálogo
    if (session.pendingCustomProduct) {
        const pcp = session.pendingCustomProduct;
        const num = parseInt(lowerText, 10);
        const totalSuggestions = pcp.suggestions ? pcp.suggestions.length : 0;
        const createOptionNum = totalSuggestions + 1;

        let chosenAction: 'select_suggestion' | 'create_new' | 'search_again' | 'cancel' | null = null;
        let selectedSuggestionIdx = -1;

        if (lowerText === 'cancelar' || lowerText === 'descarta' || lowerText === 'descartar') {
            chosenAction = 'cancel';
        } else if (
            lowerText === 'crear' || lowerText === 'créalo' || lowerText === 'crealo' || 
            lowerText === 'es nuevo' || lowerText === 'nuevo' || lowerText === 'crear producto' ||
            lowerText === 'crear como nuevo' || lowerText.includes('si, crealo') || lowerText.includes('sí, créalo') ||
            lowerText === 'creelo' || lowerText === 'créelo' ||
            (!isNaN(num) && num === createOptionNum)
        ) {
            chosenAction = 'create_new';
        } else if (!isNaN(num) && num >= 1 && num <= totalSuggestions) {
            chosenAction = 'select_suggestion';
            selectedSuggestionIdx = num - 1;
        } else if (
            lowerText.includes('si existe') || lowerText.includes('sí existe') ||
            lowerText.includes('los productos si existen') || lowerText.includes('los productos sí existen') ||
            lowerText.includes('este producto si existe') || lowerText.includes('este producto sí existe') ||
            lowerText.includes('buscar de nuevo') || lowerText === 'buscar' || lowerText === 'no' ||
            (!isNaN(num) && totalSuggestions === 0 && num === 1)
        ) {
            chosenAction = 'search_again';
        }

        if (chosenAction === 'cancel') {
            const discarded = pcp.title;
            session.pendingCustomProduct = null;
            return `❌ Descarté *${discarded}*. ¿En qué más te puedo ayudar?`;
        }

        if (chosenAction === 'create_new') {
            session.items.push({
                productTitle: pcp.title,
                variantTitle: '',
                quantity: pcp.quantity || 1,
                price: pcp.unitPrice > 0 ? pcp.unitPrice.toString() : '0.00',
                isCustom: true
            });
            const createdTitle = pcp.title;
            session.pendingCustomProduct = null;

            if (session.customer && session.items.length > 0) {
                session.pendingConfirmation = true;
                const summary = await generateSummaryText(session);
                return `✅ Registrado como ítem nuevo/personalizado: *${createdTitle}*\n\n` + summary;
            }
            if (!session.customer) {
                return `✅ Registrado como ítem nuevo/personalizado: *${createdTitle}*.\n\n👤 ¿A nombre de qué cliente registramos este pedido? *(El cliente es obligatorio)*`;
            }
        }

        if (chosenAction === 'select_suggestion') {
            const sug = pcp.suggestions[selectedSuggestionIdx]!;
            session.items.push({
                productTitle: sug.productTitle,
                variantTitle: sug.variantTitle,
                variantId: sug.variantId,
                quantity: pcp.quantity || 1,
                price: sug.price
            });
            session.pendingCustomProduct = null;

            if (session.customer && session.items.length > 0) {
                session.pendingConfirmation = true;
                const summary = await generateSummaryText(session);
                return `✅ Producto agregado del catálogo: *${sug.productTitle} (${sug.variantTitle})*\n\n` + summary;
            }
            if (!session.customer) {
                return `✅ Producto agregado del catálogo: *${sug.productTitle} (${sug.variantTitle})*.\n\n👤 ¿A nombre de qué cliente registramos este pedido? *(El cliente es obligatorio)*`;
            }
        }

        if (chosenAction === 'search_again') {
            const cleanQuery = lowerText
                .replace(/(?:el producto|los productos|este producto)?\s*(?:si|sí)\s*existe(?:n)?/gi, '')
                .replace(/(?:buscar de nuevo|busca como|buscar como|búscalo como|busca|buscar|no)\s*/gi, '')
                .replace(/[,\.;:]/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();

            const queryToUse = cleanQuery.length >= 2 ? cleanQuery : pcp.title;
            const searchGroups = await searchProductsSmart(queryToUse);
            const newSuggestions: CustomProductSuggestion[] = [];

            for (const g of searchGroups.slice(0, 3)) {
                if (g.selectedVariant) {
                    newSuggestions.push({
                        productId: g.productId,
                        productTitle: g.title,
                        variantId: g.selectedVariant.variantId,
                        variantTitle: g.selectedVariant.title,
                        price: g.selectedVariant.price
                    });
                } else if (g.variants && g.variants.length > 0) {
                    for (const v of g.variants.slice(0, 2)) {
                        newSuggestions.push({
                            productId: g.productId,
                            productTitle: g.title,
                            variantId: v.variantId,
                            variantTitle: v.title,
                            price: v.price
                        });
                    }
                }
            }

            if (newSuggestions.length > 0) {
                pcp.suggestions = newSuggestions;
                let msg = `🔍 Busqué *"${queryToUse}"* en el catálogo y encontré estas opciones existentes:\n\n`;
                newSuggestions.forEach((s, idx) => {
                    const priceFormatted = parseFloat(s.price).toLocaleString('es-CR');
                    msg += `${idx + 1}. *${s.productTitle}* _(${s.variantTitle})_ — ₡${priceFormatted}\n`;
                });
                msg += `${newSuggestions.length + 1}. *Crear como producto nuevo / personalizado*\n\n`;
                msg += `¿Cuál de ellos deseas agregar o cómo aparece exactamente en Shopify?`;
                return msg;
            } else {
                return `🔍 Busqué *"${queryToUse}"* en el catálogo de Shopify pero no encontré ninguna coincidencia.\n\n` +
                       `Por favor dime: ¿cómo aparece exactamente registrado en el inventario de Shopify, o prefieres que lo cree como *producto nuevo*?`;
            }
        }

        // Si el usuario escribió un texto libre mientras estaba pendiente la confirmación del producto, buscarlo en catálogo
        const searchGroups = await searchProductsSmart(text.trim());
        if (searchGroups.length > 0 && searchGroups[0]!.score >= 35) {
            const newSuggestions: CustomProductSuggestion[] = [];
            for (const g of searchGroups.slice(0, 3)) {
                if (g.selectedVariant) {
                    newSuggestions.push({
                        productId: g.productId,
                        productTitle: g.title,
                        variantId: g.selectedVariant.variantId,
                        variantTitle: g.selectedVariant.title,
                        price: g.selectedVariant.price
                    });
                } else if (g.variants && g.variants.length > 0) {
                    for (const v of g.variants.slice(0, 2)) {
                        newSuggestions.push({
                            productId: g.productId,
                            productTitle: g.title,
                            variantId: v.variantId,
                            variantTitle: v.title,
                            price: v.price
                        });
                    }
                }
            }
            if (newSuggestions.length > 0) {
                pcp.suggestions = newSuggestions;
                let msg = `🔍 Para *"${text.trim()}"*, encontré estas opciones en el catálogo:\n\n`;
                newSuggestions.forEach((s, idx) => {
                    const priceFormatted = parseFloat(s.price).toLocaleString('es-CR');
                    msg += `${idx + 1}. *${s.productTitle}* _(${s.variantTitle})_ — ₡${priceFormatted}\n`;
                });
                msg += `${newSuggestions.length + 1}. *Crear como producto nuevo / personalizado*\n\n`;
                msg += `¿Cuál de ellos es? _(Responde con el número)_`;
                return msg;
            }
        }
    }

    // 0b. Respuesta directa a aclaración pendiente de cliente (interacción numérica 1, 2, 3...)
    if (session.pendingCustomer) {
        const cand = session.pendingCustomer.candidates;
        let chosenCustomer: SessionCustomer | null = null;
        const newCustIdx = cand.length + 1;
        const num = parseInt(lowerText, 10);

        if (!isNaN(num)) {
            if (num >= 1 && num <= cand.length) {
                const c = cand[num - 1]!;
                chosenCustomer = {
                    id: c.id,
                    name: c.fullName,
                    phone: c.phone,
                    isExisting: true,
                    ordersCount: c.ordersCount
                };
            } else if (num === newCustIdx || (cand.length === 0 && num === 1)) {
                chosenCustomer = {
                    name: session.pendingCustomer.originalQuery,
                    isExisting: false,
                    ordersCount: 0
                };
            }
        } else if (lowerText.includes('nuevo') || lowerText === 'es nuevo' || lowerText === 'cliente nuevo') {
            chosenCustomer = {
                name: session.pendingCustomer.originalQuery,
                isExisting: false,
                ordersCount: 0
            };
        } else if (cand.length === 0 && num === 2) {
            session.pendingCustomer = null;
            return 'Entendido. Por favor dime el nombre o apellido del cliente para buscarlo:';
        } else {
            const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
            const matchingCand = cand.find(c => norm(c.fullName).includes(norm(lowerText)) || norm(lowerText).includes(norm(c.fullName)));
            if (matchingCand) {
                chosenCustomer = {
                    id: matchingCand.id,
                    name: matchingCand.fullName,
                    phone: matchingCand.phone,
                    isExisting: true,
                    ordersCount: matchingCand.ordersCount
                };
            } else if (text.trim().length >= 2) {
                // El usuario está escribiendo o corrigiendo directamente el nombre del cliente (ej: "Liliana")
                const searchRes = await searchShopifyCustomersSmart(text.trim());
                if (searchRes.exactMatch) {
                    chosenCustomer = {
                        id: searchRes.exactMatch.id,
                        name: searchRes.exactMatch.fullName,
                        phone: searchRes.exactMatch.phone,
                        isExisting: true,
                        ordersCount: searchRes.exactMatch.ordersCount
                    };
                } else {
                    session.pendingCustomer = {
                        originalQuery: text.trim(),
                        candidates: searchRes.candidates
                    };

                    let msg = '';
                    if (session.items.length > 0) {
                        msg += `✅ Productos listos:\n`;
                        for (const it of session.items) {
                            const vDisplay = it.variantTitle && it.variantTitle !== 'Único' ? ` (${it.variantTitle})` : '';
                            msg += `• ${it.quantity}x *${it.productTitle}*${vDisplay}\n`;
                        }
                        msg += `\n`;
                    }

                    if (searchRes.candidates.length > 0) {
                        msg += `👤 Para el cliente *"${text.trim()}"*, encontré estas opciones en el sistema:\n\n`;
                        searchRes.candidates.forEach((c, i) => {
                            const ordersTxt = c.ordersCount > 0 ? ` _(Cliente habitual - ${c.ordersCount} pedidos)_` : '';
                            msg += `${i + 1}. *${c.fullName}*${ordersTxt}\n`;
                        });
                        msg += `${searchRes.candidates.length + 1}. *Es un cliente nuevo* _(Registrar como "${text.trim()}")_\n\n`;
                        msg += `¿Cuál de ellos es? _(Puedes responder con el número o el nombre)_`;
                    } else {
                        msg += `👤 No encontré a ningún cliente registrado como *"${text.trim()}"*.\n\n`;
                        msg += `1. *Registrar como cliente nuevo*\n`;
                        msg += `2. *Escribir otro nombre o buscar de nuevo*\n\n`;
                        msg += `¿Deseas registrarlo como cliente nuevo o cuál es su nombre?`;
                    }
                    return msg;
                }
            }
        }

        if (chosenCustomer) {
            session.customer = chosenCustomer;
            session.pendingCustomer = null;

            // Si además hay variante pendiente, preguntar por la variante
            if (session.pendingVariant) {
                let askMsg = `✅ Cliente seleccionado: *${chosenCustomer.name}*\n\n`;
                askMsg += `📦 Para *"${session.pendingVariant.productTitle}"*, ¿cuál medida o variante necesitas?:\n\n`;
                askMsg += session.pendingVariant.variants.map((v, i) => `${i + 1}. *${v.title}* — ₡${parseFloat(v.price).toLocaleString('es-CR')}`).join('\n');
                askMsg += `\n\n_(Puedes responder con el número o el nombre)_`;
                return askMsg;
            }

            // Si los ítems están listos, mostrar el resumen de confirmación
            if (session.items.length > 0) {
                session.pendingConfirmation = true;
                const summary = await generateSummaryText(session);
                return `✅ Cliente seleccionado: *${chosenCustomer.name}*\n\n` + summary;
            }

            return `Entendido cliente: *${chosenCustomer.name}*. ¿Qué productos deseas agregar a este pedido?`;
        }
    }

    // 0c. Respuesta directa a aclaración pendiente de variante
    if (session.pendingVariant && !session.pendingCustomer) {
        const cand = session.pendingVariant.variants;
        let chosenVariant: MatchedVariant | null = null;
        const num = parseInt(lowerText, 10);

        if (!isNaN(num) && num >= 1 && num <= cand.length) {
            chosenVariant = cand[num - 1]!;
        } else {
            const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
            const matching = cand.find(v => norm(v.title) === norm(lowerText) || norm(v.title).includes(norm(lowerText)) || norm(lowerText).includes(norm(v.title)));
            if (matching) chosenVariant = matching;
        }

        if (chosenVariant) {
            session.items.push({
                productTitle: session.pendingVariant.productTitle,
                variantTitle: chosenVariant.title,
                variantId: chosenVariant.variantId,
                quantity: session.pendingVariant.quantity,
                price: chosenVariant.price
            });
            const vName = chosenVariant.title;
            session.pendingVariant = null;

            if (session.customer && session.items.length > 0) {
                session.pendingConfirmation = true;
                const summary = await generateSummaryText(session);
                return `✅ Variante agregada: *${vName}*\n\n` + summary;
            }

            if (!session.customer) {
                return `✅ Variante agregada: *${vName}*.\n\n👤 ¿A nombre de qué cliente registramos este pedido? *(El cliente es obligatorio)*`;
            }
        }
    }

    // 0d. Corrección directa de cantidad (ej: "solo 1", "solo 1 engaste", "cambiar a 1", "deja solo 1", "solo un")
    const soloMatch = lowerText.match(/(?:solo|deja(?: solo)?|cambia(?:r)? a)\s+(\d+|un|una)(?:\s+(.+))?/i);
    if (soloMatch && session.items.length > 0) {
        const rawNumStr = soloMatch[1]!.toLowerCase();
        const newQty = (rawNumStr === 'un' || rawNumStr === 'una') ? 1 : parseInt(rawNumStr, 10);
        const prodHint = soloMatch[2] ? soloMatch[2].toLowerCase().trim() : '';

        if (!isNaN(newQty) && newQty > 0) {
            let matchedIndex = -1;
            if (prodHint) {
                matchedIndex = session.items.findIndex(it => 
                    it.productTitle.toLowerCase().includes(prodHint) || 
                    it.variantTitle.toLowerCase().includes(prodHint) ||
                    prodHint.includes(it.productTitle.toLowerCase())
                );
            }
            if (matchedIndex < 0 && session.items.length === 1) {
                matchedIndex = 0;
            }

            if (matchedIndex >= 0) {
                session.items[matchedIndex]!.quantity = newQty;
                // Si había duplicados accidentales del mismo producto, eliminarlos
                const keepTitle = session.items[matchedIndex]!.productTitle;
                const keepVar = session.items[matchedIndex]!.variantTitle;
                session.items = session.items.filter((it, idx) => 
                    idx === matchedIndex || it.productTitle !== keepTitle || it.variantTitle !== keepVar
                );

                if (session.customer) {
                    session.pendingConfirmation = true;
                    const summary = await generateSummaryText(session);
                    return `✅ Cantidad corregida a *${newQty}*.\n\n` + summary;
                } else {
                    return `✅ Cantidad corregida a *${newQty}*.\n\n👤 ¿A nombre de qué cliente registramos este pedido? *(El cliente es obligatorio)*`;
                }
            }
        }
    }

    // Obtener catálogo vivo de Shopify
    const products = await getCatalogProducts();
    const catalogText = buildCatalogText(products);

    // Análisis de la IA
    const analysis = await analyzeOrderWithAI(text, session, catalogText);
    if (!analysis) {
        return '❓ No pude procesar tu mensaje. Por favor repítemelo.';
    }

    // 1. Manejo de reporte general detectado semánticamente por IA
    if (analysis.intent === 'general_report' || analysis.is_report_request) {
        const period = analysis.period || 'hoy';
        session.lastReportPeriod = period;
        logInfo(`[Chat ${chatId}] [AI Intent] Reporte general consolidado (${period}): "${text}"`);
        return await generateDailyAccountStatement(period);
    }

    // 2. Manejo de reporte individual de alumno detectado por IA
    if (analysis.intent === 'student_report') {
        const student = analysis.student_name || session.lastReportStudent || '';
        let period = analysis.period || 'hoy';
        const lower = text.toLowerCase();
        if ((lower.includes('mismo') || lower.includes('igual') || lower.includes('tambien') || lower.includes('también')) && session.lastReportPeriod) {
            period = session.lastReportPeriod;
        } else if (period !== 'hoy') {
            session.lastReportPeriod = period;
        } else if (session.lastReportPeriod && period === 'hoy' && !lower.includes('hoy')) {
            period = session.lastReportPeriod;
        }

        session.lastReportStudent = student;
        logInfo(`[Chat ${chatId}] [AI Intent] Consumo de alumno "${student}" (${period}): "${text}"`);
        return await generateStudentConsumptionStatement(student, period);
    }

    // 3. Manejo de cancelación desde IA
    if (analysis.intent === 'cancellation' || analysis.is_cancellation) {
        resetSession(chatId);
        return '❌ Pedido cancelado. La orden fue descartada. ¿En qué más te puedo ayudar?';
    }

    // 4. Manejo de confirmación final
    if ((analysis.intent === 'confirmation' || analysis.is_confirmation) && session.pendingConfirmation) {
        if (!session.customer) {
            session.pendingConfirmation = false;
            return '⚠️ Falta indicar el cliente. ¿A nombre de quién registramos el pedido?';
        }

        try {
            if (session.wantsDraft) {
                const draft = await createShopifyDraftOrder({
                    customerId: session.customer.id,
                    customerName: session.customer.name,
                    customerPhone: session.customer.phone,
                    items: session.items.map(it => ({
                        variantId: it.variantId,
                        title: it.productTitle,
                        quantity: it.quantity,
                        price: it.price
                    })),
                    note: `Borrador tomado vía Telegram por @${advisorUsername}`
                });

                const draftNum = draft.name || `#D${draft.id}`;
                const adminUrl = `https://admin.shopify.com/store/tiendapuntofusion/draft_orders/${draft.id}`;

                // Persistir en Supabase
                await recordOrderInSupabase({
                    shopifyOrderId: draft.id,
                    orderNumber: draftNum,
                    isDraft: true,
                    customerName: session.customer.name,
                    customerPhone: session.customer.phone,
                    advisorUsername: advisorUsername,
                    chatId: chatId,
                    totalPrice: draft.total_price || session.items.reduce((sum, it) => sum + (parseFloat(it.price || '0') * it.quantity), 0),
                    currency: draft.currency || 'CRC',
                    items: session.items.map(it => ({
                        variantId: it.variantId,
                        title: it.productTitle,
                        quantity: it.quantity,
                        price: it.price
                    })),
                    source: 'telegram_bot',
                    note: `Borrador tomado vía Telegram por @${advisorUsername}`
                });

                resetSession(chatId);

                return `✅ *¡Borrador Creado Exitosamente en Shopify!*\n\n` +
                       `🔢 *Borrador:* \`${draftNum}\`\n` +
                       `👤 *Cliente:* ${draft.customer?.first_name || ''} ${draft.customer?.last_name || ''}\n` +
                       `📌 *Estado:* Guardado en la pestaña Borradores\n\n` +
                       `🔗 [Ver borrador en Shopify Admin](${adminUrl})`;
            } else {
                const order = await createShopifyOrder({
                    customerId: session.customer.id,
                    customerName: session.customer.name,
                    customerPhone: session.customer.phone,
                    items: session.items.map(it => ({
                        variantId: it.variantId,
                        title: it.productTitle,
                        quantity: it.quantity,
                        price: it.price
                    })),
                    note: `Orden tomada vía Telegram por @${advisorUsername}`
                });

                const orderNum = order.name || order.order_number || order.id;
                const adminUrl = `https://admin.shopify.com/store/tiendapuntofusion/orders/${order.id}`;

                // Persistir en Supabase
                await recordOrderInSupabase({
                    shopifyOrderId: order.id,
                    orderNumber: String(orderNum),
                    isDraft: false,
                    customerName: session.customer.name,
                    customerPhone: session.customer.phone,
                    advisorUsername: advisorUsername,
                    chatId: chatId,
                    totalPrice: order.total_price || session.items.reduce((sum, it) => sum + (parseFloat(it.price || '0') * it.quantity), 0),
                    currency: order.currency || 'CRC',
                    items: session.items.map(it => ({
                        variantId: it.variantId,
                        title: it.productTitle,
                        quantity: it.quantity,
                        price: it.price
                    })),
                    source: 'telegram_bot',
                    note: `Orden tomada vía Telegram por @${advisorUsername}`
                });

                resetSession(chatId);

                return `✅ *¡Orden Creada Exitosamente en Shopify!*\n\n` +
                       `🔢 *Número de Pedido:* \`${orderNum}\`\n` +
                       `👤 *Cliente:* ${order.customer?.first_name || ''} ${order.customer?.last_name || ''}\n` +
                       `📌 *Estado:* Pendiente de pago en Pedidos\n\n` +
                       `🔗 [Ver pedido en Shopify Admin](${adminUrl})`;
            }
        } catch (error: any) {
            logError('Error enviando a Shopify:', error);
            const errData = error?.response?.data?.errors;
            const errorDetails = errData 
                ? (typeof errData === 'object' ? JSON.stringify(errData) : String(errData))
                : error.message;
            return `❌ Error al conectar con Shopify: ${errorDetails}`;
        }
    }

    // 3. Si viene cliente en el mensaje, buscarlo y verificarlo en Shopify
    if (analysis.customer_name && (!session.customer || session.customer.name !== analysis.customer_name)) {
        const searchRes = await searchShopifyCustomersSmart(analysis.customer_name);
        if (searchRes.exactMatch) {
            session.customer = {
                id: searchRes.exactMatch.id,
                name: searchRes.exactMatch.fullName,
                phone: searchRes.exactMatch.phone,
                isExisting: true,
                ordersCount: searchRes.exactMatch.ordersCount
            };
            session.pendingCustomer = null;
        } else if (searchRes.candidates.length > 0) {
            session.pendingCustomer = {
                originalQuery: analysis.customer_name,
                candidates: searchRes.candidates
            };
            session.customer = null;
        } else {
            session.pendingCustomer = {
                originalQuery: analysis.customer_name,
                candidates: []
            };
            session.customer = null;
        }
    }

    // 4. Si el usuario especificó preferencia de borrador
    if (analysis.wants_draft !== null && analysis.wants_draft !== undefined) {
        session.wantsDraft = analysis.wants_draft;
    }

    // 5. Procesar ítems identificados por la IA contra el catálogo de Shopify
    if (analysis.matched_items && analysis.matched_items.length > 0) {
        for (const mi of analysis.matched_items) {
            const rawProd = mi.product_title || (mi as any).product || '';
            const rawVar = mi.variant_title || (mi as any).variant || '';
            const miProdNorm = rawProd.toLowerCase().trim();
            const miVarNorm = rawVar.toLowerCase().trim();
            if (!miProdNorm) continue;

            // GUARD ANTI-ECO MEJORADO: Compara tanto producto como variante para no bloquear segundas variantes legítimas
            const existingItem = session.items.find(it => 
                it.productTitle.toLowerCase() === miProdNorm &&
                (it.variantTitle.toLowerCase() === miVarNorm || (!it.variantTitle && !miVarNorm))
            );
            const userMentionedProd = lowerText.includes(miProdNorm) || 
                (miVarNorm && lowerText.includes(miVarNorm)) ||
                miProdNorm.split(/\s+/).some((w: string) => w.length >= 4 && lowerText.includes(w)) ||
                (miVarNorm && miVarNorm.split(/\s+/).some((w: string) => w.length >= 3 && lowerText.includes(w)));
            if (existingItem && !userMentionedProd) {
                continue;
            }

            let prod = products.find(p => p.title.toLowerCase().trim() === miProdNorm);
            if (!prod) {
                prod = products.find(p => p.title.toLowerCase().includes(miProdNorm) || miProdNorm.includes(p.title.toLowerCase()));
            }

            // Fallback inteligente con searchProductsSmart si el nombre no coincide exactamente
            let smartVariant: MatchedVariant | null = null;
            if (!prod) {
                const smartMatches = await searchProductsSmart(rawProd, rawVar);
                if (smartMatches.length > 0 && smartMatches[0]!.score >= 50) {
                    const topMatch = smartMatches[0]!;
                    prod = products.find(p => p.id === topMatch.productId) || null;
                    if (topMatch.selectedVariant) {
                        smartVariant = topMatch.selectedVariant;
                    }
                }
            }

            if (!prod) {
                // El producto no existe en el catálogo: NO crearlo a ciegas, preguntar primero al asesor
                return await prepareCustomProductQuestion(rawProd, mi.quantity || 1, 0, text, session);
            }

            let variant = smartVariant;
            if (!variant) {
                variant = prod.variants.find((v: any) => {
                    const vt = (v.title === 'Default Title' ? 'Único' : v.title).toLowerCase().trim();
                    return vt === miVarNorm;
                });
            }

            if (!variant && prod.variants.length === 1) {
                variant = prod.variants[0];
            }

            if (!variant && miVarNorm) {
                variant = prod.variants.find((v: any) => v.title.toLowerCase().includes(miVarNorm) || miVarNorm.includes(v.title.toLowerCase()));
            }

            if (!variant && prod.variants.length > 0) {
                variant = prod.variants[0];
            }

            const officialPrice = variant ? variant.price : (prod.variants?.[0]?.price || '0.00');
            const officialVariantTitle = variant ? (variant.title === 'Default Title' ? 'Único' : variant.title) : (rawVar || 'Único');

            session.items.push({
                productTitle: prod.title,
                variantTitle: officialVariantTitle,
                variantId: (variant as any)?.id || (variant as any)?.variantId,
                quantity: mi.quantity || 1,
                price: officialPrice
            });
        }
        // Si estábamos esperando una variante y ya fue provista, limpiarla
        session.pendingVariant = null;
    }

    // 6. Procesar ítems personalizados identificados por la IA
    if (analysis.custom_items && analysis.custom_items.length > 0) {
        for (const ci of analysis.custom_items) {
            const ciTitle = (ci.title || 'Ítem personalizado').toLowerCase().trim();

            // GUARD ANTI-ECO: Si ya existe un ítem similar y el mensaje del usuario no menciona el producto, ignorar eco de IA.
            const existingItem = session.items.find(it => it.productTitle.toLowerCase() === ciTitle);
            const userMentionedProd = lowerText.includes(ciTitle) ||
                ciTitle.split(/\s+/).some((w: string) => w.length >= 4 && lowerText.includes(w));
            if (existingItem && !userMentionedProd) {
                continue;
            }

            // Verificar primero si el producto realmente existe en el catálogo de Shopify con searchProductsSmart
            const smartMatches = await searchProductsSmart(ci.title);
            if (smartMatches.length > 0 && smartMatches[0]!.score >= 70 && smartMatches[0]!.selectedVariant) {
                const topMatch = smartMatches[0]!;
                const prod = products.find(p => p.id === topMatch.productId);
                if (prod && topMatch.selectedVariant) {
                    session.items.push({
                        productTitle: prod.title,
                        variantTitle: topMatch.selectedVariant.title,
                        variantId: topMatch.selectedVariant.variantId,
                        quantity: ci.quantity || 1,
                        price: topMatch.selectedVariant.price
                    });
                    continue;
                }
            }

            // Si no existe con certeza en el catálogo, NUNCA crearlo a ciegas: preguntar primero al usuario
            return await prepareCustomProductQuestion(ci.title, ci.quantity || 1, ci.unit_price || 0, text, session);
        }
    }

    // 7. Si la IA detectó que un producto requiere aclaración de variante
    if (analysis.needs_clarification && analysis.needs_clarification.length > 0) {
        const nc = analysis.needs_clarification[0]!;
        const rawNcProd = nc.product_title || (nc as any).product || '';
        const ncProdNorm = rawNcProd.toLowerCase().trim();
        let prod = ncProdNorm ? products.find(p => p.title.toLowerCase().trim() === ncProdNorm || p.title.toLowerCase().includes(ncProdNorm) || ncProdNorm.includes(p.title.toLowerCase())) : null;

        // Si no encontró por coincidencia directa y el texto menciona "helad", mapear a "Helados la paletea"
        if (!prod && ncProdNorm.includes('helad')) {
            prod = products.find(p => p.title.toLowerCase().includes('helad'));
        }

        if (prod && prod.variants && prod.variants.length > 1) {
            session.pendingVariant = {
                productTitle: prod.title,
                quantity: nc.quantity || 1,
                variants: prod.variants.map((v: any) => ({
                    variantId: v.id,
                    title: v.title === 'Default Title' ? 'Único' : v.title,
                    price: v.price
                }))
            };

            // Solo retornar de inmediato si el cliente ya está completamente aclarado
            if (session.customer && !session.pendingCustomer) {
                let askMsg = '';
                if (session.items.length > 0) {
                    askMsg += `✅ Agregué al pedido:\n`;
                    for (const it of session.items) {
                        const vDisplay = it.variantTitle && it.variantTitle !== 'Único' ? ` (${it.variantTitle})` : '';
                        askMsg += `• ${it.quantity}x *${it.productTitle}*${vDisplay}\n`;
                    }
                    askMsg += `\n`;
                }

                askMsg += `📦 Para *"${prod.title}"*, ¿cuál medida o variante necesitas?:\n\n`;
                askMsg += session.pendingVariant.variants.map((v, i) => `${i + 1}. *${v.title}* — ₡${parseFloat(v.price).toLocaleString('es-CR')}`).join('\n');
                askMsg += `\n\n_(Puedes responder con el número o el nombre, ej: "1" o "${session.pendingVariant.variants[0]?.title}")_`;
                return askMsg;
            }
        }
    }

    let warningPrefix = '';
    if (analysis.not_found && analysis.not_found.length > 0) {
        const nfTerm = analysis.not_found[0]!;
        if (session.items.length === 0) {
            return await prepareCustomProductQuestion(nfTerm, 1, 0, text, session);
        }
        warningPrefix = `⚠️ No encontré en el catálogo: *${analysis.not_found.join(', ')}*.\n¿Cómo aparece registrado en el inventario?\n\n`;
    }

    // 8. CLIENTE OBLIGATORIO / ACLARACIÓN DE CLIENTE
    if (!session.customer) {
        let msg = warningPrefix;
        if (session.items.length > 0) {
            msg += `✅ Productos listos:\n`;
            for (const it of session.items) {
                const vDisplay = it.variantTitle && it.variantTitle !== 'Único' ? ` (${it.variantTitle})` : '';
                msg += `• ${it.quantity}x *${it.productTitle}*${vDisplay}\n`;
            }
            msg += `\n`;
        }

        if (session.pendingCustomer && session.pendingCustomer.candidates.length > 0) {
            const cand = session.pendingCustomer.candidates;
            msg += `👤 Para el cliente *"${session.pendingCustomer.originalQuery}"*, encontré estas opciones en el sistema:\n\n`;
            cand.forEach((c, i) => {
                const ordersTxt = c.ordersCount > 0 ? ` _(Cliente habitual - ${c.ordersCount} pedidos)_` : '';
                msg += `${i + 1}. *${c.fullName}*${ordersTxt}\n`;
            });
            msg += `${cand.length + 1}. *Es un cliente nuevo* _(Registrar como "${session.pendingCustomer.originalQuery}")_\n\n`;
            msg += `¿Cuál de ellos es? _(Puedes responder con el número o el nombre)_`;
            return msg;
        }

        if (session.pendingCustomer && session.pendingCustomer.candidates.length === 0) {
            msg += `👤 No encontré a ningún cliente registrado como *"${session.pendingCustomer.originalQuery}"*.\n\n`;
            msg += `1. *Registrar como cliente nuevo*\n`;
            msg += `2. *Escribir otro nombre o buscar de nuevo*\n\n`;
            msg += `¿Deseas registrarlo como cliente nuevo o cuál es su nombre?`;
            return msg;
        }

        if (session.items.length === 0) {
            return `👋 No detecté productos en tu mensaje. Puedes pedirme productos del catálogo (ej: _"una cegueta para Pepito"_) o consultar consumos (ej: _"detalle por cliente"_ o _"consumo de Marta"_).`;
        }

        msg += `👤 ¿A nombre de qué cliente registramos este pedido? *(El cliente es obligatorio)*`;
        return msg;
    }

    // 9. Si hay variante pendiente de aclarar
    if (session.pendingVariant) {
        let askMsg = warningPrefix;
        if (session.items.length > 0) {
            askMsg += `✅ Productos listos:\n`;
            for (const it of session.items) {
                const vDisplay = it.variantTitle && it.variantTitle !== 'Único' ? ` (${it.variantTitle})` : '';
                askMsg += `• ${it.quantity}x *${it.productTitle}*${vDisplay}\n`;
            }
            askMsg += `\n`;
        }
        askMsg += `📦 Para *"${session.pendingVariant.productTitle}"*, ¿cuál medida o variante necesitas?:\n\n`;
        askMsg += session.pendingVariant.variants.map((v, i) => `${i + 1}. *${v.title}* — ₡${parseFloat(v.price).toLocaleString('es-CR')}`).join('\n');
        askMsg += `\n\n_(Puedes responder con el número o el nombre)_`;
        return askMsg;
    }

    // 10. Si tenemos cliente y productos, mostrar resumen de confirmación
    if (session.items.length > 0) {
        session.pendingConfirmation = true;
        const summary = await generateSummaryText(session);
        return warningPrefix + summary;
    }

    return warningPrefix + `Entendido cliente: *${session.customer.name}*. ¿Qué productos deseas agregar a este pedido?`;
}
