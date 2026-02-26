import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
    createSession, endSession, getSessions, getAttendanceRecords, isSupabaseConfigured
} from '../lib/supabase'
import { subscribeToAttendance } from '../lib/realtime'
import {
    MapPin, Play, Square, Plus, Clock, Users, BookOpen,
    CheckCircle, XCircle, LogOut, Copy, RefreshCw,
    AlertTriangle, ArrowLeft, Wifi, Database
} from 'lucide-react'

const SUBJECTS = ['Data Structures', 'Operating Systems', 'DBMS', 'Computer Networks',
    'Software Engineering', 'Machine Learning', 'Web Development', 'Algorithms']
const ROOMS = ['Room 101', 'Room 201', 'Room 301', 'Lab A', 'Lab B', 'Seminar Hall']
const YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year']

function Badge({ status }) {
    const map = {
        Present: 'badge-present',
        Absent: 'badge-absent',
        Borderline: 'badge-scanning',
    }
    return <span className={map[status] || 'badge-scanning'}>{status}</span>
}

function CountdownTimer({ expiresAt, onExpire }) {
    const [left, setLeft] = useState('')
    const [pct, setPct] = useState(100)

    useEffect(() => {
        const expiry = new Date(expiresAt).getTime()
        const start = expiry - 60 * 60 * 1000 // assume max 60 min, adjust based on duration

        const tick = () => {
            const now = Date.now()
            const remaining = expiry - now
            if (remaining <= 0) { setLeft('Expired'); onExpire?.(); return }
            const mins = Math.floor(remaining / 60000)
            const secs = Math.floor((remaining % 60000) / 1000)
            setLeft(`${mins}m ${String(secs).padStart(2, '0')}s`)
            setPct(Math.max(0, (remaining / (expiry - (start))) * 100))
        }
        tick()
        const iv = setInterval(tick, 1000)
        return () => clearInterval(iv)
    }, [expiresAt])

    return (
        <div>
            <div className="text-xl font-bold font-display text-white">{left}</div>
            <div className="h-1.5 bg-white/10 rounded-full mt-2 overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-1000 ${pct > 40 ? 'bg-success-400' : pct > 15 ? 'bg-warning-400' : 'bg-danger-400'}`}
                    style={{ width: `${pct}%` }} />
            </div>
        </div>
    )
}

export default function TeacherSession() {
    const navigate = useNavigate()
    const { user, logout } = useAuth()

    // form state
    const [subject, setSubject] = useState(SUBJECTS[0])
    const [room, setRoom] = useState(ROOMS[0])
    const [year, setYear] = useState(YEARS[2])
    const [duration, setDuration] = useState(60)
    const [teacherName, setTeacherName] = useState(user?.name || '')

    // session state
    const [creating, setCreating] = useState(false)
    const [activeSession, setActiveSession] = useState(null)
    const [records, setRecords] = useState([])
    const [pastSessions, setPastSessions] = useState([])
    const [loadingRecords, setLoadingRecords] = useState(false)
    const [copied, setCopied] = useState(false)
    const [tab, setTab] = useState('create') // 'create' | 'active' | 'history'
    const pollRef = useRef(null)

    useEffect(() => {
        if (!user || user.role !== 'admin') navigate('/admin/login')
        loadPastSessions()
    }, [user])

    // Realtime subscription + fallback polling when session is active
    useEffect(() => {
        if (!activeSession) {
            if (pollRef.current) clearInterval(pollRef.current)
            return
        }
        fetchRecords()
        setTab('active')

        // Realtime (when Supabase is configured)
        const unsub = subscribeToAttendance(activeSession.id, (newRecord) => {
            setRecords(prev => {
                const exists = prev.find(r => r.id === newRecord.id)
                if (exists) return prev
                return [newRecord, ...prev]
            })
        })

        // Fallback polling every 5s (for demo/local mode)
        pollRef.current = setInterval(fetchRecords, 5000)

        return () => {
            unsub()
            if (pollRef.current) clearInterval(pollRef.current)
        }
    }, [activeSession])

    async function loadPastSessions() {
        try { setPastSessions(await getSessions()) } catch { }
    }

    async function fetchRecords() {
        if (!activeSession) return
        setLoadingRecords(true)
        try { setRecords(await getAttendanceRecords(activeSession.id)) }
        catch { }
        finally { setLoadingRecords(false) }
    }

    async function handleCreateSession() {
        setCreating(true)
        try {
            const session = await createSession({
                subject, room, teacherName, durationMinutes: duration, classYear: year
            })
            setActiveSession(session)
            loadPastSessions()
        } catch (e) {
            alert('Failed to create session: ' + e.message)
        } finally {
            setCreating(false)
        }
    }

    async function handleEndSession() {
        if (!activeSession) return
        if (!confirm('End this attendance session? Students will no longer be able to check in.')) return
        try {
            await endSession(activeSession.id)
            setActiveSession(null)
            setRecords([])
            loadPastSessions()
            setTab('history')
        } catch (e) {
            alert('Failed to end session: ' + e.message)
        }
    }

    function copySessionLink() {
        const link = `${window.location.origin}/checkin/${activeSession.id}`
        navigator.clipboard.writeText(link)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const stats = {
        total: records.length,
        present: records.filter(r => r.status === 'Present').length,
        absent: records.filter(r => r.status === 'Absent').length,
        border: records.filter(r => r.status === 'Borderline').length,
    }

    return (
        <div className="min-h-screen page-enter">
            {/* ── TOP NAV ── */}
            <nav className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-6 py-4
                      bg-primary-950/85 backdrop-blur-md border-b border-white/10">
                <div className="flex items-center gap-3">
                    <button id="teacher-back-btn" onClick={() => navigate('/admin/dashboard')}
                        className="flex items-center gap-1.5 text-white/50 hover:text-white text-sm transition-colors">
                        <ArrowLeft size={15} /> Dashboard
                    </button>
                    <div className="w-px h-5 bg-white/20" />
                    <div className="flex items-center gap-2">
                        <MapPin size={16} className="text-primary-400" />
                        <span className="font-display font-semibold text-white">Attendance Session Manager</span>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {!isSupabaseConfigured && (
                        <span className="flex items-center gap-1.5 text-warning-400 text-xs bg-warning-400/10 px-3 py-1.5 rounded-lg border border-warning-400/20">
                            <Database size={12} /> Demo Mode (no Supabase)
                        </span>
                    )}
                    <button id="teacher-logout-btn" onClick={() => { logout(); navigate('/') }}
                        className="flex items-center gap-2 text-sm text-white/50 hover:text-danger-400 transition-colors px-3 py-1.5 rounded-lg hover:bg-danger-500/10">
                        <LogOut size={15} /> Logout
                    </button>
                </div>
            </nav>

            <div className="pt-24 pb-12 px-6 max-w-5xl mx-auto">

                {/* ── TABS ── */}
                <div className="flex gap-2 mb-6">
                    {[
                        { id: 'create', label: 'New Session', icon: Plus },
                        { id: 'active', label: 'Active Session', icon: Wifi, disabled: !activeSession },
                        { id: 'history', label: 'History', icon: Clock },
                    ].map(t => {
                        const Icon = t.icon
                        return (
                            <button
                                key={t.id}
                                id={`tab-${t.id}`}
                                onClick={() => !t.disabled && setTab(t.id)}
                                disabled={t.disabled}
                                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all
                  ${tab === t.id
                                        ? 'bg-primary-600 text-white shadow-glow'
                                        : t.disabled
                                            ? 'text-white/20 cursor-not-allowed'
                                            : 'bg-white/10 text-white/60 hover:text-white hover:bg-white/15'}`}>
                                <Icon size={15} /> {t.label}
                                {t.id === 'active' && activeSession && (
                                    <span className="w-2 h-2 bg-success-400 rounded-full animate-pulse ml-0.5" />
                                )}
                            </button>
                        )
                    })}
                </div>

                {/* ══════════════ CREATE SESSION TAB ══════════════ */}
                {tab === 'create' && (
                    <div className="glass-card p-8 max-w-xl mx-auto">
                        <h2 className="font-display text-xl font-bold text-white mb-6 flex items-center gap-2">
                            <Plus size={20} className="text-primary-400" /> Create New Attendance Session
                        </h2>

                        <div className="space-y-5">
                            <div>
                                <label className="text-sm font-medium text-white/60 block mb-2">Teacher Name</label>
                                <input id="teacher-name-input" className="input-field" value={teacherName}
                                    onChange={e => setTeacherName(e.target.value)} placeholder="Your name" />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-white/60 block mb-2">Subject / Course</label>
                                <select id="subject-select" className="input-field bg-primary-900/50"
                                    value={subject} onChange={e => setSubject(e.target.value)}>
                                    {SUBJECTS.map(s => <option key={s} value={s} className="bg-primary-900">{s}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium text-white/60 block mb-2">Room / Location</label>
                                    <select id="room-select" className="input-field bg-primary-900/50"
                                        value={room} onChange={e => setRoom(e.target.value)}>
                                        {ROOMS.map(r => <option key={r} value={r} className="bg-primary-900">{r}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-white/60 block mb-2">Class Year</label>
                                    <select id="year-select" className="input-field bg-primary-900/50"
                                        value={year} onChange={e => setYear(e.target.value)}>
                                        {YEARS.map(y => <option key={y} value={y} className="bg-primary-900">{y}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-white/60 block mb-2">
                                    Session Duration: <span className="text-primary-400 font-bold">{duration} minutes</span>
                                </label>
                                <input id="duration-slider" type="range" min={10} max={180} step={5}
                                    value={duration} onChange={e => setDuration(Number(e.target.value))}
                                    className="w-full accent-primary-500 cursor-pointer" />
                                <div className="flex justify-between text-xs text-white/30 mt-1">
                                    <span>10 min</span><span>3 hrs</span>
                                </div>
                            </div>

                            <div className="bg-primary-600/15 border border-primary-500/25 rounded-xl p-4 text-sm text-primary-300">
                                <strong>How it works:</strong> After creating a session, share the check-in link with students.
                                Students must be <strong>physically present</strong> (Location in range) to mark attendance.
                                The link auto-expires after <strong>{duration} minutes</strong>.
                            </div>

                            <button
                                id="create-session-btn"
                                onClick={handleCreateSession}
                                disabled={creating || !teacherName.trim()}
                                className="btn-primary w-full flex items-center justify-center gap-2">
                                {creating
                                    ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Creating…</>
                                    : <><Play size={16} /> Start Session ({duration} min)</>}
                            </button>
                        </div>
                    </div>
                )}

                {/* ══════════════ ACTIVE SESSION TAB ══════════════ */}
                {tab === 'active' && activeSession && (
                    <div className="space-y-5">
                        {/* session info card */}
                        <div className="glass-card p-6">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div>
                                    <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-1">Active Session</p>
                                    <h2 className="font-display text-2xl font-bold text-white">{activeSession.subject}</h2>
                                    <p className="text-white/50 text-sm mt-1">
                                        {activeSession.room} · {activeSession.class_year} · By {activeSession.teacher_name}
                                    </p>
                                </div>
                                <CountdownTimer
                                    expiresAt={activeSession.expires_at}
                                    onExpire={() => { setActiveSession(null); setTab('history') }}
                                />
                            </div>

                            {/* session ID & share */}
                            <div className="mt-5 p-4 bg-black/20 rounded-xl border border-white/10">
                                <p className="text-xs text-white/40 mb-2">Student Check-In Link</p>
                                <div className="flex items-center gap-3">
                                    <code className="text-sm text-primary-300 font-mono flex-1 truncate">
                                        {window.location.origin}/checkin/{activeSession.id}
                                    </code>
                                    <button id="copy-link-btn" onClick={copySessionLink}
                                        className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-semibold transition-all
                      ${copied ? 'bg-success-500/20 text-success-400 border border-success-500/30' : 'bg-white/10 hover:bg-white/20 text-white/60 border border-white/15'}`}>
                                        <Copy size={12} /> {copied ? 'Copied!' : 'Copy'}
                                    </button>
                                </div>
                                <p className="text-xs text-white/30 mt-2">
                                    Share this link with students. They must be physically in range of the classroom Location beacon to check in.
                                </p>
                            </div>

                            <div className="flex justify-end mt-4">
                                <button id="end-session-btn" onClick={handleEndSession}
                                    className="btn-danger flex items-center gap-2 text-sm px-5 py-2.5">
                                    <Square size={14} /> End Session
                                </button>
                            </div>
                        </div>

                        {/* stats */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {[
                                { label: 'Checked In', value: stats.total, color: 'from-blue-600 to-cyan-500', icon: Users },
                                { label: 'Present', value: stats.present, color: 'from-emerald-600 to-green-500', icon: CheckCircle },
                                { label: 'Absent', value: stats.absent, color: 'from-red-600 to-red-500', icon: XCircle },
                                { label: 'Borderline', value: stats.border, color: 'from-amber-600 to-yellow-500', icon: AlertTriangle },
                            ].map(c => {
                                const Icon = c.icon
                                return (
                                    <div key={c.label} className="glass-card p-5 flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${c.color} flex items-center justify-center`}>
                                            <Icon size={18} className="text-white" />
                                        </div>
                                        <div>
                                            <div className="font-display text-2xl font-bold text-white">{c.value}</div>
                                            <div className="text-xs text-white/50">{c.label}</div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                        {/* live records table */}
                        <div className="glass-card overflow-hidden">
                            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
                                <h3 className="font-display font-semibold text-white flex items-center gap-2">
                                    <MapPin size={16} className="text-primary-400 animate-pulse" /> Live Attendance
                                </h3>
                                <button id="refresh-records-btn" onClick={fetchRecords}
                                    className="text-white/40 hover:text-white transition-colors">
                                    <RefreshCw size={16} className={loadingRecords ? 'animate-spin' : ''} />
                                </button>
                            </div>
                            {records.length === 0 ? (
                                <div className="text-center py-16 text-white/30">
                                    <MapPin size={40} className="mx-auto mb-3 opacity-30" />
                                    <p>No students have checked in yet.</p>
                                    <p className="text-sm mt-1">Share the check-in link with your students.</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead className="bg-white/5">
                                            <tr>
                                                {['#', 'Student Name', 'Roll Number', 'RSSI', 'Distance', 'Status', 'Time'].map(h => (
                                                    <th key={h} className="table-header">{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {records.map((r, i) => (
                                                <tr key={r.id} className="hover:bg-white/5 transition-colors animate-slide-up">
                                                    <td className="table-cell text-white/30 text-xs">{i + 1}</td>
                                                    <td className="table-cell font-semibold text-white">{r.student_name}</td>
                                                    <td className="table-cell font-mono text-white/60 text-xs">{r.roll_number}</td>
                                                    <td className={`table-cell font-bold ${r.rssi >= -65 ? 'text-green-400' : r.rssi >= -78 ? 'text-yellow-400' : 'text-red-400'}`}>
                                                        {r.rssi} dBm
                                                    </td>
                                                    <td className="table-cell text-accent-400">{r.distance_m} m</td>
                                                    <td className="table-cell"><Badge status={r.status} /></td>
                                                    <td className="table-cell text-white/40 text-xs">
                                                        {new Date(r.marked_at).toLocaleTimeString()}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ══════════════ HISTORY TAB ══════════════ */}
                {tab === 'history' && (
                    <div className="space-y-4">
                        <h2 className="font-display text-lg font-bold text-white">Past Sessions</h2>
                        {pastSessions.length === 0 ? (
                            <div className="glass-card p-12 text-center text-white/30">
                                <Clock size={40} className="mx-auto mb-3 opacity-30" />
                                <p>No sessions yet. Create your first session above.</p>
                            </div>
                        ) : (
                            pastSessions.map(s => (
                                <div key={s.id} className="glass-card p-5 hover:bg-white/10 transition-all">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="font-semibold text-white">{s.subject}</div>
                                            <div className="text-sm text-white/50 mt-0.5">{s.room} · {s.class_year} · {s.teacher_name}</div>
                                            <div className="text-xs text-white/30 mt-1">{new Date(s.created_at).toLocaleString()}</div>
                                        </div>
                                        <div className="text-right">
                                            <span className={`badge-${s.is_active ? 'scanning' : 'absent'}`}>
                                                {s.is_active ? 'Active' : 'Ended'}
                                            </span>
                                            <div className="text-sm text-white/40 mt-1">{s.duration_minutes} min session</div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
