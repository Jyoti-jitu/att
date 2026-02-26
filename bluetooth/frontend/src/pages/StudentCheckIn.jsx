import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useLocation } from '../context/LocationContext'
import { getSession, markAttendance } from '../lib/supabase'
import { getDeviceFingerprint, getDeviceLabel, formatAsMac } from '../lib/deviceIdentity'
import {
    MapPin, CheckCircle, XCircle,
    User, Hash, MapPin, Clock, Shield,
    RefreshCw, AlertCircle, BookOpen, Signal, Scan
} from 'lucide-react'

function SignalBars({ rssi }) {
    const pct = Math.max(0, Math.min(100, ((rssi + 95) / 60) * 100))
    const filled = Math.round((pct / 100) * 5)
    const color = rssi >= -65 ? 'bg-success-400' : rssi >= -78 ? 'bg-warning-400' : 'bg-danger-400'
    return (
        <div className="flex items-end gap-1 justify-center">
            {[0, 1, 2, 3, 4].map(i => (
                <div key={i}
                    className={`w-3 rounded-sm transition-all ${i < filled ? color : 'bg-white/15'}`}
                    style={{ height: `${(i + 1) * 6 + 4}px` }}
                />
            ))}
        </div>
    )
}

// ── 4 clear steps ────────────────────────────────────────────────────────────
const STEP = {
    LOADING: 'loading',   // fetching session
    LOC_OFF: 'loc_off',   // blocker: location must be turned on
    SCANNING: 'scanning', // scanning for BLE signal
    FORM: 'form',     // enter name + roll
    SUCCESS: 'success',  // attendance marked
    ERROR: 'error',    // session not found / expired
}

export default function StudentCheckIn() {
    const { sessionId } = useParams()
    const navigate = useNavigate()
    const {
        btState, scanning, beaconRSSI, scanError, nearbyDevices,
        checkLocation, startScan, stopScan, requestLocationPrompt,
        RSSI_ABSENT, estimateDistance, rssiToLabel, rssiColor,
    } = useLocation()

    const [step, setStep] = useState(STEP.LOADING)
    const [session, setSession] = useState(null)
    const [sessionErr, setSessionErr] = useState('')
    const [name, setName] = useState('')
    const [roll, setRoll] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [submitErr, setSubmitErr] = useState('')
    const [record, setRecord] = useState(null)
    const [deviceInfo, setDeviceInfo] = useState(null)
    const [scanSeconds, setScanSeconds] = useState(0)

    const btPollRef = useRef(null)
    const scanTimerRef = useRef(null)
    const scanCountRef = useRef(null)

    // ── STEP 1: Load session on mount ─────────────────────────────────────────
    useEffect(() => {
        ; (async () => {
            try {
                const s = await getSession(sessionId)
                if (!s) return showError('Session not found. Check with your teacher.')
                if (!s.is_active) return showError('This session has already ended.')
                if (new Date(s.expires_at) < new Date()) return showError('This session has expired.')
                setSession(s)
                setDeviceInfo(getDeviceFingerprint())
                // After session loads → check BT
                checkBT()
            } catch (e) {
                showError('Could not load session: ' + e.message)
            }
        })()
        return cleanup
    }, [])

    function showError(msg) { setStep(STEP.ERROR); setSessionErr(msg) }

    function cleanup() {
        clearInterval(btPollRef.current)
        clearTimeout(scanTimerRef.current)
        clearInterval(scanCountRef.current)
        stopScan()
    }

    // ── STEP 2: Check BT state ────────────────────────────────────────────────
    async function checkBT() {
        const state = await checkLocation()
        if (state === 'off') {
            // BT is definitely OFF — show blocker and poll until on
            setStep(STEP.LOC_OFF)
            clearInterval(btPollRef.current)
            btPollRef.current = setInterval(async () => {
                const s2 = await checkLocation()
                if (s2 !== 'off') {
                    clearInterval(btPollRef.current)
                    beginScan()
                }
            }, 2000)
        } else {
            // BT is on, unknown, or unsupported → start scanning
            beginScan()
        }
    }

    // ── STEP 3: Scan ─────────────────────────────────────────────────────────
    function beginScan() {
        setStep(STEP.SCANNING)
        setScanSeconds(0)
        startScan()

        // Counter so user sees progress
        clearInterval(scanCountRef.current)
        scanCountRef.current = setInterval(() => setScanSeconds(s => s + 1), 1000)

        // After 12s force-advance to form regardless of signal
        clearTimeout(scanTimerRef.current)
        scanTimerRef.current = setTimeout(() => {
            clearInterval(scanCountRef.current)
            stopScan()
            setStep(STEP.FORM)
        }, 12000)
    }

    // Auto advance when strong signal detected
    useEffect(() => {
        if (step === STEP.SCANNING && beaconRSSI !== null && beaconRSSI > RSSI_ABSENT) {
            // Wait just a moment so user sees the signal, then advance
            clearTimeout(scanTimerRef.current)
            clearInterval(scanCountRef.current)
            scanTimerRef.current = setTimeout(() => {
                stopScan()
                setStep(STEP.FORM)
            }, 1500)
        }
    }, [beaconRSSI, step])

    // ── STEP 4: Submit ────────────────────────────────────────────────────────
    async function handleSubmit(e) {
        e.preventDefault()
        if (!name.trim() || !roll.trim()) return
        setSubmitting(true)
        setSubmitErr('')
        try {
            const rssi = beaconRSSI ?? -70
            const distance = estimateDistance(rssi)
            const rec = await markAttendance({
                sessionId,
                studentName: name.trim(),
                rollNumber: roll.trim().toUpperCase(),
                rssi, distance, deviceInfo,
            })
            setRecord(rec)
            setStep(STEP.SUCCESS)
        } catch (e) {
            setSubmitErr(e.message)
        } finally {
            setSubmitting(false)
        }
    }

    const dist = beaconRSSI !== null ? estimateDistance(beaconRSSI) : null
    const rssiPresent = beaconRSSI !== null && beaconRSSI > -70
    const rssiBorder = beaconRSSI !== null && beaconRSSI > RSSI_ABSENT && beaconRSSI <= -70

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen flex items-center justify-center px-4 py-12 page-enter">
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-1/3 left-1/4 w-96 h-96 bg-primary-700/20 rounded-full blur-3xl" />
                <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-accent-600/15 rounded-full blur-3xl" />
            </div>

            <div className="w-full max-w-md relative z-10 space-y-4">

                {/* ── Session top badge (shown during BT/scan/form steps) ── */}
                {session && [STEP.LOC_OFF, STEP.SCANNING, STEP.FORM].includes(step) && (
                    <div className="glass-card px-5 py-4 flex items-center justify-between">
                        <div>
                            <p className="text-xs text-white/40 uppercase tracking-wider mb-0.5">Attendance Session</p>
                            <p className="font-semibold text-white">{session.subject}</p>
                            <p className="text-sm text-white/50">{session.room} · {session.class_year}</p>
                        </div>
                        <span className="badge-present flex items-center gap-1.5 text-xs">
                            <span className="w-2 h-2 bg-success-400 rounded-full animate-pulse" /> Live
                        </span>
                    </div>
                )}

                {/* ═══════════════════════════════════════
            LOADING
            ═══════════════════════════════════════ */}
                {step === STEP.LOADING && (
                    <div className="glass-card p-12 text-center">
                        <div className="w-12 h-12 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto mb-4" />
                        <p className="text-white/60">Loading session…</p>
                    </div>
                )}

                {/* ═══════════════════════════════════════
            ERROR
            ═══════════════════════════════════════ */}
                {step === STEP.ERROR && (
                    <div className="glass-card p-10 text-center">
                        <div className="w-16 h-16 rounded-full bg-danger-500/15 border border-danger-500/30 flex items-center justify-center mx-auto mb-5">
                            <AlertCircle size={32} className="text-danger-400" />
                        </div>
                        <h2 className="font-display text-xl font-bold text-white mb-2">Session Unavailable</h2>
                        <p className="text-white/50 text-sm mb-6">{sessionErr}</p>
                        <button onClick={() => navigate('/')} className="btn-secondary w-full text-sm py-2.5">← Back to Home</button>
                    </div>
                )}

                {/* ═══════════════════════════════════════
            STEP 1 — LOCATION OFF BLOCKER
            ═══════════════════════════════════════ */}
                {step === STEP.LOC_OFF && (
                    <div className="glass-card p-8 text-center">
                        {/* Pulsing red BT icon */}
                        <div className="relative inline-block mb-6">
                            <div className="absolute -inset-4 rounded-full bg-danger-500/10 animate-ping" style={{ animationDuration: '2s' }} />
                            <div className="w-24 h-24 rounded-full bg-danger-500/15 border-2 border-danger-500/40 flex items-center justify-center">
                                <MapPin size={44} className="text-danger-400" />
                            </div>
                        </div>

                        <h2 className="font-display text-2xl font-bold text-white mb-1">Location is OFF</h2>
                        <p className="text-white/50 text-sm mb-6">
                            You must turn on Location so we can verify you are <strong className="text-white">physically inside the classroom</strong>.
                        </p>

                        {/* Instructions */}
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 text-left space-y-3 mb-6">
                            <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">How to turn on Location</p>
                            {[
                                { n: '1', t: 'Open your phone Settings' },
                                { n: '2', t: 'Tap "Location"' },
                                { n: '3', t: 'Toggle the switch to ON 🔵' },
                                { n: '4', t: 'Return here — detected automatically!' },
                            ].map(s => (
                                <div key={s.n} className="flex items-center gap-3">
                                    <div className="w-7 h-7 rounded-full bg-primary-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">{s.n}</div>
                                    <p className="text-sm text-white/70">{s.t}</p>
                                </div>
                            ))}
                        </div>

                        <div className="flex items-center justify-center gap-2 text-white/40 text-sm mb-4">
                            <RefreshCw size={14} className="animate-spin" />
                            Checking every 2 seconds…
                        </div>

                        <div className="space-y-3">
                            <button id="bt-retry-btn" onClick={checkBT}
                                className="btn-primary w-full flex items-center justify-center gap-2">
                                <RefreshCw size={15} /> I've Turned On Location
                            </button>

                            <button id="bt-prompt-btn" onClick={async () => {
                                const success = await requestLocationPrompt(setScanError)
                                if (success) checkBT()
                            }}
                                className="w-full py-3 px-4 rounded-xl bg-primary-500/10 hover:bg-primary-500/20 text-primary-400 border border-primary-500/30 text-sm font-semibold transition-all flex items-center justify-center gap-2 mt-2">
                                <MapPin size={16} /> Enable Location via Browser
                            </button>
                        </div>
                    </div>
                )}

                {/* ═══════════════════════════════════════
            STEP 2 — SCANNING
            ═══════════════════════════════════════ */}
                {step === STEP.SCANNING && (
                    <div className="glass-card p-8 text-center">
                        <div className="relative inline-block mb-6">
                            <div className="absolute -inset-4 rounded-full bg-primary-500/10 animate-ping" style={{ animationDuration: '2s' }} />
                            <div className="absolute -inset-8 rounded-full bg-primary-500/05 animate-ping" style={{ animationDuration: '3.5s' }} />
                            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary-600 to-accent-500 flex items-center justify-center shadow-glow">
                                <MapPin size={36} className="text-white animate-pulse" />
                            </div>
                        </div>

                        <h2 className="font-display text-2xl font-bold text-white mb-2">Scanning for Classroom</h2>
                        <p className="text-white/50 text-sm mb-6">
                            Stay inside the classroom with your phone unlocked. Detecting Location signal…
                        </p>

                        {/* Progress bar */}
                        <div className="h-1.5 bg-white/10 rounded-full mb-4 overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-primary-500 to-accent-500 rounded-full transition-all duration-1000"
                                style={{ width: `${Math.min(100, (scanSeconds / 12) * 100)}%` }} />
                        </div>
                        <p className="text-xs text-white/30 mb-6">{12 - scanSeconds > 0 ? `Scanning… ${12 - scanSeconds}s` : 'Almost done…'}</p>

                        {beaconRSSI !== null ? (
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3">
                                <p className="text-xs text-white/40 uppercase tracking-wider">Signal Detected!</p>
                                <div className={`font-display text-4xl font-bold ${rssiColor(beaconRSSI)}`}>{beaconRSSI} dBm</div>
                                <p className="text-sm text-white/50">{rssiToLabel(beaconRSSI)} · ≈{dist}m away</p>
                                <SignalBars rssi={beaconRSSI} />
                                {rssiPresent && (
                                    <div className="flex items-center justify-center gap-1.5 text-success-400 text-sm font-semibold">
                                        <CheckCircle size={15} /> In range — proceeding…
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 text-white/30">
                                <Scan size={24} className="mx-auto mb-2 opacity-50" />
                                <p className="text-sm">Searching for BLE devices…</p>
                                <p className="text-xs mt-1">Ensure you are inside the classroom</p>
                            </div>
                        )}

                        {scanError && (
                            <div className="mt-4 bg-warning-500/10 border border-warning-500/20 rounded-xl p-3 text-warning-300 text-sm">
                                ⚠️ {scanError} — using manual mode
                            </div>
                        )}

                        <button id="skip-scan-btn"
                            onClick={() => { cleanup(); setStep(STEP.FORM) }}
                            className="mt-5 text-xs text-white/25 hover:text-white/50 transition-colors underline-offset-2 underline">
                            Skip scan (manual entry)
                        </button>
                    </div>
                )}

                {/* ═══════════════════════════════════════
            STEP 3 — FORM: Name + Roll Number
            ═══════════════════════════════════════ */}
                {step === STEP.FORM && (
                    <div className="glass-card p-8">

                        {/* RSSI result badge */}
                        <div className={`flex items-center gap-3 rounded-xl p-3 mb-5 border ${beaconRSSI === null ? 'bg-white/5 border-white/10' :
                            rssiPresent ? 'bg-success-500/10 border-success-500/25' :
                                rssiBorder ? 'bg-warning-500/10 border-warning-500/25' :
                                    'bg-danger-500/10 border-danger-500/25'}`}>
                            <Signal size={18} className={beaconRSSI !== null ? rssiColor(beaconRSSI) : 'text-white/40'} />
                            <div className="flex-1">
                                {beaconRSSI !== null ? (
                                    <>
                                        <p className={`font-semibold text-sm ${rssiColor(beaconRSSI)}`}>
                                            {beaconRSSI} dBm · {rssiToLabel(beaconRSSI)}
                                        </p>
                                        <p className="text-xs text-white/40">
                                            ≈{dist}m ·{rssiPresent ? ' ✅ Present' : rssiBorder ? ' ⚠️ Borderline' : ' ❌ Weak signal'}
                                        </p>
                                    </>
                                ) : (
                                    <p className="text-sm text-white/50">No BT signal detected · Manual entry</p>
                                )}
                            </div>
                            {beaconRSSI !== null && <SignalBars rssi={beaconRSSI} />}
                        </div>

                        {/* Device badge */}
                        {deviceInfo && (
                            <div className="flex items-center gap-2 bg-primary-500/10 border border-primary-500/20 rounded-xl px-3 py-2 mb-5">
                                <MapPin size={12} className="text-primary-400" />
                                <span className="text-xs text-white/50">{getDeviceLabel()} · {formatAsMac(deviceInfo.deviceId)}</span>
                            </div>
                        )}

                        <h2 className="font-display text-xl font-bold text-white mb-5 flex items-center gap-2">
                            <User size={18} className="text-primary-400" /> Enter Your Details
                        </h2>

                        {submitErr && (
                            <div className="flex items-center gap-2 bg-danger-500/15 border border-danger-500/30 rounded-xl p-3 mb-4 text-danger-400 text-sm">
                                <AlertCircle size={15} className="flex-shrink-0" /> {submitErr}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="text-sm font-medium text-white/60 block mb-2">
                                    <User size={12} className="inline mr-1" /> Full Name
                                </label>
                                <input id="student-name-input" className="input-field"
                                    value={name} onChange={e => setName(e.target.value)}
                                    placeholder="e.g. Arjun Sharma" required autoFocus />
                            </div>

                            <div>
                                <label className="text-sm font-medium text-white/60 block mb-2">
                                    <Hash size={12} className="inline mr-1" /> Roll Number / Student ID
                                </label>
                                <input id="roll-input" className="input-field"
                                    value={roll} onChange={e => setRoll(e.target.value)}
                                    placeholder="e.g. CS2021001" required />
                            </div>

                            {/* Session mini summary */}
                            <div className="bg-white/5 rounded-xl p-4 text-xs text-white/40 space-y-1.5 border border-white/5">
                                <p className="flex items-center gap-1.5"><BookOpen size={11} /> {session?.subject}</p>
                                <p className="flex items-center gap-1.5"><MapPin size={11} /> {session?.room} · {session?.class_year}</p>
                                <p className="flex items-center gap-1.5"><Clock size={11} /> Expires {session ? new Date(session.expires_at).toLocaleTimeString() : '—'}</p>
                                <p className="flex items-center gap-1.5"><Shield size={11} /> Location proximity verified</p>
                            </div>

                            <button id="submit-btn" type="submit"
                                disabled={submitting || !name.trim() || !roll.trim()}
                                className="btn-primary w-full flex items-center justify-center gap-2">
                                {submitting
                                    ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving…</>
                                    : <><CheckCircle size={15} /> Mark My Attendance</>}
                            </button>
                        </form>
                    </div>
                )}

                {/* ═══════════════════════════════════════
            STEP 4 — SUCCESS
            ═══════════════════════════════════════ */}
                {step === STEP.SUCCESS && record && (() => {
                    const isPresent = record.status === 'Present'
                    const isBorder = record.status === 'Borderline'
                    const statusCls = isPresent ? 'text-success-400' : isBorder ? 'text-warning-400' : 'text-danger-400'
                    const iconBg = isPresent ? 'bg-success-500/20' : isBorder ? 'bg-warning-500/20' : 'bg-danger-500/20'
                    return (
                        <div className="glass-card p-10 text-center">
                            <div className={`w-20 h-20 rounded-full ${iconBg} flex items-center justify-center mx-auto mb-5`}>
                                {isPresent
                                    ? <CheckCircle size={42} className="text-success-400" />
                                    : isBorder
                                        ? <AlertCircle size={42} className="text-warning-400" />
                                        : <XCircle size={42} className="text-danger-400" />}
                            </div>

                            <h2 className="font-display text-2xl font-bold text-white mb-1">Attendance Marked!</h2>
                            <p className="text-white/50 text-sm mb-6">Saved to the database. Your teacher can see this now.</p>

                            <div className="space-y-2.5 text-left mb-6">
                                {[
                                    { label: 'Name', value: record.student_name },
                                    { label: 'Roll No.', value: record.roll_number },
                                    { label: 'Status', value: record.status, cls: statusCls },
                                    { label: 'Signal', value: `${record.rssi} dBm` },
                                    { label: 'Distance', value: `${record.distance_m} m` },
                                    { label: 'Subject', value: session?.subject },
                                    { label: 'Device', value: getDeviceLabel() },
                                    { label: 'Time', value: new Date(record.marked_at).toLocaleString() },
                                ].map(row => (
                                    <div key={row.label} className="flex items-center justify-between bg-white/5 rounded-lg px-4 py-2.5">
                                        <span className="text-sm text-white/50">{row.label}</span>
                                        <span className={`text-sm font-semibold ${row.cls || 'text-white'}`}>{row.value}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="bg-success-500/10 border border-success-500/25 rounded-xl p-3 text-success-300 text-sm mb-5 flex items-center gap-2">
                                <CheckCircle size={14} /> Visible in teacher's dashboard right now.
                            </div>
                            <button id="done-btn" onClick={() => navigate('/')} className="btn-secondary w-full text-sm">Done</button>
                        </div>
                    )
                })()}
            </div>
        </div>
    )
}
