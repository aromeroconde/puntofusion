import 'dotenv/config';
import { supabase } from './src/supabase.js';

async function checkServices() {
    console.log('Querying pf_services...');
    const { data, error } = await supabase
        .from('pf_services')
        .select('*');

    if (error) {
        console.error('Error querying Supabase:', error);
    } else {
        console.log('Services total count:', data?.length || 0);
        console.log('Services details:', JSON.stringify(data, null, 2));
    }
}
checkServices();
