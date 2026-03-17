import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env['SUPABASE_URL'];
const supabaseKey = process.env['SUPABASE_ANON_KEY'];

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Error de configuración: SUPABASE_URL:', supabaseUrl ? 'OK' : 'FALTANTE', '| SUPABASE_ANON_KEY:', supabaseKey ? 'OK' : 'FALTANTE');
    throw new Error('Faltan SUPABASE_URL o SUPABASE_ANON_KEY en las variables de entorno.');
}

export const supabase = createClient(supabaseUrl, supabaseKey);
