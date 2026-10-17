import axios from 'axios';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const SHOPIFY_SHOP_DOMAIN = process.env['SHOPIFY_SHOP_DOMAIN'] || 'tiendapuntofusion.myshopify.com';
const SHOPIFY_CLIENT_ID = process.env['SHOPIFY_CLIENT_ID'] || '';
const SHOPIFY_CLIENT_SECRET = process.env['SHOPIFY_CLIENT_SECRET'] || '';

let cachedAccessToken: string | null = null;
let tokenExpiresAt: number = 0;

// Obtener o refrescar el Access Token mediante Client Credentials
export async function getShopifyAccessToken(): Promise<string> {
    const now = Date.now();
    if (cachedAccessToken && now < tokenExpiresAt - 60000) {
        return cachedAccessToken;
    }

    try {
        const response = await axios.post(
            `https://${SHOPIFY_SHOP_DOMAIN}/admin/oauth/access_token`,
            {
                client_id: SHOPIFY_CLIENT_ID,
                client_secret: SHOPIFY_CLIENT_SECRET,
                grant_type: 'client_credentials'
            },
            {
                headers: { 'Content-Type': 'application/json' }
            }
        );

        if (response.data && response.data.access_token) {
            cachedAccessToken = response.data.access_token;
            const expiresInMs = (response.data.expires_in || 86400) * 1000;
            tokenExpiresAt = now + expiresInMs;
            return response.data.access_token as string;
        } else {
            throw new Error('Respuesta inválida al solicitar token de Shopify');
        }
    } catch (error: any) {
        console.error('Error obteniendo token de Shopify:', error?.response?.data || error.message);
        throw error;
    }
}

// Cliente axios configurado para la API de Shopify
export async function getShopifyClient() {
    const token = await getShopifyAccessToken();
    return axios.create({
        baseURL: `https://${SHOPIFY_SHOP_DOMAIN}/admin/api/2024-04`,
        headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': token
        }
    });
}

// Caché en memoria de productos
let cachedProducts: any[] = [];
let productsCachedAt: number = 0;

export async function getCatalogProducts(forceRefresh = false): Promise<any[]> {
    const now = Date.now();
    if (!forceRefresh && cachedProducts.length > 0 && now - productsCachedAt < 5 * 60 * 1000) {
        return cachedProducts;
    }

    try {
        const client = await getShopifyClient();
        const response = await client.get('/products.json?limit=250');
        cachedProducts = response.data.products || [];
        productsCachedAt = now;
        return cachedProducts;
    } catch (error: any) {
        console.error('Error obteniendo productos de Shopify:', error?.response?.data || error.message);
        return cachedProducts;
    }
}

export interface MatchedVariant {
    variantId: number;
    title: string;
    price: string;
    sku?: string | undefined;
    availableQuantity?: number | undefined;
}

export interface MatchedProductGroup {
    productId: number;
    title: string;
    score: number;
    variants: MatchedVariant[];
    imageUrl?: string | undefined;
    selectedVariant?: MatchedVariant | undefined;
}

function normalize(str: string): string {
    return (str || '')
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/cegueta/g, "segueta")
        .replace(/almohadana/g, "almojabana")
        .replace(/almohabana/g, "almojabana")
        .replace(/,/g, " ")
        .trim();
}

function stem(w: string): string {
    if (w.endsWith("es") && w.length > 4) return w.slice(0, -2);
    if (w.endsWith("s") && w.length > 3) return w.slice(0, -1);
    return w;
}

function levenshtein(a: string, b: string): number {
    const matrix: number[][] = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0]![j] = j;
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i]![j] = matrix[i - 1]![j - 1]!;
            } else {
                matrix[i]![j] = Math.min(
                    matrix[i - 1]![j - 1]! + 1,
                    matrix[i]![j - 1]! + 1,
                    matrix[i - 1]![j]! + 1
                );
            }
        }
    }
    return matrix[b.length]![a.length]!;
}

// Búsqueda inteligente / difusa de productos y variantes
export async function searchProductsSmart(searchTerm: string, specification?: string): Promise<MatchedProductGroup[]> {
    const products = await getCatalogProducts();
    const queryNorm = normalize(searchTerm);
    const specNorm = normalize(specification || '');
    const rawWords = `${queryNorm} ${specNorm}`
        .split(/\s+/)
        .filter(w => w.length > 0 && !["de", "un", "una", "dos", "tres", "el", "la", "los", "las", "para"].includes(w));

    const candidateGroups: MatchedProductGroup[] = [];

    for (const product of products) {
        const prodNorm = normalize(product.title || '');
        const tagsNorm = normalize(product.tags || '');
        const isSingle = (product.variants || []).length === 1;

        let prodScore = 0;
        if (prodNorm.includes(queryNorm)) prodScore += 50;

        for (const w of rawWords) {
            const st = stem(w);
            if (prodNorm.includes(w) || prodNorm.includes(st)) prodScore += 25;
            if (tagsNorm.includes(w) || tagsNorm.includes(st)) prodScore += 10;
            if ((w === "mil" || w === "1000") && (prodNorm.includes("1000") || prodNorm.includes("mil") || prodNorm.includes("pura"))) {
                prodScore += 40;
            }
        }

        let bestVariant: MatchedVariant | null = null;
        let bestVariantScore = 0;
        let variantSpecificMatch = false;

        const scoredVariants = (product.variants || []).map((v: any) => {
            const varNorm = normalize(v.title || '');
            const isDefault = v.title === 'Default Title' || v.title === 'Único';
            let vScore = prodScore;

            if (!isDefault) {
                let varOnlyMatches = 0;
                if (varNorm.includes(queryNorm)) {
                    vScore += 80;
                    varOnlyMatches += 2;
                }

                for (const w of rawWords) {
                    const st = stem(w);
                    if (varNorm.includes(w) || varNorm.includes(st)) {
                        vScore += 35;
                        // Solo contar como específico si no está ya en el título del producto padre
                        if (!prodNorm.includes(w) && !prodNorm.includes(st)) {
                            varOnlyMatches++;
                        }
                    }
                }

                if (specNorm && (varNorm.includes(specNorm) || varNorm.replace(/mm|cm/g, "").trim() === specNorm)) {
                    vScore += 50;
                    varOnlyMatches++;
                }

                if (varOnlyMatches > 0) {
                    variantSpecificMatch = true;
                }
            }

            // Fuzzy match si score es bajo
            if (vScore < 20) {
                for (const w of rawWords) {
                    const st = stem(w);
                    const wordsToCheck = isDefault ? prodNorm.split(/\s+/) : `${prodNorm} ${varNorm}`.split(/\s+/);
                    for (const target of wordsToCheck) {
                        const targetSt = stem(target);
                        if (Math.abs(st.length - targetSt.length) <= 2) {
                            const dist = levenshtein(st, targetSt);
                            if (dist <= 1 && st.length >= 4) vScore += 25;
                            else if (dist <= 2 && st.length >= 6) vScore += 20;
                        }
                    }
                }
            }

            const variantObj: MatchedVariant = {
                variantId: v.id,
                title: isDefault ? 'Único' : v.title,
                price: v.price,
                sku: v.sku || undefined,
                availableQuantity: v.inventory_quantity ?? undefined
            };

            if (vScore > bestVariantScore) {
                bestVariantScore = vScore;
                bestVariant = variantObj;
            }

            return {
                ...variantObj,
                score: vScore
            };
        });

        const totalScore = Math.max(prodScore, bestVariantScore);

        if (totalScore > 20) {
            let selectedVariant: MatchedVariant | undefined = undefined;
            if (isSingle && product.variants[0]) {
                const sv = product.variants[0];
                selectedVariant = {
                    variantId: sv.id,
                    title: sv.title === 'Default Title' ? 'Único' : sv.title,
                    price: sv.price
                };
            } else if (variantSpecificMatch && bestVariant) {
                selectedVariant = bestVariant;
            }

            candidateGroups.push({
                productId: product.id,
                title: product.title,
                score: totalScore,
                selectedVariant,
                variants: (product.variants || []).map((v: any) => ({
                    variantId: v.id,
                    title: v.title === 'Default Title' ? 'Único' : v.title,
                    price: v.price,
                    sku: v.sku || undefined,
                    availableQuantity: v.inventory_quantity ?? undefined
                })),
                imageUrl: product.image?.src || undefined
            });
        }
    }

    // Ordenar de mayor a menor relevancia
    candidateGroups.sort((a, b) => b.score - a.score);
    return candidateGroups.slice(0, 5);
}

// Búsqueda de clientes en Shopify
export interface MatchedCustomer {
    id: number;
    firstName: string;
    lastName: string;
    fullName: string;
    email?: string | undefined;
    phone?: string | undefined;
    ordersCount: number;
    company?: string | undefined;
}

export async function searchShopifyCustomers(query: string): Promise<MatchedCustomer[]> {
    if (!query || query.trim().length < 2) return [];
    try {
        const client = await getShopifyClient();
        const response = await client.get(`/customers/search.json?query=${encodeURIComponent(query.trim())}`);
        const customers = response.data.customers || [];
        return customers.map((c: any) => ({
            id: c.id,
            firstName: c.first_name || '',
            lastName: c.last_name || '',
            fullName: `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Sin nombre',
            email: c.email || undefined,
            phone: c.phone || c.default_address?.phone || undefined,
            ordersCount: c.orders_count || 0,
            company: c.default_address?.company || undefined
        }));
    } catch (error: any) {
        console.error('Error buscando clientes en Shopify:', error?.response?.data || error.message);
        return [];
    }
}

// Crear orden oficial en Shopify
export interface CreateOrderItem {
    variantId?: number | undefined;
    title?: string | undefined;
    quantity: number;
    price?: string | undefined;
}

export interface CreateOrderParams {
    customerId?: number | undefined;
    customerName: string;
    customerPhone?: string | undefined;
    items: CreateOrderItem[];
    note?: string | undefined;
}

export async function createShopifyOrder(params: CreateOrderParams) {
    const client = await getShopifyClient();

    const nameParts = params.customerName.trim().split(/\s+/);
    const firstName = nameParts[0] || 'Cliente';
    const lastName = nameParts.slice(1).join(' ') || '';

    const customerPayload = params.customerId 
        ? { id: params.customerId }
        : {
            first_name: firstName,
            last_name: lastName,
            ...(params.customerPhone ? { phone: params.customerPhone } : {})
        };

    const payload = {
        order: {
            line_items: params.items.map(item => ({
                ...(item.variantId ? { variant_id: item.variantId } : { title: item.title || 'Item personalizado' }),
                quantity: item.quantity,
                ...(item.price && parseFloat(item.price) > 0 ? { price: item.price } : {})
            })),
            customer: customerPayload,
            financial_status: 'pending',
            note: params.note || 'Pedido creado por asistente interno Telegram',
            tags: 'telegram-bot,interno'
        }
    };

    const response = await client.post('/orders.json', payload);
    return response.data.order;
}

// Crear borrador de pedido (Draft Order) en Shopify
export async function createShopifyDraftOrder(params: CreateOrderParams) {
    const client = await getShopifyClient();

    const nameParts = params.customerName.trim().split(/\s+/);
    const firstName = nameParts[0] || 'Cliente';
    const lastName = nameParts.slice(1).join(' ') || '';

    const customerPayload = params.customerId 
        ? { id: params.customerId }
        : {
            first_name: firstName,
            last_name: lastName,
            ...(params.customerPhone ? { phone: params.customerPhone } : {})
        };

    const payload = {
        draft_order: {
            line_items: params.items.map(item => ({
                ...(item.variantId ? { variant_id: item.variantId } : { title: item.title || 'Item personalizado' }),
                quantity: item.quantity,
                ...(item.price && parseFloat(item.price) > 0 ? { price: item.price } : {})
            })),
            customer: customerPayload,
            note: params.note || 'Borrador creado por asistente interno Telegram',
            tags: 'telegram-bot,interno,borrador'
        }
    };

    const response = await client.post('/draft_orders.json', payload);
    return response.data.draft_order;
}

// Obtener detalle de variante y su producto desde Shopify
export async function getShopifyVariant(variantId: number): Promise<{
    variantId: number;
    title: string;
    price: string;
    productId: number;
    productTitle: string;
} | null> {
    try {
        const client = await getShopifyClient();
        const res = await client.get(`/variants/${variantId}.json`);
        const variant = res.data?.variant;
        if (!variant) return null;

        let productTitle = 'Producto';
        try {
            const prodRes = await client.get(`/products/${variant.product_id}.json?fields=title`);
            productTitle = prodRes.data?.product?.title || productTitle;
        } catch {}

        return {
            variantId: variant.id,
            title: variant.title,
            price: variant.price,
            productId: variant.product_id,
            productTitle
        };
    } catch (err: any) {
        console.error('Error obteniendo variante de Shopify:', err.message);
        return null;
    }
}

export interface TodayDuplicateItem {
    orderNumber: string;
    createdAtTime: string;
    isDraft: boolean;
    matchingItems: string[];
}

export interface CheckItemParam {
    productTitle: string;
    variantTitle?: string | undefined;
    variantId?: number | undefined;
}

export interface CheckCustomerParam {
    id?: number | undefined;
    name: string;
    phone?: string | undefined;
}

// Verificar pedidos y borradores del día creados para este cliente con productos idénticos
export async function checkTodayDuplicates(
    customer: CheckCustomerParam,
    items: CheckItemParam[]
): Promise<TodayDuplicateItem[]> {
    try {
        const client = await getShopifyClient();
        const now = new Date();
        const todayCR = now.toLocaleDateString('en-CA', { timeZone: 'America/Costa_Rica' });
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        const [ordersRes, draftsRes] = await Promise.all([
            client.get('/orders.json?status=any&created_at_min=' + yesterday.toISOString() + '&limit=50').catch(() => ({ data: { orders: [] } })),
            client.get('/draft_orders.json?status=any&limit=30').catch(() => ({ data: { draft_orders: [] } }))
        ]);

        const allOrders = [
            ...((ordersRes.data?.orders || []).map((o: any) => ({ ...o, isDraft: false }))),
            ...((draftsRes.data?.draft_orders || []).map((d: any) => ({ ...d, isDraft: true })))
        ];

        const normalize = (s: string) => (s || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        const custNameNorm = normalize(customer.name);
        const duplicates: TodayDuplicateItem[] = [];

        for (const o of allOrders) {
            const oDateCR = new Date(o.created_at).toLocaleDateString('en-CA', { timeZone: 'America/Costa_Rica' });
            if (oDateCR !== todayCR) continue;

            let custMatch = false;
            if (customer.id && o.customer?.id && Number(customer.id) === Number(o.customer.id)) {
                custMatch = true;
            } else if (o.customer) {
                const oCustName = normalize((o.customer.first_name || '') + ' ' + (o.customer.last_name || ''));
                if (custNameNorm && (oCustName.includes(custNameNorm) || custNameNorm.includes(oCustName))) {
                    custMatch = true;
                }
            }

            if (!custMatch) continue;

            const matchingItems: string[] = [];
            for (const lineItem of (o.line_items || [])) {
                for (const item of items) {
                    let isMatch = false;
                    if (item.variantId && lineItem.variant_id && Number(item.variantId) === Number(lineItem.variant_id)) {
                        isMatch = true;
                    } else {
                        const lTitleNorm = normalize(lineItem.title || '');
                        const iProdNorm = normalize(item.productTitle || '');
                        const lVarNorm = normalize(lineItem.variant_title || '');
                        const iVarNorm = normalize(item.variantTitle || '');

                        if (lTitleNorm === iProdNorm && (lVarNorm === iVarNorm || (!lVarNorm && (iVarNorm === 'unico' || iVarNorm === 'default title')))) {
                            isMatch = true;
                        } else if (normalize(lineItem.name || '') === normalize((item.productTitle || '') + ' ' + (item.variantTitle || ''))) {
                            isMatch = true;
                        }
                    }

                    if (isMatch) {
                        matchingItems.push(lineItem.name || lineItem.title || 'Producto coincidente');
                    }
                }
            }

            if (matchingItems.length > 0) {
                const timeStr = new Date(o.created_at).toLocaleTimeString('es-CR', {
                    timeZone: 'America/Costa_Rica',
                    hour: '2-digit',
                    minute: '2-digit'
                });
                duplicates.push({
                    orderNumber: o.name || `#${o.id}`,
                    createdAtTime: timeStr,
                    isDraft: o.isDraft,
                    matchingItems: Array.from(new Set(matchingItems))
                });
            }
        }

        return duplicates;
    } catch (err: any) {
        console.error('Error al verificar duplicados en Shopify:', err.message);
        return [];
    }
}

