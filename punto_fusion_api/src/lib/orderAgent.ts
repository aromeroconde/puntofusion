import axios from 'axios';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import {
    getCatalogProducts,
    searchShopifyCustomers,
    createShopifyOrder,
    createShopifyDraftOrder,
    MatchedVariant,
    MatchedCustomer
} from './shopify.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const OPENAI_API_KEY = process.env['OPENAI_API_KEY'] || '';

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

export interface ChatSession {
    chatId: number;
    customer: SessionCustomer | null;
    items: OrderItem[];
    wantsDraft: boolean;
    pendingVariant?: PendingVariantClarification | null;
    pendingConfirmation: boolean;
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
    is_cancellation: boolean;
    is_confirmation: boolean;
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
    const prompt = `Eres el cerebro conversacional de ventas con Inteligencia Artificial de la tienda "Punto Fusión" (taller/escuela de joyería, herramientas, metales y cafetería).
Tu misión es interpretar el mensaje del asesor (texto o transcripción de audio) y mapear con total precisión semántica los productos solicitados contra el catálogo real de Shopify.

Catálogo actual de productos y variantes en Shopify:
${catalogText}

Estado actual de la sesión:
- Cliente actual: ${session.customer ? session.customer.name : "NINGUNO (FALTA INDICAR CLIENTE)"}
- Ítems ya en el pedido: ${JSON.stringify(session.items)}
- Esperando aclaración de variante: ${session.pendingVariant ? JSON.stringify(session.pendingVariant) : "NO"}
- Esperando confirmación final: ${session.pendingConfirmation ? "SÍ" : "NO"}

Mensaje nuevo del asesor:
"${text}"

Reglas semánticas clave:
1. DISTINCIÓN CRÍTICA DE METALES:
   - "Plata 1000", "plata mil", "plata pura" o "10 gramos de plata 1000" corresponde SIEMPRE al producto: "Plata pura (1000) bolsas de 10 gramos". (NO es Plata 950).
   - "Plata 950" se usa ÚNICAMENTE si el asesor dice explícitamente las palabras "plata 950".
2. CAFETERÍA: Comidas y bebidas (empanadas, almojábanas, pastelitos, café, té) corresponden al producto: "Cafe La Catalina". Usa la variante correspondiente (ej: "Empanadas colombianas - unidad", "Almojabana - unidad").
3. HERRAMIENTAS: Medidas de brocas corresponden al producto: "Brocas- varias medidas" (ej: variante "0.9mm"). Lijas corresponden a "Lijas - diferentes granos".
4. ACLARACIÓN: Si el usuario pide un producto que tiene varias variantes y NO especificó cuál (ej: "un helado"), colócalo en needs_clarification. Si estamos esperando variante y el usuario la indica (ej: "el cono sencillo"), identifícala en matched_items.
5. ÍTEMS PERSONALIZADOS: Si el usuario pide un producto con precio explícito o divisa no registrado en catálogo (ej: "una piedra 75 dólares"), colócalo en custom_items con su precio en colones (tasa estándar ₡520 por dólar si viene en USD).
6. CANCELACIÓN: Si el usuario dice "cancelar", "cancela", "borrar", "olvídalo", marca is_cancellation: true.
7. CONFIRMACIÓN: Si estamos esperando confirmación final y el usuario dice "sí", "confirmar", "dale", "guardar", "ok", marca is_confirmation: true.
8. Ignora muletillas de transcripción como "gracias por ver el video".

Devuelve ÚNICAMENTE un JSON con esta estructura exacta:
{
  "is_cancellation": false,
  "is_confirmation": false,
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
        return content ? JSON.parse(content) : null;
    } catch (err: any) {
        console.error('Error analizando con IA:', err.message);
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
function generateSummaryText(session: ChatSession): string {
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
    msg += `¿Confirmas para registrarlo en Shopify? _(Responde "sí" para confirmar o "cancelar")_`;

    return msg;
}

// Orquestador principal de mensajes conversacionales
export async function processConversationMessage(chatId: number, text: string, advisorUsername: string): Promise<string> {
    const session = getSession(chatId);

    // 0. Cancelación inmediata por texto
    const lowerText = text.toLowerCase().trim();
    if (lowerText === 'cancelar' || lowerText === 'cancela' || (lowerText === 'no' && session.pendingConfirmation)) {
        resetSession(chatId);
        return '❌ Pedido cancelado. La orden fue descartada. ¿En qué más te puedo ayudar?';
    }

    // Obtener catálogo vivo de Shopify
    const products = await getCatalogProducts();
    const catalogText = buildCatalogText(products);

    // Análisis de la IA
    const analysis = await analyzeOrderWithAI(text, session, catalogText);
    if (!analysis) {
        return '❓ No pude procesar tu mensaje. Por favor repítemelo.';
    }

    // 1. Manejo de cancelación desde IA
    if (analysis.is_cancellation) {
        resetSession(chatId);
        return '❌ Pedido cancelado. La orden fue descartada. ¿En qué más te puedo ayudar?';
    }

    // 2. Manejo de confirmación final
    if (analysis.is_confirmation && session.pendingConfirmation) {
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
                resetSession(chatId);

                return `✅ *¡Orden Creada Exitosamente en Shopify!*\n\n` +
                       `🔢 *Número de Pedido:* \`${orderNum}\`\n` +
                       `👤 *Cliente:* ${order.customer?.first_name || ''} ${order.customer?.last_name || ''}\n` +
                       `📌 *Estado:* Pendiente de pago en Pedidos\n\n` +
                       `🔗 [Ver pedido en Shopify Admin](${adminUrl})`;
            }
        } catch (error: any) {
            console.error('Error enviando a Shopify:', error);
            return `❌ Error al conectar con Shopify: ${error?.response?.data?.errors || error.message}`;
        }
    }

    // 3. Si viene cliente en el mensaje, resolverlo en Shopify
    if (analysis.customer_name) {
        session.customer = await resolveCustomer(analysis.customer_name);
    }

    // 4. Si el usuario especificó preferencia de borrador
    if (analysis.wants_draft !== null && analysis.wants_draft !== undefined) {
        session.wantsDraft = analysis.wants_draft;
    }

    // 5. Procesar ítems identificados por la IA contra el catálogo de Shopify
    if (analysis.matched_items && analysis.matched_items.length > 0) {
        for (const mi of analysis.matched_items) {
            const miProdNorm = (mi.product_title || '').toLowerCase().trim();
            let prod = products.find(p => p.title.toLowerCase().trim() === miProdNorm);
            if (!prod) {
                prod = products.find(p => p.title.toLowerCase().includes(miProdNorm) || miProdNorm.includes(p.title.toLowerCase()));
            }

            if (!prod) {
                session.items.push({
                    productTitle: mi.product_title,
                    variantTitle: mi.variant_title || '',
                    quantity: mi.quantity || 1,
                    price: '0.00',
                    isCustom: true
                });
                continue;
            }

            const miVarNorm = (mi.variant_title || '').toLowerCase().trim();
            let variant = prod.variants.find((v: any) => {
                const vt = (v.title === 'Default Title' ? 'Único' : v.title).toLowerCase().trim();
                return vt === miVarNorm;
            });

            if (!variant && prod.variants.length === 1) {
                variant = prod.variants[0];
            }

            if (!variant) {
                variant = prod.variants.find((v: any) => v.title.toLowerCase().includes(miVarNorm) || miVarNorm.includes(v.title.toLowerCase()));
            }

            if (!variant && prod.variants.length > 0) {
                variant = prod.variants[0];
            }

            const officialPrice = variant ? variant.price : (prod.variants?.[0]?.price || '0.00');
            const officialVariantTitle = variant ? (variant.title === 'Default Title' ? 'Único' : variant.title) : (mi.variant_title || 'Único');

            session.items.push({
                productTitle: prod.title,
                variantTitle: officialVariantTitle,
                variantId: variant?.id,
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
            session.items.push({
                productTitle: ci.title || 'Ítem personalizado',
                variantTitle: '',
                quantity: ci.quantity || 1,
                price: (ci.unit_price || 0).toString(),
                isCustom: true
            });
        }
    }

    // 7. Si la IA detectó que un producto requiere aclaración de variante
    if (analysis.needs_clarification && analysis.needs_clarification.length > 0) {
        const nc = analysis.needs_clarification[0]!;
        const ncProdNorm = (nc.product_title || '').toLowerCase().trim();
        const prod = products.find(p => p.title.toLowerCase().trim() === ncProdNorm || p.title.toLowerCase().includes(ncProdNorm));

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

    let warningPrefix = '';
    if (analysis.not_found && analysis.not_found.length > 0) {
        warningPrefix = `⚠️ No encontré en el catálogo: *${analysis.not_found.join(', ')}*.\n¿Cómo aparece registrado en el inventario?\n\n`;
    }

    // 8. CLIENTE OBLIGATORIO: Si aún no tenemos cliente, pedirlo sí o sí
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
        msg += `👤 ¿A nombre de qué cliente registramos este pedido? *(El cliente es obligatorio)*`;
        return msg;
    }

    // 9. Si tenemos cliente y productos, mostrar resumen de confirmación
    if (session.items.length > 0) {
        session.pendingConfirmation = true;
        return warningPrefix + generateSummaryText(session);
    }

    return warningPrefix + `Entendido cliente: *${session.customer.name}*. ¿Qué productos deseas agregar a este pedido?`;
}
