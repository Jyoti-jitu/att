const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("SUPABASE_URL and SUPABASE_SERVICE_KEY are required in .env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
    console.log("🌱 Seeding real student data...");

    // 1. Get a teacher ID
    const { data: teachers } = await supabase.from('teachers').select('id').limit(1);
    if (!teachers || teachers.length === 0) {
        console.error("No teachers found. Please create a teacher first.");
        return;
    }
    const teacherId = teachers[0].id;

    // 2. Create sample students
    const passwordHash = '$2y$10$abcdefghijklmnopqrstuvwxyz0123456789abcde'; // dummy valid hash
    const sampleStudents = [
        { name: 'Arjun Sharma', email: 'arjun@student.edu', roll_no: 'CS2021001', branch: 'CSE', section: '2', semester: '5', mobile: '9000000010', parent_mobile: '9000000011', password_hash: passwordHash, role: 'student' },
        { name: 'Priya Patel', email: 'priya@student.edu', roll_no: 'CS2021002', branch: 'CSE', section: '2', semester: '5', mobile: '9000000020', parent_mobile: '9000000021', password_hash: passwordHash, role: 'student' },
        { name: 'Rohan Gupta', email: 'rohan@student.edu', roll_no: 'CS2021003', branch: 'CSE', section: '2', semester: '5', mobile: '9000000030', parent_mobile: '9000000031', password_hash: passwordHash, role: 'student' },
        { name: 'Sanya Varma', email: 'sanya@student.edu', roll_no: 'CS2021004', branch: 'CSE', section: '2', semester: '5', mobile: '9000000040', parent_mobile: '9000000041', password_hash: passwordHash, role: 'student' },
        { name: 'Ishant Singh', email: 'ishant@student.edu', roll_no: 'CS2021005', branch: 'CSE', section: '2', semester: '5', mobile: '9000000050', parent_mobile: '9000000051', password_hash: passwordHash, role: 'student' },
    ];

    for (const student of sampleStudents) {
        const { data, error } = await supabase.from('students').upsert(student, { onConflict: 'email' }).select();
        if (error) console.error("Error seeding student:", error.message);
    }

    // 3. Get the most recent session for CSE-2
    const { data: sessions } = await supabase.from('attendance_sessions')
        .select('id')
        .eq('branch', 'CSE')
        .eq('section', '2')
        .order('start_time', { ascending: false })
        .limit(1);

    if (sessions && sessions.length > 0) {
        const sessionId = sessions[0].id;

        // 4. Add attendance records
        const { data: allStudents } = await supabase.from('students')
            .select('id')
            .eq('branch', 'CSE')
            .eq('section', '2');

        console.log(`Adding ${allStudents.length} attendance records to session ${sessionId}...`);

        for (const student of allStudents) {
            await supabase.from('attendance_records').upsert({
                session_id: sessionId,
                student_id: student.id,
                status: 'present',
                distance: Math.random() * 5 + 1,
                rssi: -60 - Math.floor(Math.random() * 20),
                timestamp: new Date().toISOString()
            }, { onConflict: 'session_id,student_id' });
        }
    }

    console.log("✅ Seeding complete! Please Refresh the Dashboard page.");
}

seed();
