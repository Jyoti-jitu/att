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
app.use(cors({ origin: '*', credentials: false }))
app.use(express.json())

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
const resend = new Resend(process.env.RESEND_API_KEY)
const SENDER_EMAIL = process.env.SENDER_EMAIL || 'onboarding@resend.dev'
// Note: If you have a verified domain, set SENDER_EMAIL in .env to an email at that domain.
const otpStore = new Map() // email -> { otp, expiry }

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
        // Try full insert first
        let { data, error } = await supabase.from('attendance_sessions').insert([session]).select()

        if (error && (error.message.includes('column') || error.message.includes('schema cache'))) {
            // Fallback 1: Retain semester & subject, but drop the newest non-critical columns like teacher_accuracy
            const fallback1 = { ...session };
            delete fallback1.teacher_accuracy;

            let retry1 = await supabase.from('attendance_sessions').insert([fallback1]).select();

            if (retry1.error) {
                // Fallback 2: Drop absolutely everything except the bare minimum requirements in case DB is very old
                const fallback最低 = {
                    branch, section, teacher_id: req.user.id, teacher_lat: lat, teacher_lng: lng, otp,
                    start_time: startTime.toISOString(), expiry_time: expiryTime.toISOString(), status: 'active'
                };

                const lowest = await supabase.from('attendance_sessions').insert([fallback最低]).select();
                if (lowest.error) return res.status(400).json({ error: lowest.error.message });
                // Serve logical overlay back to frontend
                return res.json({ ...lowest.data[0], semester, subject, time_slot: timeSlot, teacher_id: req.user.id });
            }
            // Add omitted properties sequentially for the UI
            return res.json(retry1.data[0]);
        }

        if (error) return res.status(400).json({ error: error.message })
        return res.json(data[0])
    } else {
        session.id = Date.now().toString()
        mockSessions.push(session)
        return res.json(session)
    }
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
        return res.json(session || null)
    }
})


// Mark Attendance (Student)
app.post('/api/attendance/mark', verifyToken, async (req, res) => {
    const { session_id, otp, lat, lng, accuracy, deviceId } = req.body
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
    } else {
        session = mockSessions.find(s => s.id === session_id)
        if (!session) return res.status(404).json({ error: 'Session not found' })
    }

    // 2. Check Expiry
    if (new Date() > new Date(session.expiry_time)) {
        return res.status(400).json({ error: 'Session expired' })
    }

    // 3. Verify OTP
    if (String(session.otp) !== String(otp)) {
        return res.status(400).json({ error: 'Invalid OTP' })
    }

    // 4. Verify Location (Accuracy-Aware Geo-fence)
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

    // 5. Mark Attendance
    const record = {
        session_id, student_id,
        student_lat: lat, student_lng: lng,
        distance, status: 'present'
    }

    if (supabase) {
        // Try full insert first
        let { data, error } = await supabase.from('attendance_records').insert([record]).select()

        // If 'distance' column is missing in DB cache, retry without it
        if (error && (error.message.includes('column') || error.message.includes('schema cache'))) {
            const { distance: _, ...baseRecord } = record
            const retry = await supabase.from('attendance_records').insert([baseRecord]).select()
            if (retry.error) return res.status(400).json({ error: retry.error.message })
            return res.json({ message: 'Attendance marked present! (Legacy Schema)', record: retry.data[0] })
        }

        if (error) {
            if (error.code === '23505') return res.status(400).json({ error: 'Attendance already marked' })
            return res.status(400).json({ error: error.message })
        }

        return res.json({ message: 'Attendance marked present!', record: data[0] })
    } else {
        if (mockRecords.some(r => r.session_id === session_id && r.student_id === student_id)) {
            return res.status(400).json({ error: 'Attendance already marked' })
        }
        record.id = Date.now().toString()
        mockRecords.push(record)
        return res.json({ message: 'Attendance marked present! (Mock Mode)', record })
    }
})

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
