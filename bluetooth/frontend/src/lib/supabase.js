import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

// Only treat as configured if URL looks like a real Supabase project
// (not a placeholder like "https://your-project.supabase.co")
const isRealUrl =
    supabaseUrl.includes('.supabase.co') &&
    !supabaseUrl.includes('your-project') &&
    !supabaseUrl.includes('your_project')

const isRealKey =
    supabaseAnonKey.length > 20 &&
    supabaseAnonKey !== 'your-anon-key' &&
    !supabaseAnonKey.startsWith('your')

export const isSupabaseConfigured = isRealUrl && isRealKey

export const supabase = isSupabaseConfigured
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null   // null → app runs in local demo mode with in-memory data

// ── Session helpers ───────────────────────────────────────────────────────

/** Create a new attendance session (teacher action) */
export async function createSession({ subject, room, teacherName, durationMinutes, classYear }) {
    if (!supabase) return localCreateSession({ subject, room, teacherName, durationMinutes, classYear })
    const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString()
    const { data, error } = await supabase
        .from('sessions')
        .insert({ subject, room, teacher_name: teacherName, duration_minutes: durationMinutes, class_year: classYear, expires_at: expiresAt, is_active: true })
        .select()
        .single()
    if (error) throw new Error(error.message)
    return data
}

/** Fetch a session by ID */
export async function getSession(sessionId) {
    if (!supabase) return localGetSession(sessionId)
    const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', sessionId)
        .single()
    if (error) throw new Error(error.message)
    return data
}

/** Get all sessions (admin view) */
export async function getSessions() {
    if (!supabase) return localGetSessions()
    const { data, error } = await supabase
        .from('sessions')
        .select('*, attendance_records(count)')
        .order('created_at', { ascending: false })
        .limit(20)
    if (error) throw new Error(error.message)
    return data
}

/**
 * Get the currently active session for students.
 *
 * Rules:
 *  1. Must have is_active = true
 *  2. expires_at must be in the future
 *  3. Must have been created TODAY (midnight → now) — yesterday's sessions never show
 *  4. Also auto-cleanup: any sessions with expires_at in the past are set to is_active=false
 */
export async function getActiveSession() {
    if (!supabase) {
        // local mode
        const now = new Date()
        const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
        return localSessions.find(s =>
            s.is_active &&
            new Date(s.expires_at) > now &&
            new Date(s.created_at) >= todayStart
        ) || null
    }

    const now = new Date()
    const nowISO = now.toISOString()

    // ── Step 1: Auto-deactivate sessions that have expired in the DB ──────
    // This ensures the admin panel also reflects the correct state automatically.
    await supabase
        .from('sessions')
        .update({ is_active: false })
        .eq('is_active', true)
        .lte('expires_at', nowISO)   // expires_at <= now → mark inactive

    // ── Step 2: Fetch only today's active session ─────────────────────────
    // Start of current day in local time, sent as ISO string
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayISO = todayStart.toISOString()

    const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('is_active', true)
        .gt('expires_at', nowISO)    // not expired
        .gte('created_at', todayISO) // created today — never show yesterday's sessions
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()               // null if no active session found

    if (error) throw new Error(error.message)
    return data
}


/** End a session early */
export async function endSession(sessionId) {
    if (!supabase) return localEndSession(sessionId)
    const { error } = await supabase
        .from('sessions')
        .update({ is_active: false })
        .eq('id', sessionId)
    if (error) throw new Error(error.message)
}


/** Mark attendance for a student (student action) */
export async function markAttendance({ sessionId, studentName, rollNumber, rssi, distance, deviceInfo }) {
    if (!supabase) return localMarkAttendance({ sessionId, studentName, rollNumber, rssi, distance, deviceInfo })

    // ── Guard 1: Session must still be active ─────────────────────────────
    // Verify directly against the DB — never trust client-side state alone
    const { data: session, error: sessionErr } = await supabase
        .from('sessions')
        .select('id, is_active, expires_at')
        .eq('id', sessionId)
        .single()

    if (sessionErr || !session) throw new Error('Session not found.')
    if (!session.is_active) throw new Error('This session has already been ended by the teacher. Attendance cannot be marked.')
    if (new Date(session.expires_at) <= new Date()) throw new Error('This session has expired. Attendance cannot be marked.')

    // ── Guard 2: Prevent duplicate entry per session + roll ───────────────
    const { data: existing } = await supabase
        .from('attendance_records')
        .select('id')
        .eq('session_id', sessionId)
        .eq('roll_number', rollNumber)
        .single()
    if (existing) throw new Error('You have already marked attendance for this session.')

    // ── Insert ────────────────────────────────────────────────────────────
    const status = rssi > -70 ? 'Present' : rssi > -85 ? 'Borderline' : 'Absent'
    const { data, error } = await supabase
        .from('attendance_records')
        .insert({
            session_id: sessionId,
            student_name: studentName,
            roll_number: rollNumber,
            rssi,
            distance_m: distance,
            status,
            device_fingerprint: deviceInfo?.fingerprint || null
        })
        .select()
        .single()

    if (error) throw new Error(error.message)
    return data
}



/** Get all attendance records for a session */
export async function getAttendanceRecords(sessionId) {
    if (!supabase) return localGetRecords(sessionId)
    const { data, error } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('session_id', sessionId)
        .order('marked_at', { ascending: false })
    if (error) throw new Error(error.message)
    return data
}

// ── Local in-memory fallback (no Supabase configured) ────────────────────
let localSessions = []
let localRecords = []
let idCounter = 1

function localCreateSession(data) {
    const session = {
        id: `local-${idCounter++}`,
        ...data,
        teacher_name: data.teacherName,
        duration_minutes: data.durationMinutes,
        class_year: data.classYear,
        expires_at: new Date(Date.now() + data.durationMinutes * 60 * 1000).toISOString(),
        is_active: true,
        created_at: new Date().toISOString(),
    }
    localSessions.unshift(session)
    return session
}
function localGetSession(id) { return localSessions.find(s => s.id === id) || null }
function localGetSessions() { return [...localSessions] }
function localEndSession(id) { const s = localSessions.find(x => x.id === id); if (s) s.is_active = false }
function localMarkAttendance({ sessionId, studentName, rollNumber, rssi, distance, deviceInfo }) {
    if (localRecords.find(r => r.session_id === sessionId && r.roll_number === rollNumber))
        throw new Error('You have already marked attendance for this session.')
    const status = rssi > -70 ? 'Present' : rssi > -85 ? 'Borderline' : 'Absent'
    const rec = {
        id: `rec-${idCounter++}`,
        session_id: sessionId, student_name: studentName, roll_number: rollNumber,
        rssi, distance_m: distance, status, marked_at: new Date().toISOString(),
        device_id: deviceInfo?.deviceId || null,
        device_platform: deviceInfo?.platform || null,
    }
    localRecords.push(rec)
    return rec
}
function localGetRecords(sessionId) { return localRecords.filter(r => r.session_id === sessionId) }
