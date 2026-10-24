import axios from 'axios';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import { logInfo, logWarn, logError } from './logger.js';
import {
    getCatalogProducts,
    searchShopifyCustomers,
    searchShopifyCustomersSmart,
    createShopifyOrder,
    createShopifyDraftOrder,
    checkTodayDuplicates,
    MatchedVariant,
    MatchedCustomer
} from './shopify.js';

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

export interface ChatSession {
    chatId: number;
    customer: SessionCustomer | null;
    items: OrderItem[];
    wantsDraft: boolean;
    pendingVariant?: PendingVariantClarification | null;
    pendingCustomer?: PendingCustomerClarification | null;
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
            pendingCustomer: null,
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
2. CAFETERÍA Y ALIMENTOS:
   - "Cafe La Catalina": Alimentos preparados y bebidas de cafetería (empanadas colombianas, almojábanas, pastelitos de plátano y yuca, café, té, granola, refrescos, cervezas). Usa la variante exacta correspondiente (ej: "Empanadas colombianas - unidad", "Almojabana - unidad").
   - "Helados la paletea": Helados, paletas, conos o sándwiches de helado corresponden SIEMPRE y ÚNICAMENTE al producto "Helados la paletea" (NUNCA a Cafe La Catalina).
3. HERRAMIENTAS: Medidas de brocas corresponden al producto: "Brocas- varias medidas" (ej: variante "0.9mm"). Lijas corresponden a "Lijas - diferentes granos".
4. ACLARACIÓN: Si el usuario pide un producto que tiene varias variantes y NO especificó cuál:
   - Si pide "un helado", colócalo en needs_clarification con product_title: "Helados la paletea".
   - Si estamos esperando variante y el usuario la indica (ej: "el cono sencillo" o "1"), identifícala en matched_items.
5. ÍTEMS PERSONALIZADOS: Si el usuario pide un producto con precio explícito o divisa no registrado en catálogo (ej: "una piedra 75 dólares"), colócalo en custom_items con su precio en colones (tasa estándar ₡520 por dólar si viene en USD).
6. CANCELACIÓN: Si el usuario dice "cancelar", "cancela", "borrar", "olvídalo", marca is_cancellation: true.
7. CONFIRMACIÓN: Si estamos esperando confirmación final y el usuario dice "sí", "confirmar", "dale", "guardar", "ok", marca is_confirmation: true.
8. Ignora muletillas de transcripción como "gracias por ver el video".
9. REGLA ANTI-DUPLICADOS CRÍTICA:
   - En matched_items y custom_items incluye ÚNICAMENTE productos NUEVOS pedidos expresamente en el "Mensaje nuevo del asesor".
   - NUNCA repitas productos que ya figuran en "Ítems ya en el pedido".
   - Si el mensaje nuevo del asesor es solo un nombre de persona (ej: "Liliana"), una aclaración de cliente, o no menciona productos nuevos, devuelve matched_items: [] y custom_items: [].

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

// Orquestador principal de mensajes conversacionales
export async function processConversationMessage(chatId: number, text: string, advisorUsername: string): Promise<string> {
    const session = getSession(chatId);

    // 0. Cancelación inmediata por texto
    const lowerText = text.toLowerCase().trim();
    if (lowerText === 'cancelar' || lowerText === 'cancela' || (lowerText === 'no' && session.pendingConfirmation)) {
        resetSession(chatId);
        return '❌ Pedido cancelado. La orden fue descartada. ¿En qué más te puedo ayudar?';
    }

    // 0b. Respuesta directa a aclaración pendiente de cliente
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
            if (!miProdNorm) continue;

            // GUARD ANTI-ECO: Si el producto ya está en el pedido y el mensaje actual del usuario NO menciona este producto, ignorar eco de IA.
            const existingItem = session.items.find(it => it.productTitle.toLowerCase() === miProdNorm);
            const userMentionedProd = lowerText.includes(miProdNorm) || 
                (rawVar && lowerText.includes(rawVar.toLowerCase())) ||
                miProdNorm.split(/\s+/).some((w: string) => w.length >= 4 && lowerText.includes(w));
            if (existingItem && !userMentionedProd) {
                continue;
            }

            let prod = products.find(p => p.title.toLowerCase().trim() === miProdNorm);
            if (!prod) {
                prod = products.find(p => p.title.toLowerCase().includes(miProdNorm) || miProdNorm.includes(p.title.toLowerCase()));
            }

            if (!prod) {
                session.items.push({
                    productTitle: rawProd,
                    variantTitle: rawVar || '',
                    quantity: mi.quantity || 1,
                    price: '0.00',
                    isCustom: true
                });
                continue;
            }

            const miVarNorm = rawVar.toLowerCase().trim();
            let variant = prod.variants.find((v: any) => {
                const vt = (v.title === 'Default Title' ? 'Único' : v.title).toLowerCase().trim();
                return vt === miVarNorm;
            });

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
            const ciTitle = (ci.title || 'Ítem personalizado').toLowerCase().trim();

            // GUARD ANTI-ECO: Si ya existe un ítem similar y el mensaje del usuario no menciona el producto, ignorar eco de IA.
            const existingItem = session.items.find(it => it.productTitle.toLowerCase() === ciTitle);
            const userMentionedProd = lowerText.includes(ciTitle) ||
                ciTitle.split(/\s+/).some((w: string) => w.length >= 4 && lowerText.includes(w));
            if (existingItem && !userMentionedProd) {
                continue;
            }

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
