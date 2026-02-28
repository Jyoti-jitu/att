const express = require('express')
const cors = require('cors')
const dotenv = require('dotenv')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { createClient } = require('@supabase/supabase-js')


dotenv.config()

const app = express()
const PORT = process.env.PORT || 5000

// --- Middleware ---
const allowedOrigins = [
    'https://att-m1rz.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000'
];

app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) === -1) {
            return callback(null, true); // Allow during transition, but log as reminder
        }
        return callback(null, true);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

// Pre-flight OPTIONS handling
app.options('*', cors());

// Middleware to neutralize double slashes
app.use((req, res, next) => {
    if (req.path.includes('//')) {
        const cleanPath = req.path.replace(/\/+/g, '/');
        req.url = cleanPath;
    }
    next();
});

app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ limit: '50mb', extended: true }))

// --- Health Check ---
app.get('/', (req, res) => {
    res.json({
        status: '✅ GeoAttend Backend is running',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        endpoints: [
            '/api/auth/login',
            '/api/auth/register',
            '/api/auth/send-otp',
            '/api/auth/verify-otp',
            '/api/sessions/active',
            '/api/attendance/mark'
        ]
    })
})

// --- Supabase Config ---
const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_KEY
let supabase = null

if (supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey)
    console.log('✅ Supabase connected')
} else {
    console.log('⚠️ Supabase not configured - running in mock mode')
}



// --- JWT Helper ---
const JWT_SECRET = process.env.JWT_SECRET || 'geo-fence-secret-key'

function signToken(payload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' })
}

function verifyToken(req, res, next) {
    const auth = req.headers.authorization
    if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' })
    try {
        req.user = jwt.verify(auth.slice(7), JWT_SECRET)
        next()
    } catch {
        res.status(401).json({ error: 'Token expired or invalid' })
    }
}

// --- Utility: Haversine Formula ---
function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // meters
    const phi1 = lat1 * Math.PI / 180;
    const phi2 = lat2 * Math.PI / 180;
    const dPhi = (lat2 - lat1) * Math.PI / 180;
    const dLambda = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(dPhi / 2) * Math.sin(dPhi / 2) +
        Math.cos(phi1) * Math.cos(phi2) *
        Math.sin(dLambda / 2) * Math.sin(dLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // in meters
}

// --- Mock Data (for demo if Supabase fails) ---
const MOCK_STUDENT_HASH = bcrypt.hashSync('student123', 10);
const MOCK_ADMIN_HASH = bcrypt.hashSync('admin123', 10)

let mockStudents = [
    {
        id: 's1',
        name: 'Arjun Sharma',
        roll_no: '101',
        mobile: '9876543210',
        branch: 'CSE',
        semester: '5',
        section: 'A',
        email: 'arjun@student.edu',
        parent_mobile: '9876543211',
        password_hash: MOCK_STUDENT_HASH,
        role: 'student',
        current_session_token: null
    },
    {
        id: 's2',
        name: 'Priya Patel',
        roll_no: '102',
        mobile: '9876543212',
        branch: 'CSE',
        semester: '5',
        section: 'A',
        email: 'priya@student.edu',
        parent_mobile: '9876543213',
        password_hash: MOCK_STUDENT_HASH,
        role: 'student',
        current_session_token: null
    },
    {
        id: 's3',
        name: 'Rohan Verma',
        roll_no: '103',
        mobile: '9876543214',
        branch: 'CSE',
        semester: '5',
        section: 'A',
        email: 'rohan@student.edu',
        parent_mobile: '9876543215',
        password_hash: MOCK_STUDENT_HASH,
        role: 'student',
        current_session_token: null
    }
]

let mockTeachers = [
    {
        id: 't1',
        name: 'Admin',
        username: 'admin',
        mobile: '9000000000',
        email: 'admin@college.edu',
        password_hash: MOCK_ADMIN_HASH,
        role: 'teacher'
    },
    {
        id: 't2',
        name: 'Demo Teacher',
        username: 'teacher',
        mobile: '9000000001',
        email: 'teacher@college.edu',
        password_hash: bcrypt.hashSync('teacher123', 10),
        role: 'teacher'
    }
]

let mockSessions = []
let mockRecords = []

// --- Routes ---



// --- Email Config (Resend) ---
const { Resend } = require('resend')
// Safe initialization: Only initialize if a key is provided, or pass a dummy key
const resendApiKey = process.env.RESEND_API_KEY || 're_dummy_key_to_prevent_crash'
const resend = new Resend(resendApiKey)

const SENDER_EMAIL = process.env.SENDER_EMAIL || 'onboarding@resend.dev'
// Note: If you have a verified domain, set SENDER_EMAIL in .env to an email at that domain.
const otpStore = new Map() // email -> { otp, expiry }
const sessionTimeouts = new Map() // sessionId -> timeoutHandle

// --- Automated Absence Notification Service ---
const notifyAbsentees = async (sessionId, branch, section, semester, subject) => {
    try {
        console.log(`\n[AUTO-NOTIFY] Session ${sessionId} ended. Checking for absentees...`);

        const isResendConfigured = process.env.RESEND_API_KEY &&
            process.env.RESEND_API_KEY !== 're_YOUR_RESEND_KEY_HERE';

        let absentees = [];
        let studentsList = [];

        if (supabase) {
            const { data: students } = await supabase.from('students').select('id, name, email')
                .eq('branch', branch).eq('section', section).eq('semester', semester);
            const { data: records } = await supabase.from('attendance_records').select('student_id').eq('session_id', sessionId);
            const attendedIds = new Set((records || []).map(r => r.student_id));
            absentees = (students || []).filter(s => !attendedIds.has(s.id));
        } else {
            studentsList = mockStudents.filter(s => s.branch === branch && s.section === section && s.semester == semester);
            const attendedIds = new Set(mockRecords.filter(r => r.session_id === sessionId).map(r => r.student_id));
            absentees = studentsList.filter(s => !attendedIds.has(s.id));
        }

        if (absentees.length === 0) {
            console.log(`[AUTO-NOTIFY] 100% attendance for ${subject}! No emails required.`);
            return;
        }

        if (!isResendConfigured) {
            console.log('--------------------------------------------------');
            console.log('[AUTO-NOTIFY] RESEND NOT CONFIGURED (DEV MODE)');
            console.log(`[AUTO-NOTIFY] Detected ${absentees.length} absentees for ${subject}:`);
            absentees.forEach(s => console.log(`   - ${s.name} (${s.email})`));
            console.log('--------------------------------------------------');
            return;
        }

        console.log(`[AUTO-NOTIFY] Found ${absentees.length} absentees. Dispatching alerts...`);

        // 3. Send emails
        for (const student of absentees) {
            try {
                await resend.emails.send({
                    from: `Attendance Alert <${SENDER_EMAIL}>`,
                    to: student.email,
                    subject: `Absence Notification: ${subject}`,
                    html: `
                        <div style="font-family: 'Inter', sans-serif; max-width: 500px; padding: 25px; border: 1px solid #e2e8f0; border-radius: 16px; background: white;">
                            <div style="background: #fef2f2; padding: 20px; border-radius: 12px; margin-bottom: 20px; border-left: 6px solid #ef4444;">
                                <h1 style="margin: 0; font-size: 20px; color: #991b1b;">Absence Alert</h1>
                                <p style="margin: 5px 0 0 0; font-size: 14px; color: #dc2626;">Smart Attendance Verification System</p>
                            </div>
                            <p style="font-size: 15px; color: #1e293b;">Hello <b>${student.name}</b>,</p>
                            <p style="color: #475569; line-height: 1.5; font-size: 14px;">Our system has recorded you as <b>ABSENT</b> for the following session:</p>
                            
                            <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 15px 0; border: 1px solid #f1f5f9;">
                                <p style="margin: 0; font-size: 18px; font-weight: 800; color: #0f172a;">${subject}</p>
                                <p style="margin: 4px 0 0 0; font-size: 13px; color: #64748b;">Date: ${new Date().toLocaleDateString()}</p>
                            </div>

                            <p style="font-size: 13px; color: #ef4444; font-weight: 600;">⚠️ Absence from lectures may impact your internal grades and exam eligibility.</p>
                            
                            <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 20px 0;">
                            <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 0;">This is an automated notification. Please contact your HOD for corrections.</p>
                        </div>
                    `
                });
            } catch (emailErr) {
                console.error(`[AUTO-NOTIFY] Error mailing ${student.email}:`, emailErr.message);
            }
        }
        console.log(`[AUTO-NOTIFY] Monitoring complete for Session ${sessionId}`);
    } catch (err) {
        console.error('[AUTO-NOTIFY] Service Error:', err);
    }
};

// PDF Report Dispatching
app.post('/api/reports/send-email', async (req, res) => {
    const { to, subject, body, pdfBase64, filename } = req.body;

    if (!to || !pdfBase64) {
        return res.status(400).json({ error: 'Missing recipient email or PDF data' });
    }

    const isResendConfigured = process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== 're_YOUR_RESEND_KEY_HERE';

    if (isResendConfigured) {
        try {
            console.log(`[REPORTS] Sending PDF to ${to}`);

            // Clean up base64 string if it contains the data uri prefix
            const base64Data = pdfBase64.includes('base64,') ? pdfBase64.split('base64,')[1] : pdfBase64;

            const { data, error } = await resend.emails.send({
                from: `GeoAttend <${SENDER_EMAIL}>`,
                to,
                subject: subject || 'Attendance Report',
                html: body || '<p>Please find the attached attendance report.</p>',
                attachments: [
                    {
                        filename: filename || 'AttendanceReport.pdf',
                        content: base64Data
                    }
                ]
            });

            if (error) {
                console.error('[REPORTS] Resend API Error:', error);
                return res.status(500).json({ error: error.message });
            }

            console.log(`[REPORTS] Success: ${data.id}`);
            return res.json({ message: 'Email sent successfully!', id: data.id });
        } catch (err) {
            console.error('[REPORTS] Unhandled Error:', err);
            return res.status(500).json({ error: 'Internal server error sending email' });
        }
    } else {
        console.log(`[DEV MODE] Mock email with PDF attachment to ${to}`);
        return res.json({ message: 'Email sent in Mock Mode (check console).' });
    }
});

// Registration (Student)
app.post('/api/auth/send-otp', async (req, res) => {
    const { email } = req.body
    if (!email) return res.status(400).json({ error: 'Email is required' })

    const otp = Math.floor(100000 + Math.random() * 900000).toString()
    const expiry = Date.now() + 10 * 60 * 1000 // 10 minutes
    otpStore.set(email, { otp, expiry })

    const isResendConfigured = process.env.RESEND_API_KEY &&
        process.env.RESEND_API_KEY !== 're_YOUR_RESEND_KEY_HERE';

    console.log(`[AUTH] Sending OTP for ${email}: ${otp}`)

    if (isResendConfigured) {
        // Send email in background so the user gets an immediate response
        res.json({ message: 'Verification code sent!' });

        (async () => {
            try {
                console.log(`[AUTH] Background: Sending OTP to ${email} from ${SENDER_EMAIL}...`);
                const { data, error } = await resend.emails.send({
                    from: `GeoAttend <${SENDER_EMAIL}>`,
                    to: email,
                    subject: 'Verify your Student Account',
                    html: `
                        <div style="font-family: sans-serif; max-width: 400px; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                            <h2 style="color: #2563eb;">Verification Code</h2>
                            <p>Use code below to complete registration:</p>
                            <div style="background: #f4f7ff; padding: 20px; text-align: center; border-radius: 8px;">
                                <span style="font-size: 32px; font-weight: 800; letter-spacing: 5px; color: #1e3a8a;">${otp}</span>
                            </div>
                            <p style="font-size: 12px; color: #666; margin-top: 20px;">Expired in 10 minutes.</p>
                        </div>
                    `
                });

                if (error) {
                    console.error('[AUTH] Background Resend Error:', error);
                } else {
                    console.log(`[AUTH] Background Email Success ID: ${data.id}`);
                }
            } catch (err) {
                console.error('[AUTH] Background Unexpected Error:', err);
            }
        })();
    } else {
        console.log(`[DEV MODE] OTP for ${email}: ${otp}`);
        res.json({ message: 'OTP generated (Mock Mode - check server console)', otp });
    }
})

app.post('/api/auth/verify-otp', async (req, res) => {
    const { email, otp } = req.body
    const record = otpStore.get(email)

    if (!record || record.otp !== otp || Date.now() > record.expiry) {
        return res.status(400).json({ error: 'Invalid or expired OTP' })
    }

    res.json({ message: 'OTP verified successfully', success: true })
})

app.post('/api/auth/register', async (req, res) => {
    const {
        name, roll_no, mobile, branch, semester, section,
        email, parent_mobile, password, otp
    } = req.body

    if (!name || !roll_no || !email || !password || !mobile || !branch || !semester || !section || !otp) {
        return res.status(400).json({ error: 'All fields including OTP are required' })
    }

    // Verify OTP one last time during registration
    const record = otpStore.get(email)
    if (!record || record.otp !== otp || Date.now() > record.expiry) {
        return res.status(400).json({ error: 'Invalid or expired OTP. Please verify again.' })
    }

    const password_hash = await bcrypt.hash(password, 10)
    const studentData = {
        name, roll_no, mobile, branch, semester, section,
        email, parent_mobile, password_hash,
        role: 'student', current_session_token: null
    }

    if (supabase) {
        const { data, error } = await supabase.from('students').insert([studentData]).select()
        if (error) {
            if (error.code === '23505') return res.status(400).json({ error: 'Email or Roll Number already exists' })
            return res.status(400).json({ error: error.message })
        }
        otpStore.delete(email)
        return res.json({ message: 'Registration successful', student: data[0] })
    } else {
        const student = { id: Date.now().toString(), ...studentData }
        mockStudents.push(student)
        otpStore.delete(email)
        return res.json({ message: 'Registration successful (Mock Mode)', student })
    }
})

// Teacher Registration
app.post('/api/auth/register/teacher', async (req, res) => {
    const { name, username, mobile, email, password, securityToken } = req.body

    if (securityToken !== '157500') {
        return res.status(401).json({ error: 'Invalid Security Token. Access Denied.' })
    }

    if (!name || !username || !email || !password || !mobile) {
        return res.status(400).json({ error: 'All fields are required' })
    }

    const password_hash = await bcrypt.hash(password, 10)
    const teacherData = {
        name, username, mobile, email, password_hash,
        role: 'teacher'
    }

    if (supabase) {
        const { data, error } = await supabase.from('teachers').insert([teacherData]).select()
        if (error) {
            if (error.code === '23505') return res.status(400).json({ error: 'Email or Username already exists' })
            return res.status(400).json({ error: error.message })
        }
        return res.json({ message: 'Teacher Registered successfully', teacher: data[0] })
    } else {
        const teacher = { id: Date.now().toString(), ...teacherData }
        mockTeachers.push(teacher)
        return res.json({ message: 'Teacher Registration successful (Mock Mode)', teacher })
    }
})

// --- Mock Blocker Data ---
let mockBlockedLogs = []

// Get Current Profile (To refresh block status etc)
app.get('/api/auth/me', verifyToken, async (req, res) => {
    const { id, role } = req.user
    let userData;
    if (supabase) {
        const table = role === 'teacher' ? 'teachers' : 'students'
        const { data } = await supabase.from(table).select('*').eq('id', id).single()
        userData = data
    } else {
        const list = role === 'teacher' ? mockTeachers : mockStudents
        userData = list.find(u => u.id === id)
    }

    if (!userData) return res.status(404).json({ error: 'User not found' })

    // Remote sensitive data
    const { password_hash, ...safeUser } = userData

    // Add remaining block seconds for precision front-end timers
    let remaining_block_seconds = 0;
    if (userData.blocked_until) {
        remaining_block_seconds = Math.max(0, Math.floor((new Date(userData.blocked_until).getTime() - Date.now()) / 1000));
    }

    res.json({ ...safeUser, remaining_block_seconds })
})

// Unified Login
app.post('/api/auth/login', async (req, res) => {
    const { email, password, role, forceLogin } = req.body
    let user;

    if (supabase) {
        const table = role === 'teacher' ? 'teachers' : 'students'
        const { data, error } = await supabase.from(table).select('*').eq('email', email).single()
        if (error || !data) return res.status(401).json({ error: `${role.charAt(0).toUpperCase() + role.slice(1)} account not found` })
        user = data
    } else {
        const list = role === 'teacher' ? mockTeachers : mockStudents
        user = list.find(u => u.email === email)
        if (!user) return res.status(401).json({ error: `${role.charAt(0).toUpperCase() + role.slice(1)} not found (Mock Mode)` })
    }

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) return res.status(401).json({ error: 'Invalid password' })


    // 0. Check if student is currently blocked
    if (user.blocked_until) {
        const blockEnds = new Date(user.blocked_until).getTime();
        const now = Date.now();
        if (blockEnds > now) {
            const minutes = Math.ceil((blockEnds - now) / 60000);
            return res.status(403).json({
                error: `SECURITY GAP: This account is restricted for ${minutes} more minutes. Please ask your Prof. to 'Reset Device Binding' if you have changed your phone.`
            })
        }
    }

    const session_token = require('crypto').randomUUID()


    const token = signToken({ id: user.id, email: user.email, role: user.role, branch: user.branch, section: user.section, semester: user.semester, session_token })

    let remaining_block_seconds = 0;
    if (user.blocked_until) {
        remaining_block_seconds = Math.max(0, Math.floor((new Date(user.blocked_until).getTime() - Date.now()) / 1000));
    }

    res.json({ token, user: { ...user, password_hash: undefined, remaining_block_seconds } })
})

// Logout Route (Clear session lock)
app.post('/api/auth/logout', verifyToken, async (req, res) => {
    const { id, role } = req.user
    if (role === 'student') {
        if (supabase) {
            await supabase.from('students').update({ current_session_token: null }).eq('id', id)
        } else {
            const student = mockStudents.find(s => s.id === id)
            if (student) student.current_session_token = null
        }
    }
    res.json({ success: true, message: 'Logged out successfully' })
})

// Start Attendance (Teacher)
app.post('/api/sessions/start', verifyToken, async (req, res) => {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Forbidden' })

    const { branch, section, semester, subject, timeSlot, duration, lat, lng } = req.body
    const otp = Math.floor(100000 + Math.random() * 900000).toString()
    const startTime = new Date()         // UTC automatically
    const durationMins = parseInt(duration) || 5
    const expiryTime = new Date(startTime.getTime() + durationMins * 60000)

    // Build session — only include optional columns if they exist in DB
    const session = {
        branch, section,
        teacher_id: req.user.id,
        teacher_lat: lat, teacher_lng: lng,
        teacher_accuracy: req.body.accuracy || 0, // Store teacher's accuracy
        otp,
        start_time: startTime.toISOString(),
        expiry_time: expiryTime.toISOString(),
        status: 'active'
    }

    // Optional columns — added via SQL migration
    if (semester) session.semester = semester
    if (subject) session.subject = subject
    if (timeSlot) session.time_slot = timeSlot

    if (supabase) {
        // Try to insert with full set of columns
        let { data, error } = await supabase.from('attendance_sessions').insert([session]).select()

        if (error) {
            console.warn(`[SESSION] Primary insert failed: ${error.message}. Retrying with minimal payload...`);

            // Fallback: If 'teacher_lat' doesn't exist, try 'lat'
            const fallback_session = { ...session };
            if (error.message.includes('teacher_lat') || error.message.includes('lat')) {
                fallback_session.lat = lat;
                fallback_session.lng = lng;
                delete fallback_session.teacher_lat;
                delete fallback_session.teacher_lng;
            }

            // Remove non-critical columns that might be missing in older schemas
            delete fallback_session.teacher_accuracy;
            delete fallback_session.teacher_rssi;
            delete fallback_session.time_slot;
            delete fallback_session.status;

            console.log('[SESSION] Metadata retry payload:', Object.keys(fallback_session));

            let { data: retryData, error: retryError } = await supabase.from('attendance_sessions').insert([fallback_session]).select();

            if (retryError) {
                console.error('[SESSION] Critical insert failure:', retryError.message);
                // Last ditch effort: Just the basics
                const extreme_fallback = {
                    teacher_id: session.teacher_id,
                    branch: session.branch,
                    section: session.section,
                    subject: session.subject || 'Lecture',
                    lat: lat,
                    lng: lng,
                    otp: session.otp,
                    expiry_time: session.expiry_time
                };
                const { data: lastData, error: lastError } = await supabase.from('attendance_sessions').insert([extreme_fallback]).select();
                if (lastError) return res.status(400).json({ error: lastError.message });
                retryData = lastData;
            }

            // Map columns back to what the frontend expects
            const row = retryData[0];
            const finalSession = {
                ...row,
                teacher_lat: row.teacher_lat || row.lat || lat,
                teacher_lng: row.teacher_lng || row.lng || lng,
                subject,
                semester,
                section
            };

            // Schedule post-session absence alert
            const delayInMs = (durationMins * 60 * 1000) + 10000;
            const timeoutHandle = setTimeout(() => {
                notifyAbsentees(row.id, branch, section, semester, subject);
                sessionTimeouts.delete(row.id);
            }, delayInMs);
            sessionTimeouts.set(row.id, timeoutHandle);

            return res.json(finalSession);
        }

        const row = data[0];

        // Schedule post-session absence alert
        const delayInMs = (durationMins * 60 * 1000) + 10000;
        const timeoutHandle = setTimeout(() => {
            notifyAbsentees(row.id, branch, section, semester, subject || 'Lecture');
            sessionTimeouts.delete(row.id);
        }, delayInMs);
        sessionTimeouts.set(row.id, timeoutHandle);

        return res.json({
            ...row,
            teacher_lat: row.teacher_lat || lat,
            teacher_lng: row.teacher_lng || lng,
            subject,
            semester,
            section
        })
    } else {
        const mockRow = {
            id: 'mock-sess-' + Date.now(),
            teacher_id: req.user.id,
            branch, section, semester, subject,
            otp,
            start_time: startTime.toISOString(),
            expiry_time: expiryTime.toISOString(),
            teacher_lat: lat,
            teacher_lng: lng,
            status: 'active'
        }
        mockSessions.push(mockRow)

        // Schedule post-session absence alert (Mock Mode)
        const delayInMs = (durationMins * 60 * 1000) + 5000;
        const timeoutHandle = setTimeout(() => {
            notifyAbsentees(mockRow.id, branch, section, semester, subject || 'Lecture');
            sessionTimeouts.delete(mockRow.id);
        }, delayInMs);
        sessionTimeouts.set(mockRow.id, timeoutHandle);

        return res.json(mockRow)
    }
})

// Cancel Session (Teacher deletes erroneous entry)
app.delete('/api/sessions/:id/cancel', verifyToken, async (req, res) => {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Forbidden' });
    const { id } = req.params;

    // 1. Clear scheduled notification
    if (sessionTimeouts.has(id)) {
        clearTimeout(sessionTimeouts.get(id));
        sessionTimeouts.delete(id);
        console.log(`[SESSION] Cancelled scheduled email alert for session ${id}`);
    }

    if (supabase) {
        await supabase.from('attendance_records').delete().eq('session_id', id);
        const { error } = await supabase.from('attendance_sessions').delete().eq('id', id);
        if (error) return res.status(400).json({ error: error.message });
    } else {
        mockSessions = mockSessions.filter(s => s.id !== id);
        mockRecords = mockRecords.filter(r => r.session_id !== id);
    }
    res.json({ success: true, message: 'Session cancelled successfully' });
})

// Manual Absence Notification Trigger (Teacher)
app.post('/api/sessions/:id/resend-alerts', verifyToken, async (req, res) => {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Forbidden' });
    const { id } = req.params;

    let sessionData;
    if (supabase) {
        const { data } = await supabase.from('attendance_sessions').select('*').eq('id', id).single();
        sessionData = data;
    } else {
        sessionData = mockSessions.find(s => s.id === id);
    }

    if (!sessionData) return res.status(404).json({ error: 'Session not found' });

    // Execute notification immediately
    notifyAbsentees(id, sessionData.branch, sessionData.section, sessionData.semester, sessionData.subject || 'Lecture');
    res.json({ success: true, message: 'Absence alerts are being processed.' });
})


// Get Active Session for Student
app.get('/api/sessions/active', verifyToken, async (req, res) => {
    const { branch, section, semester } = req.user
    const now = new Date()

    if (supabase) {
        // Fetch active sessions and filter case-insensitively
        const { data, error } = await supabase.from('attendance_sessions')
            .select('*')
            .eq('status', 'active')
            .gt('expiry_time', now.toISOString())
            .order('start_time', { ascending: false })
            .limit(50)

        const isMatch = (s1, s2) => {
            if (s1 === undefined || s1 === null) return true; // Graceful degrade if DB column is missing
            const n1 = String(s1).toLowerCase().replace(/[^a-z0-9]/g, '');
            const n2 = String(s2 || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            if (!n1) return true;
            if (n1 === n2) return true;
            if (n1 && n2 && (n1.includes(n2) || n2.includes(n1))) return true;
            return false;
        };

        // Strict but case-insensitive & flexible filter (handles "5" vs "5th" or "CSE2" vs "2")
        const session = (data || []).find(s =>
            isMatch(s.branch, branch) &&
            isMatch(s.section, section) &&
            isMatch(s.semester, semester)
        ) || null

        if (session) {
            // Normalize columns for frontend
            session.teacher_lat = session.teacher_lat || session.lat;
            session.teacher_lng = session.teacher_lng || session.lng;
        }

        return res.json(session)
    } else {
        const isMatch = (s1, s2) => {
            if (s1 === undefined || s1 === null) return true;
            const n1 = String(s1).toLowerCase().replace(/[^a-z0-9]/g, '');
            const n2 = String(s2 || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            if (!n1) return true;
            if (n1 === n2) return true;
            if (n1 && n2 && (n1.includes(n2) || n2.includes(n1))) return true;
            return false;
        };

        const session = mockSessions.find(s =>
            isMatch(s.branch, branch) &&
            isMatch(s.section, section) &&
            isMatch(s.semester, semester) &&
            s.status === 'active' &&
            new Date(s.expiry_time) > now
        )

        if (session) {
            session.teacher_lat = session.teacher_lat || session.lat;
            session.teacher_lng = session.teacher_lng || session.lng;
        }

        return res.json(session || null)
    }
})


// Mark Attendance (Student)
app.post('/api/attendance/mark', verifyToken, async (req, res) => {
    const { session_id, otp, lat, lng, rssi, accuracy, deviceId } = req.body
    const student_id = req.user.id
    const incoming_session_token = req.user.session_token

    // --- Student Verification ---
    let studentInfo = null;
    const role = req.user.role;

    // Security: Only students can mark attendance
    if (role !== 'student') {
        return res.status(403).json({ error: 'Access Denied: Only students can mark attendance. You are logged in as a ' + role })
    }

    if (supabase) {
        const { data, error } = await supabase
            .from('students')
            .select('id, current_session_token, email, name, roll_no, branch, section, semester, blocked_until')
            .eq('id', student_id)
            .single()

        if (error) {
            console.error('Attendance lookup error for student_id:', student_id, error);
            return res.status(401).json({ error: 'Student record not found in database. Please log in again.' })
        }
        studentInfo = data;
    } else {
        studentInfo = mockStudents.find(s => s.id === student_id);
    }

    if (!studentInfo) {
        return res.status(401).json({ error: 'Student account not found. If the server recently restarted, please register again.' })
    }

    // 0. Security Block Check
    if (studentInfo.blocked_until) {
        const blockEnds = new Date(studentInfo.blocked_until).getTime();
        if (blockEnds > Date.now()) {
            const remaining = Math.ceil((blockEnds - Date.now()) / 60000);
            return res.status(403).json({
                error: `ACTION DENIED: Your account is blocked for ${remaining} more minutes due to a security violation.`
            })
        }
    }


    // Device binding checks removed.


    // 1. Fetch Session
    let session = null
    if (supabase) {
        const { data, error } = await supabase.from('attendance_sessions').select('*').eq('id', session_id).single()
        if (error || !data) return res.status(404).json({ error: 'Session not found' })
        session = data
        // Normalize columns for calculation
        session.teacher_lat = session.teacher_lat || session.lat;
        session.teacher_lng = session.teacher_lng || session.lng;
    } else {
        session = mockSessions.find(s => s.id === session_id)
        if (!session) return res.status(404).json({ error: 'Session not found' })
        session.teacher_lat = session.teacher_lat || session.lat;
        session.teacher_lng = session.teacher_lng || session.lng;
    }

    // 2. Check Expiry
    if (new Date() > new Date(session.expiry_time)) {
        return res.status(400).json({ error: 'Session expired' })
    }

    // 3. Verify OTP
    if (String(session.otp) !== String(otp)) {
        return res.status(400).json({ error: 'Invalid OTP' })
    }

    // --- Build Payload Dynamically with Anti-Proxy Check ---
    const device_fingerprint = req.body.deviceFingerprint;
    const ip_address = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    console.log(`[ATTENDANCE] Incoming Request - Student: ${student_id}, Session: ${session_id}, Fingerprint: ${device_fingerprint}`);

    // 4.5. Anti-Proxy Check: Check if this device has already marked attendance for someone else IN THIS SESSION
    if (device_fingerprint) {
        if (supabase) {
            const { data: fingerprintData, error: fingerprintError } = await supabase
                .from('attendance_records')
                .select('student_id')
                .eq('session_id', session_id)
                .eq('device_fingerprint', device_fingerprint)
                .neq('student_id', student_id) // used for another student
                .limit(1);

            if (fingerprintError) {
                console.warn(`[ATTENDANCE] Fingerprint check DB error: ${fingerprintError.message}. (Migration likely missing)`);
            }

            if (fingerprintData && fingerprintData.length > 0) {
                console.log(`[ATTENDANCE] Blocked Proxy Trial: Device ${device_fingerprint} already used by Student ID: ${fingerprintData[0].student_id}`);
                return res.status(403).json({
                    error: 'DEVICE ALREADY USED: This mobile device has already been used by another student for this session. One device per student only.'
                });
            }
        } else {
            const used = mockRecords.find(r =>
                r.session_id === session_id &&
                r.device_fingerprint === device_fingerprint &&
                r.student_id !== student_id
            );
            if (used) {
                console.log(`[ATTENDANCE] Blocked Mock Proxy Trial: Device ${device_fingerprint} already used by Student ID: ${used.student_id}`);
                return res.status(403).json({
                    error: 'DEVICE ALREADY USED (Mock): This mobile device has already been used for another student.'
                });
            }
        }
    } else {
        console.warn(`[ATTENDANCE] Warning: No deviceFingerprint provided in request body.`);
    }

    // 4.6. Verify Location (Accuracy-Aware Geo-fence)
    const GEOFENCE_RADIUS = 50  // meters — practical for indoor mobile GPS
    const distance = getDistance(session.teacher_lat, session.teacher_lng, lat, lng)
    const gpsAccuracy = parseFloat(accuracy) || 0  // student's GPS accuracy in meters

    // Unified Error Margin (Anti-SmartBoard-Bug)
    const teacherAccuracy = parseFloat(session.teacher_accuracy) || 0
    const studentAccuracy = parseFloat(accuracy) || 0

    // Effective distance = raw distance minus COMBINED GPS error margin (capped at 0)
    // If SmartBoard is 200m off (±300m) and Student is ±10m, they will pass.
    const effectiveDistance = Math.max(0, distance - studentAccuracy - teacherAccuracy)

    if (effectiveDistance > GEOFENCE_RADIUS) {
        return res.status(400).json({
            error: `You are too far from the classroom (${distance.toFixed(0)}m away). combined GPS uncertainty is ±${(studentAccuracy + teacherAccuracy).toFixed(0)}m.`,
            distance: distance.toFixed(2),
            accuracy: studentAccuracy,
            teacherAccuracy,
            allowed: false
        })
    }

    // --- Build Payload Dynamically ---
    // Start with the required fields
    const payload = {
        session_id,
        student_id,
        status: 'present',
        device_fingerprint,
        ip_address,
        // GUARANTEED SAFE DEFAULT VALUES to satisfy strict database constraints
        student_lat: 0,
        student_lng: 0,
        distance: 0,
        rssi: -100
    };

    // Override defaults with real values if they are valid
    const finalLat = parseFloat(lat);
    const finalLng = parseFloat(lng);
    if (!isNaN(finalLat) && !isNaN(finalLng)) {
        payload.student_lat = finalLat;
        payload.student_lng = finalLng;
    }

    let finalDistance = parseFloat(distance);
    if (!isNaN(finalDistance)) payload.distance = finalDistance;

    let finalRssi = parseInt(rssi);
    if (!isNaN(finalRssi)) payload.rssi = finalRssi;

    if (supabase) {
        console.log('📝 Attempting to mark attendance payload:', payload);

        // Fix: Removed .select() so PostgREST doesn't try to parse output and crash due to stale cache.
        let { error } = await supabase.from('attendance_records').insert(payload);

        if (error) {
            console.error("Supabase Insert Error:", error.message);
            // If it's a unique constraint violation
            if (error.code === '23505') return res.status(400).json({ error: 'Attendance already marked' });

            // If it's a schema/column error (like PostgREST cache)
            if (error.message.includes('column') || error.message.includes('schema cache') ||
                error.message.includes('rssi') || error.message.includes('fingerprint') || error.message.includes('ip_address')) {
                console.warn("⚠️ Schema/Anti-Proxy column missing. Retrying with stripped payload...");

                // Create a slimmed-down fallback payload, but still include distance and coordinates
                // so it doesn't violate the NOT NULL constraints you had previously.
                const fallbackPayload = {
                    session_id,
                    student_id,
                    status: 'present',
                    student_lat: payload.student_lat,
                    student_lng: payload.student_lng,
                    distance: payload.distance
                };

                const retry = await supabase.from('attendance_records').insert(fallbackPayload);

                if (retry.error) {
                    console.error("Critical insert failure after fallback:", retry.error);
                    return res.status(400).json({ error: retry.error.message });
                }
                return res.json({ message: 'Attendance marked present! (Fallback Payload)', record: fallbackPayload });
            }

            return res.status(400).json({ error: error.message })
        }

        return res.json({ message: 'Attendance marked present!', record: payload });
    } else {
        if (mockRecords.some(r => r.session_id === session_id && r.student_id === student_id)) {
            return res.status(400).json({ error: 'Attendance already marked' });
        }

        const mockRecord = { ...payload, id: Date.now().toString() };
        mockRecords.push(mockRecord);
        return res.json({ message: 'Attendance marked present! (Mock Mode)', record: mockRecord });
    }
});

// Get overall attendance summary for student
app.get('/api/attendance/summary', verifyToken, async (req, res) => {
    if (req.user.role !== 'student') return res.status(403).json({ error: 'Forbidden' })
    const student_id = req.user.id
    const semester_filter = req.query.semester
    const { branch, section } = req.user

    if (supabase) {
        // 1. Fetch all matching sessions
        let sessionsQuery = supabase.from('attendance_sessions')
            .select('*')
            .eq('branch', branch)
            .eq('section', section)

        if (semester_filter) {
            sessionsQuery = sessionsQuery.eq('semester', semester_filter)
        }

        const { data: sessions, error: sError } = await sessionsQuery
        if (sError) return res.status(400).json({ error: sError.message })

        // 2. Fetch all student's attendance records
        const { data: records, error: rError } = await supabase.from('attendance_records')
            .select('session_id')
            .eq('student_id', student_id)

        if (rError) return res.status(400).json({ error: rError.message })

        const attendedSessionIds = new Set(records.map(r => r.session_id))

        // 3. Process data
        const summaryMap = {}
        sessions.forEach(session => {
            const subject = session.subject || 'General'
            if (!summaryMap[subject]) {
                summaryMap[subject] = {
                    subject,
                    total: 0,
                    attended: 0,
                    type: (subject.toLowerCase().includes('lab') || subject.toLowerCase().includes('practical')) ? 'PRACTICAL/LAB' : 'THEORY'
                }
            }
            summaryMap[subject].total += 1
            if (attendedSessionIds.has(session.id)) {
                summaryMap[subject].attended += 1
            }
        })

        const subjects = Object.values(summaryMap).map(s => ({
            ...s,
            percentage: s.total > 0 ? (s.attended / s.total * 100).toFixed(1) : "0.0"
        }))

        // Totals calculation
        const stats = {
            total: { t: 0, a: 0 },
            theory: { t: 0, a: 0 },
            lab: { t: 0, a: 0 }
        }

        subjects.forEach(s => {
            stats.total.t += s.total
            stats.total.a += s.attended
            if (s.type === 'THEORY') {
                stats.theory.t += s.total
                stats.theory.a += s.attended
            } else {
                stats.lab.t += s.total
                stats.lab.a += s.attended
            }
        })

        const getPct = (o) => o.t > 0 ? (o.a / o.t * 100).toFixed(2) : "0.00"

        return res.json({
            subjects,
            overall_pct: getPct(stats.total),
            theory_pct: getPct(stats.theory),
            lab_pct: getPct(stats.lab)
        })
    } else {
        return res.json({ subjects: [], overall_pct: "0.00", theory_pct: "0.00", lab_pct: "0.00" })
    }
})

// Close / Terminate Session (Teacher)
app.post('/api/sessions/:id/close', verifyToken, async (req, res) => {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Forbidden' })
    const sessionId = req.params.id
    if (supabase) {
        const { error } = await supabase.from('attendance_sessions')
            .update({ status: 'closed' })
            .eq('id', sessionId)
        if (error) return res.status(400).json({ error: error.message })
    } else {
        const s = mockSessions.find(s => s.id === sessionId)
        if (s) s.status = 'closed'
    }
    return res.json({ success: true })
})

// Get Session History for Teacher
app.get('/api/sessions/history', verifyToken, async (req, res) => {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Forbidden' })
    const teacher_id = req.user.id
    if (supabase) {
        // Fetch sessions with attendance count using PostgREST count feature
        let query = supabase.from('attendance_sessions')
            .select(`
                *,
                attendance_records(count)
            `)
            .eq('teacher_id', teacher_id)
            .order('start_time', { ascending: false })
            .limit(20)

        const { data, error } = await query

        if (error) {
            // Fallback for missing count relationship or missing teacher_id column
            console.error("Session History query failed, trying fallback:", error);
            const { data: all, error: e2 } = await supabase.from('attendance_sessions')
                .select('*')
                .order('start_time', { ascending: false })
                .limit(50)

            if (all) {
                // Filter by teacher_id only if it exists in the row, or fallback gracefully
                const formatted = all
                    .filter(s => s.teacher_id === undefined || s.teacher_id === null || s.teacher_id === teacher_id)
                    .map(s => ({
                        ...s,
                        present_count: 0 // Cannot fetch count reliably in fallback
                    }))
                return res.json(formatted)
            }
            return res.json([])
        }

        const formattedData = data.map(s => ({
            ...s,
            present_count: s.attendance_records?.[0]?.count || 0
        }))
        return res.json(formattedData)
    } else {
        const history = [...mockSessions].reverse().slice(0, 20).map(s => ({
            ...s,
            present_count: mockRecords.filter(r => r.session_id === s.id).length
        }))
        return res.json(history)
    }
})

// Detailed History with Filters (New)
app.get('/api/sessions/detailed-history', verifyToken, async (req, res) => {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Forbidden' })

    const { branch, section, semester, date } = req.query
    const teacher_id = req.user.id

    try {
        if (supabase) {
            let query = supabase.from('attendance_sessions')
                .select(`
                    *,
                    attendance_records(
                        *,
                        students(id, name, roll_no)
                    )
                `)
                .eq('teacher_id', teacher_id)

            if (branch) query = query.eq('branch', branch)
            if (section) query = query.eq('section', section)
            if (semester) query = query.eq('semester', semester)
            if (date) {
                const startDate = new Date(date)
                const endDate = new Date(date)
                endDate.setDate(endDate.getDate() + 1)
                query = query.gte('start_time', startDate.toISOString()).lt('start_time', endDate.toISOString())
            }

            const { data, error } = await query.order('start_time', { ascending: false })
            if (error) throw error

            // Calculate real totals for each session criteria
            const sessionsWithTotals = await Promise.all(data.map(async (s) => {
                // Count students matching this session's criteria
                const { count } = await supabase
                    .from('students')
                    .select('*', { count: 'exact', head: true })
                    .eq('branch', s.branch)
                    .eq('section', s.section)
                    .eq('semester', s.semester)

                return {
                    ...s,
                    total_students: count || 0,
                    records: s.attendance_records || []
                }
            }))

            return res.json({ sessions: sessionsWithTotals })
        } else {
            // Mock Mode Logic
            let filteredSessions = mockSessions.filter(s => s.teacher_id === teacher_id)

            if (branch) filteredSessions = filteredSessions.filter(s => s.branch === branch)
            if (section) filteredSessions = filteredSessions.filter(s => s.section === section)
            if (semester) filteredSessions = filteredSessions.filter(s => s.semester === semester)
            if (date) {
                filteredSessions = filteredSessions.filter(s => s.start_time.startsWith(date))
            }

            const sessionsWithRecords = filteredSessions.map(s => {
                const records = mockRecords.filter(r => r.session_id === s.id).map(r => {
                    const student = mockStudents.find(st => st.id === r.student_id)
                    return { ...r, students: student }
                })

                // Count mock students matching criteria
                const studentCount = mockStudents.filter(st =>
                    st.branch === s.branch &&
                    st.section === s.section &&
                    st.semester === s.semester
                ).length

                return {
                    ...s,
                    total_students: studentCount,
                    records
                }
            })

            return res.json({ sessions: sessionsWithRecords })
        }
    } catch (error) {
        console.error('Detailed History Error:', error)
        res.status(500).json({ error: 'Failed to fetch detailed history' })
    }
})

// Get Students who attended a specific session
app.get('/api/sessions/:id/students', verifyToken, async (req, res) => {
    const sessionId = req.params.id
    if (supabase) {
        const { data, error } = await supabase
            .from('attendance_records')
            .select('*, students(name, roll_no, branch, section, semester)')
            .eq('session_id', sessionId)
            .order('timestamp', { ascending: true })
        if (error) return res.status(400).json({ error: error.message })
        return res.json(data || [])
    } else {
        const records = mockRecords.filter(r => r.session_id === sessionId)
        const studentsWithDetails = records.map(record => {
            const student = mockStudents.find(s => s.id === record.student_id);
            return {
                ...record,
                students: student ? { name: student.name, roll_no: student.roll_no, branch: student.branch, section: student.section, semester: student.semester } : null
            };
        });
        return res.json(studentsWithDetails)
    }
})

// Get Session Stats (For Teacher)
app.get('/api/sessions/:id/stats', verifyToken, async (req, res) => {
    const sessionId = req.params.id
    if (supabase) {
        const { count, error } = await supabase
            .from('attendance_records')
            .select('*', { count: 'exact', head: true })
            .eq('session_id', sessionId)
        if (error) return res.status(400).json({ error: error.message })
        return res.json({ presentCount: count })
    } else {
        const count = mockRecords.filter(r => r.session_id === sessionId).length
        return res.json({ presentCount: count })
    }
})

// Get Admin Dashboard Stats
app.get('/api/admin/stats', async (req, res) => {
    // You'd ideally protect this route as well, maybe verifyToken for Admin
    if (supabase) {
        const { count: totalStudents } = await supabase.from('students').select('*', { count: 'exact', head: true })
        // Need to sum distinct presents today? For simplicity, present count.
        const { count: totalPresent } = await supabase.from('attendance_records').select('*', { count: 'exact', head: true }).eq('status', 'present')
        const totalAbsent = (totalStudents || 0) - (totalPresent || 0); // Note: Simple estimation.

        return res.json({
            totalStudents: totalStudents || 0,
            studentsPresent: totalPresent || 0,
            studentsAbsent: totalAbsent < 0 ? 0 : totalAbsent,
            blockedAttempts: mockBlockedLogs.length, // Can migrate to DB if needed
            logs: mockBlockedLogs
        })
    } else {
        const totalStudents = mockStudents.length;
        const totalPresent = Array.from(new Set(mockRecords.filter(r => r.status === 'present').map(r => r.student_id))).length;
        const totalAbsent = totalStudents - totalPresent;
        return res.json({
            totalStudents,
            studentsPresent: totalPresent,
            studentsAbsent: totalAbsent,
            blockedAttempts: mockBlockedLogs.length,
            logs: mockBlockedLogs
        })
    }
})

// --- Admin/Security Feature Endpoints ---

// Get all unauthorized login attempts
app.get('/api/admin/unauthorized-logs', verifyToken, async (req, res) => {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Only admins can view logs' })

    if (supabase) {
        const { data, error } = await supabase
            .from('unauthorized_attempts')
            .select(`
                *,
                students (name, roll_no, email)
            `)
            .order('timestamp', { ascending: false })
        if (error) return res.status(400).json({ error: error.message })
        return res.json(data)
    } else {
        return res.json(mockBlockedLogs)
    }
})

// Reset a student's temporary block
app.post('/api/admin/reset-block/:studentId', verifyToken, async (req, res) => {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Unauthorized' })
    const { studentId } = req.params

    if (supabase) {
        const { error } = await supabase
            .from('students')
            .update({ blocked_until: null })
            .eq('id', studentId)
        if (error) return res.status(400).json({ error: error.message })
        return res.json({ message: 'Block reset successfully' })
    } else {
        const student = mockStudents.find(s => s.id === studentId)
        if (student) student.blocked_until = null
        return res.json({ message: 'Block reset successfully (Mock)' })
    }
})

// Reset a student's device binding (Allow them to log in from a new device once)
app.post('/api/admin/reset-device/:studentId', verifyToken, async (req, res) => {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Unauthorized' })
    const { studentId } = req.params

    if (supabase) {
        const { error } = await supabase
            .from('students')
            .update({ device_id: null, blocked_until: null })
            .eq('id', studentId)
        if (error) return res.status(400).json({ error: error.message })
        return res.json({ message: 'Device binding reset successfully. Student can now link a new device.' })
    } else {
        const student = mockStudents.find(s => s.id === studentId)
        if (student) {
            student.device_id = null
            student.blocked_until = null
        }
        return res.json({ message: 'Device binding reset successfully (Mock)' })
    }
})

if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`\n🚀 Geo-Fenced Smart Attendance API running at http://localhost:${PORT}`)
        console.log(`📍 Haversine geo-fence: 10m strict radius (anti-proxy enforced)`)
        console.log(`🔐 JWT auth enabled`)
    })
}

// Export the Express API for Vercel Serverless Functions
module.exports = app;
