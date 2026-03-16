import { supabase } from './src/supabase.js';

async function run() {
    const { data: students, error: err1 } = await supabase.from('pf_students').select('id').limit(1);
    if (err1 || !students || students.length === 0) {
        console.log('No students found or error:', err1);
        return;
    }
    const studentId = students[0].id;
    console.log('Testing with student:', studentId);

    const { data, error } = await supabase
        .from('pf_students')
        .update({ alegra_item_reference: 'JWTA' })
        .eq('id', studentId)
        .select();

    if (error) {
        console.error('Update failed:', error);
    } else {
        console.log('Update success:', data);
    }
}
run();
