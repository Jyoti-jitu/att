import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getCurrentLocation, getDistance } from '../lib/geo';
import {
    User, Smartphone, Wifi, MapPin, ShieldCheck, LogOut, Zap,
    Target, CheckCircle2, AlertCircle, Loader2, Clock, BookOpen,
    Navigation, Radio, XCircle, Lock, GraduationCap, Users
} from 'lucide-react';
import toast from 'react-hot-toast';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const StudentDashboard = () => {
    const { user, logout, isDemoMode, setIsDemoMode, refreshUser } = useAuth();
    const navigate = useNavigate();
    const [activeSession, setActiveSession] = useState(null);
    const [loading, setLoading] = useState(true);
    const [marking, setMarking] = useState(false);
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [distance, setDistance] = useState(null);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [locationAccuracy, setLocationAccuracy] = useState(null);
    const [liveLocation, setLiveLocation] = useState(null);
    const [gpsStatus, setGpsStatus] = useState('idle'); // idle | scanning | ok | blocked
    const [sessionTimeLeft, setSessionTimeLeft] = useState(0);
    const [liveDistance, setLiveDistance] = useState(null);
    const [blockTimeLeft, setBlockTimeLeft] = useState(0); // Seconds until unblock
    const [windowWidth, setWindowWidth] = useState(window.innerWidth);
    const otpRefs = useRef([]);

    useEffect(() => {
        if (user && user.role !== 'student') {
            navigate('/teacher/dashboard');
            return;
        }
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [user, navigate]);

    const isMobile = windowWidth <= 768;
    const isTiny = windowWidth <= 480;

    // Block Checks
    const isAccountBlocked = blockTimeLeft > 0;

    const checkSession = async () => {
        try {
            const res = await fetch(`${API}/api/sessions/active`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const data = await res.json();
            setActiveSession(data);
            if (data?.expiry_time) {
                const secs = Math.max(0, Math.floor((new Date(data.expiry_time) - new Date()) / 1000));
                setSessionTimeLeft(secs);
            } else {
                // No active session — clear GPS state
                setLiveDistance(null);
                setGpsStatus('idle');
            }
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    useEffect(() => {
        const syncData = () => {
            checkSession();
            // High-frequency polling (5s) when restricted to catch teacher's "Authorize" action
            if (user?.blocked_until) refreshUser();
        };
        syncData();
        const interval = setInterval(syncData, (user?.blocked_until) ? 5000 : 10000);
        return () => clearInterval(interval);
    }, [user?.blocked_until]);

    // Countdown for Security Block (Uses server-provided remaining seconds)
    useEffect(() => {
        if (user?.remaining_block_seconds) {
            setBlockTimeLeft(user.remaining_block_seconds);
        }
    }, [user?.remaining_block_seconds]);

    useEffect(() => {
        if (blockTimeLeft <= 0) return;
        const timer = setInterval(() => {
            setBlockTimeLeft(prev => {
                if (prev <= 1) {
                    refreshUser();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [blockTimeLeft]);

    // Countdown timer for session
    useEffect(() => {
        if (sessionTimeLeft <= 0) return;
        const timer = setInterval(() => setSessionTimeLeft(p => Math.max(0, p - 1)), 1000);
        return () => clearInterval(timer);
    }, [sessionTimeLeft]);

    // OPTIMIZED GPS TRACKING: Uninterrupted Watcher
    // We run watchPosition exactly once on mount so the GPS hardware stays "warm" and locked.
    // It does not depend on activeSession, preventing the hardware from resetting when a session starts.
    useEffect(() => {
        let watchId;
        if (navigator.geolocation) {
            watchId = navigator.geolocation.watchPosition(
                (pos) => {
                    const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                    const acc = pos.coords.accuracy || 0;
                    setLiveLocation(loc);
                    setLocationAccuracy(acc);
                },
                (err) => {
                    console.error("Continuous GPS Watch Error:", err);
                    if (err.code === 1) { // PERMISSION_DENIED
                        toast.error('Location Access Denied. Please enable location services for attendance.', { id: 'gps-perm' });
                        setGpsStatus('error');
                    }
                },
                {
                    enableHighAccuracy: true,
                    maximumAge: 5000,     // Allow 5-second cache for responsiveness
                    timeout: 10000        // Aggressive timeout to force updates
                }
            );
        } else {
            setGpsStatus('error');
            toast.error('Geolocation is not supported by your browser.');
        }
        return () => { if (watchId) navigator.geolocation.clearWatch(watchId); };
    }, []); // Empty dependency array = Never drops the GPS hardware lock!

    // Distance & Verification Logic
    useEffect(() => {
        if (!activeSession) {
            setLiveDistance(null);
            setGpsStatus(liveLocation ? 'idle' : 'scanning');
            return;
        }

        // Demo mode: simulate being close to teacher
        if (isDemoMode) {
            const demoLat = activeSession.teacher_lat + 0.00004; // ~4m north
            const demoLng = activeSession.teacher_lng;
            const d = getDistance(activeSession.teacher_lat, activeSession.teacher_lng, demoLat, demoLng);
            setLiveLocation({ lat: demoLat, lng: demoLng });
            setLiveDistance(d);
            setGpsStatus('ok');
            return;
        }

        if (!liveLocation) {
            setGpsStatus('scanning');
            return;
        }

        const d = getDistance(activeSession.teacher_lat, activeSession.teacher_lng, liveLocation.lat, liveLocation.lng);
        setLiveDistance(d);

        // Buffer status: Stay 'ok' if within 50m of teacher minus accuracy buffer
        const effectiveDist = Math.max(0, d - locationAccuracy);
        if (locationAccuracy > 60 && effectiveDist > 50) {
            // Accuracy is too bad to confidently block or approve
            setGpsStatus('scanning');
        } else {
            setGpsStatus(effectiveDist <= 50 ? 'ok' : 'blocked');
        }
    }, [activeSession, liveLocation, locationAccuracy, isDemoMode]);

    const handleOtpChange = (idx, val) => {
        if (!/^\d*$/.test(val)) return;
        const newOtp = [...otp];
        newOtp[idx] = val.slice(-1);
        setOtp(newOtp);
        if (val && idx < 5) otpRefs.current[idx + 1]?.focus();
    };

    const handleMarkAttendance = async () => {
        setError('');
        setMarking(true);
        const otpStr = otp.join('');

        try {
            let loc = null;

            if (isDemoMode) {
                loc = { lat: activeSession.teacher_lat + 0.00004, lng: activeSession.teacher_lng, accuracy: 10 };
            } else {
                // Optimization: If we already have a recent, high-accuracy live location, use it instead of forcing a full new hardware poll.
                if (liveLocation && locationAccuracy < 30 && gpsStatus !== 'scanning' && gpsStatus !== 'error') {
                    loc = { lat: liveLocation.lat, lng: liveLocation.lng, accuracy: locationAccuracy };
                } else {
                    // "No Glitch" Protocol: Force a fresh, high-priority location lock on click only if we don't have a good lock
                    toast.loading('Locking onto GPS satellites...', { id: 'gps-lock' });
                    try {
                        loc = await getCurrentLocation(); // Forced fresh read (maxAge: 0)
                        toast.success('Location locked!', { id: 'gps-lock' });
                    } catch (err) {
                        toast.error('GPS Error: Please ensure Location is ON and high-accuracy is enabled.', { id: 'gps-lock' });
                        throw err;
                    }
                }
            }

            const dist = getDistance(activeSession.teacher_lat, activeSession.teacher_lng, loc.lat, loc.lng);
            setDistance(dist);
            setLiveDistance(dist);
            setLocationAccuracy(loc.accuracy);
            setLiveLocation({ lat: loc.lat, lng: loc.lng });

            // Accuracy-Aware Check (within 50m radius + accuracy buffer)
            const effectiveDist = Math.max(0, dist - (loc.accuracy || 0));
            if (effectiveDist > 50) {
                const err = `Location mismatch. You are approx. ${dist.toFixed(0)}m away from the classroom center. (Required: within 50m)`;
                setError(err);
                toast.error(err);
                setMarking(false);
                return;
            }

            const res = await fetch(`${API}/api/attendance/mark`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    session_id: activeSession.id,
                    otp: otpStr,
                    lat: loc.lat,
                    lng: loc.lng,
                    accuracy: loc.accuracy || 0,
                    deviceId: localStorage.getItem('deviceId')
                })
            });
            const data = await res.json();
            if (res.ok) {
                toast.success('Verified! Attendance Recorded.');
                setSuccess(true);
            } else {
                const errMsg = data.error || 'Verification failed.';
                setError(errMsg);
                toast.error(errMsg);
            }
        } catch (err) {
            console.error('Attendance error:', err);
            if (err.message && err.message.includes('Location')) {
                setError(err.message);
            } else {
                setError('System Error: Communication failed.');
            }
        } finally {
            setMarking(false);
        }
    };

    const formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
    const timerColor = sessionTimeLeft < 30 ? '#ef4444' : sessionTimeLeft < 60 ? '#f59e0b' : '#22c5e0';

    const gpsColors = {
        idle: { bg: '#f8fafc', border: '#e2e8f0', text: '#64748b', icon: <Navigation size={22} color="#94a3b8" /> },
        scanning: { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8', icon: <Loader2 size={22} color="#3b82f6" className="animate-spin" /> },
        ok: { bg: '#f0fdf4', border: '#86efac', text: '#15803d', icon: <CheckCircle2 size={22} color="#22c55e" /> },
        blocked: { bg: '#fef2f2', border: '#fca5a5', text: '#b91c1c', icon: <XCircle size={22} color="#ef4444" /> },
        error: { bg: '#fff7ed', border: '#fdba74', text: '#c2410c', icon: <AlertCircle size={22} color="#f97316" /> },
    };
    const gps = gpsColors[gpsStatus] || gpsColors.idle;

    return (
        <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #f0f4ff 0%, #e8effe 50%, #f5f3ff 100%)', fontFamily: "'Outfit', sans-serif" }}>
            <div className="bg-mesh" />

            {/* NAVBAR */}
            <nav style={{
                background: 'rgba(255,255,255,0.85)',
                backdropFilter: 'blur(20px)',
                borderBottom: '1px solid rgba(99,102,241,0.12)',
                padding: '0',
                position: 'sticky',
                top: 0,
                zIndex: 100,
                boxShadow: '0 2px 20px rgba(99,102,241,0.08)'
            }}>
                <div style={{ maxWidth: '1200px', margin: '0 auto', padding: isMobile ? '0 1rem' : '0 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: isMobile ? '64px' : '72px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '0.5rem' : '0.875rem' }}>
                        <div style={{ width: isMobile ? '36px' : '44px', height: isMobile ? '36px' : '44px', borderRadius: '10px', background: 'linear-gradient(135deg, #4f46e5, #2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(79,70,229,0.3)' }}>
                            <Radio size={isMobile ? 18 : 22} color="white" />
                        </div>
                        <div>
                            <div style={{ fontSize: isMobile ? '0.95rem' : '1.15rem', fontWeight: 800, color: '#1e3a8a' }}>Student Portal</div>
                            {!isTiny && <div style={{ fontSize: '0.65rem', color: '#6366f1', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>GeoAttend System</div>}
                        </div>
                    </div>
                    <button onClick={logout} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: isMobile ? '0.4rem 0.8rem' : '0.5rem 1.1rem', borderRadius: '10px', background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', fontWeight: 700, fontSize: isMobile ? '0.75rem' : '0.875rem', cursor: 'pointer' }}>
                        <LogOut size={14} /> Logout
                    </button>
                </div>
            </nav>

            <div style={{ maxWidth: '1200px', margin: '0 auto', padding: isMobile ? '1.5rem 1rem' : '2.5rem 2rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '340px 1fr', gap: isMobile ? '1.5rem' : '2rem', alignItems: 'start' }}>

                    {/* ── LEFT: Profile Card ── */}
                    <div style={{ display: 'flex', flexDirection: isMobile ? 'column-reverse' : 'column', gap: '1.5rem' }}>
                        <div style={{ background: 'white', borderRadius: '24px', padding: isMobile ? '1.5rem' : '2rem', boxShadow: '0 6px 30px rgba(79,70,229,0.09)', border: '1px solid rgba(99,102,241,0.1)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.75rem' }}>
                                <div style={{ width: isMobile ? '48px' : '54px', height: isMobile ? '48px' : '54px', borderRadius: '14px', background: 'linear-gradient(135deg, #4f46e5, #2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(79,70,229,0.3)' }}>
                                    <User size={isMobile ? 22 : 26} color="white" />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: isMobile ? '1.1rem' : '1.3rem', fontWeight: 800, color: '#1e293b' }}>{user?.name}</div>
                                    <div style={{ fontSize: isMobile ? '0.75rem' : '0.85rem', color: '#6366f1', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{user?.roll_no}</div>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: isMobile ? '0.5rem' : '0.85rem' }}>
                                {[
                                    { icon: <GraduationCap size={16} />, label: 'Branch & Sem', val: `${user?.branch} • Sem ${user?.semester}` },
                                    { icon: <Smartphone size={16} />, label: 'Device Status', val: 'Active' },
                                    { icon: <ShieldCheck size={16} />, label: 'Verified Contact', val: user?.mobile },
                                ].map((item, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', background: '#f8fafc', borderRadius: '14px', border: '1px solid #f1f5f9' }}>
                                        <div style={{ color: '#6366f1' }}>{item.icon}</div>
                                        <div>
                                            <div style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.1rem' }}>{item.label}</div>
                                            <div style={{ fontSize: isMobile ? '0.8rem' : '0.875rem', fontWeight: 700, color: '#334155' }}>{item.val}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        {/* Live GPS Status Card */}
                        <div style={{ background: gps.bg, border: `2px solid ${gps.border}`, borderRadius: '20px', padding: '1.5rem', transition: 'all 0.4s' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                                {gps.icon}
                                <div style={{ fontWeight: 800, color: gps.text, fontSize: '0.95rem' }}>
                                    {gpsStatus === 'idle' && 'GPS Standby'}
                                    {gpsStatus === 'scanning' && 'Acquiring Location...'}
                                    {gpsStatus === 'ok' && 'Location Verified ✓'}
                                    {gpsStatus === 'blocked' && 'Outside 50m Radius'}
                                    {gpsStatus === 'error' && 'GPS Signal Error'}
                                </div>
                            </div>
                            {liveDistance !== null && (
                                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: gps.text }}>
                                    Distance from classroom: <strong>{liveDistance.toFixed(1)}m</strong>
                                    {Math.max(0, liveDistance - locationAccuracy) <= 50 ? ' — Within 50m range ✓' : ` — You are outside the 50m radius. Move ${(liveDistance - locationAccuracy - 50).toFixed(1)}m closer`}
                                </div>
                            )}
                            {locationAccuracy && (
                                <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.3rem' }}>GPS Accuracy: ±{locationAccuracy.toFixed(0)}m</div>
                            )}
                        </div>
                    </div>

                    {/* ── RIGHT: Attendance Card ── */}
                    <div>
                        {loading ? (
                            <div style={{ background: 'white', borderRadius: '24px', padding: '4rem', textAlign: 'center', boxShadow: '0 6px 30px rgba(79,70,229,0.09)', border: '1px solid rgba(99,102,241,0.1)' }}>
                                <Loader2 size={40} color="#6366f1" style={{ margin: '0 auto 1rem', animation: 'spin 1s linear infinite' }} />
                                <p style={{ color: '#64748b', fontWeight: 600 }}>Scanning for active sessions...</p>
                            </div>
                        ) : activeSession ? (
                            <div>
                                {/* Device info removed */}

                                {isAccountBlocked && (
                                    <div style={{
                                        background: '#fff7ed',
                                        border: '1px solid #fdba74',
                                        borderRadius: '16px',
                                        padding: '1.25rem',
                                        marginBottom: '1.5rem',
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        gap: '1rem',
                                        boxShadow: '0 4px 12px rgba(249,115,22,0.05)'
                                    }}>
                                        <Clock size={20} color="#ea580c" style={{ flexShrink: 0, marginTop: '0.1rem' }} />
                                        <div>
                                            <div style={{ color: '#9a3412', fontWeight: 800, fontSize: '0.95rem' }}>Account Temporarily Blocked</div>
                                            <div style={{ color: '#c2410c', fontSize: '0.82rem', fontWeight: 500, marginTop: '0.2rem', lineHeight: 1.4 }}>
                                                Attendance marking is disabled for <strong>{Math.floor(blockTimeLeft / 60)}:{(blockTimeLeft % 60).toString().padStart(2, '0')}</strong> minutes due to security mismatches. Wait or contact faculty.
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {/* Session Info Banner */}
                                <div style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)', borderRadius: '20px', padding: '1.5rem 2rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', boxShadow: '0 8px 30px rgba(79,70,229,0.25)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '0.75rem' : '1rem' }}>
                                        <div style={{ position: 'relative' }}>
                                            <div style={{ width: isMobile ? '38px' : '44px', height: isMobile ? '38px' : '44px', borderRadius: '50%', background: 'rgba(34,197,94,0.15)', border: '2px solid rgba(34,197,94,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <Radio size={isMobile ? 18 : 22} color="#4ade80" />
                                            </div>
                                            <div style={{ position: 'absolute', top: 0, right: 0, width: '10px', height: '10px', background: '#22c5e0', borderRadius: '50%', border: '2px solid #0f172a', animation: 'gpsPulse 1.5s infinite' }} />
                                        </div>
                                        <div>
                                            <div style={{ color: '#4ade80', fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '0.3rem' }}>● Live Session</div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                                <div style={{ color: 'white', fontSize: isMobile ? '1.2rem' : '1.5rem', fontWeight: 900, letterSpacing: '-0.01em' }}>
                                                    {activeSession.subject || 'Class in Progress'}
                                                </div>
                                                <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginTop: '0.2rem' }}>
                                                    <span style={{ fontSize: '0.75rem', color: '#4ade80', fontWeight: 900, background: 'rgba(34,197,94,0.15)', padding: '0.3rem 0.8rem', borderRadius: '10px', border: '1px solid rgba(34,197,94,0.3)' }}>Section {activeSession.section}</span>
                                                    <span style={{ fontSize: '0.75rem', color: 'white', fontWeight: 800, background: 'rgba(255,255,255,0.08)', padding: '0.3rem 0.8rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.12)' }}>{activeSession.branch}</span>
                                                    <span style={{ fontSize: '0.75rem', color: '#818cf8', fontWeight: 900, background: 'rgba(129,140,248,0.15)', padding: '0.3rem 0.8rem', borderRadius: '10px', border: '1px solid rgba(129,140,248,0.3)' }}>Sem {activeSession.semester}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: isMobile ? '0.4rem 0.8rem' : '0.6rem 1.25rem' }}>
                                        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.1rem' }}>⏱ Expires</div>
                                        <div style={{ fontSize: isMobile ? '1.3rem' : '1.7rem', fontWeight: 900, color: timerColor, fontFamily: 'monospace', transition: 'color 0.5s' }}>{formatTime(sessionTimeLeft)}</div>
                                    </div>
                                </div>

                                {/* Main Attendance Card */}
                                <div style={{ background: 'white', borderRadius: '24px', padding: isMobile ? '1.5rem' : '2.5rem', boxShadow: '0 6px 30px rgba(79,70,229,0.09)', border: '1px solid rgba(99,102,241,0.1)' }}>
                                    {success ? (
                                        <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                                            <div style={{ width: '80px', height: '80px', background: 'linear-gradient(135deg, #ecfdf5, #d1fae5)', border: '2px solid #6ee7b7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', boxShadow: '0 8px 24px rgba(34,197,94,0.2)' }}>
                                                <CheckCircle2 size={40} color="#22c5e0" />
                                            </div>
                                            <h3 style={{ fontSize: '1.8rem', fontWeight: 900, color: '#15803d', marginBottom: '0.5rem' }}>Attendance Marked!</h3>
                                            <p style={{ color: '#64748b', fontSize: '1rem' }}>Your presence has been verified and recorded successfully.</p>
                                            {distance !== null && (
                                                <div style={{ marginTop: '1.5rem', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '12px', padding: '0.75rem 1.25rem', display: 'inline-block' }}>
                                                    <span style={{ color: '#15803d', fontWeight: 700, fontSize: '0.9rem' }}>📍 Verified at {distance.toFixed(1)}m from classroom</span>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <>
                                            <div style={{ textAlign: 'center', marginBottom: isMobile ? '1.5rem' : '2rem' }}>
                                                <h2 style={{ fontSize: isMobile ? '1.3rem' : '1.75rem', fontWeight: 900, color: '#1e293b', marginBottom: '0.5rem' }}>Active Session Found</h2>
                                                <p style={{ color: '#64748b', fontSize: isMobile ? '0.85rem' : '1rem', fontWeight: 500 }}>{activeSession.subject} with Prof. {activeSession.teacher_name || 'Teacher'}</p>
                                            </div>

                                            <div style={{
                                                display: 'grid', gridTemplateColumns: isTiny ? '1fr' : 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1rem', marginBottom: '2rem'
                                            }}>
                                                {[
                                                    { icon: <Clock size={20} />, label: 'Time Left', val: formatTime(sessionTimeLeft), color: timerColor, bg: timerColor + '15' },
                                                    { icon: <Target size={20} />, label: 'Target GPS', val: '50 meters', color: '#4f46e5', bg: '#4f46e515' },
                                                    { icon: <Users size={20} />, label: 'ID Verification', val: 'Active Code', color: '#7c3aed', bg: '#7c3aed15' },
                                                ].map((stat, i) => (
                                                    <div key={i} style={{ background: stat.bg, borderRadius: '20px', padding: isMobile ? '1rem' : '1.25rem', textAlign: 'center', border: `1px solid ${stat.color}30` }}>
                                                        <div style={{ color: stat.color, display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}>{stat.icon}</div>
                                                        <div style={{ fontSize: '0.7rem', color: stat.color, fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.25rem' }}>{stat.label}</div>
                                                        <div style={{ fontSize: isMobile ? '1rem' : '1.15rem', fontWeight: 900, color: stat.color }}>{stat.val}</div>
                                                    </div>
                                                ))}

                                                <div style={{ background: '#fef2f2', border: '2px solid #fca5a5', borderRadius: '20px', padding: isMobile ? '1rem' : '1.25rem', textAlign: 'center', gridColumn: isTiny ? 'span 1' : 'span 3', marginTop: '0.5rem' }}>
                                                    <div style={{ color: '#dc2626', display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}><MapPin size={24} /></div>
                                                    <div style={{ fontSize: '0.7rem', color: '#ef4444', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.25rem' }}>Classroom Anchor Point (Verified)</div>
                                                    <div style={{ fontSize: isMobile ? '1rem' : '1.1rem', fontWeight: 900, color: '#991b1b', fontFamily: 'monospace' }}>
                                                        {activeSession.teacher_lat.toFixed(6)}°, {activeSession.teacher_lng.toFixed(6)}°
                                                    </div>
                                                </div>
                                            </div>
                                            {/* Geo-fence Visual Indicator */}
                                            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '1.25rem 1.5rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                <div style={{ position: 'relative', flexShrink: 0 }}>
                                                    <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: gps.bg, border: `2px solid ${gps.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.4s' }}>
                                                        <MapPin size={24} color={gps.text} />
                                                    </div>
                                                </div>

                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.9rem', marginBottom: '0.25rem' }}>Geo-Fence Status</div>
                                                    {liveDistance !== null ? (
                                                        <>
                                                            <div style={{ fontWeight: 800, color: gps.text, fontSize: '1rem' }}>
                                                                {liveDistance.toFixed(1)}m from classroom
                                                            </div>
                                                            <div style={{ marginTop: '0.4rem', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                                                                <div style={{ height: '100%', width: `${Math.min(100, (liveDistance / 50) * 100)}%`, background: Math.max(0, liveDistance - locationAccuracy) <= 50 ? '#22c5e0' : '#ef4444', borderRadius: '3px', transition: 'all 0.5s' }} />
                                                            </div>
                                                            <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.25rem' }}>✅ Allowed zone: within <strong>50 meters</strong> of teacher</div>
                                                        </>
                                                    ) : (
                                                        <div style={{ color: '#94a3b8', fontSize: '0.85rem', fontWeight: 500 }}>GPS will activate when you click "Mark Attendance"</div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Low accuracy warning */}
                                            {locationAccuracy > 30 && (
                                                <div style={{ background: '#fff7ed', border: '1px solid #fdba74', color: '#c2410c', padding: '0.875rem 1rem', borderRadius: '12px', marginBottom: '1.5rem', display: 'flex', gap: '0.75rem', alignItems: 'center', fontSize: '0.85rem', fontWeight: 600 }}>
                                                    <AlertCircle size={18} style={{ flexShrink: 0 }} />
                                                    Low GPS accuracy (±{locationAccuracy.toFixed(0)}m). Move to an open area for accurate verification.
                                                </div>
                                            )}

                                            {/* Conditional Area based on GPS */}
                                            {gpsStatus === 'ok' ? (
                                                <>
                                                    {/* OTP Entry */}
                                                    <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                                                        <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#4f46e5', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Verification Code</div>
                                                        <div style={{ display: 'flex', gap: isMobile ? '0.4rem' : '0.75rem', justifyContent: 'center' }}>
                                                            {otp.map((digit, idx) => (
                                                                <input
                                                                    key={idx}
                                                                    ref={el => otpRefs.current[idx] = el}
                                                                    className="input"
                                                                    value={digit}
                                                                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Backspace' && !digit && idx > 0) otpRefs.current[idx - 1]?.focus();
                                                                    }}
                                                                    style={{
                                                                        width: isMobile ? '2.5rem' : '3.5rem',
                                                                        height: isMobile ? '3rem' : '4.5rem',
                                                                        textAlign: 'center',
                                                                        fontSize: isMobile ? '1.25rem' : '2rem',
                                                                        fontWeight: 900,
                                                                        padding: 0,
                                                                        background: '#f8fafc',
                                                                        border: '2px solid #e2e8f0',
                                                                        borderRadius: '12px'
                                                                    }}
                                                                    maxLength={1}
                                                                    autoComplete="off"
                                                                />
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {/* Error Message */}
                                                    {error && (
                                                        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c', padding: '1rem 1.25rem', borderRadius: '14px', marginBottom: '1.5rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start', fontSize: '0.88rem', fontWeight: 600 }}>
                                                            <XCircle size={20} style={{ flexShrink: 0, marginTop: '0.05rem' }} />
                                                            {error}
                                                        </div>
                                                    )}

                                                    {/* Submit Button */}
                                                    <button
                                                        onClick={handleMarkAttendance}
                                                        disabled={marking || otp.join('').length < 6 || isAccountBlocked}
                                                        style={{
                                                            width: '100%', height: '60px',
                                                            background: (marking || otp.join('').length < 6 || isAccountBlocked) ? '#cbd5e1' : 'linear-gradient(135deg, #4f46e5, #2563eb)',
                                                            color: 'white', border: 'none', borderRadius: '16px',
                                                            fontSize: '1.05rem', fontWeight: 800, cursor: (marking || otp.join('').length < 6 || isAccountBlocked) ? 'not-allowed' : 'pointer',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
                                                            boxShadow: (marking || otp.join('').length < 6 || isAccountBlocked) ? 'none' : '0 10px 25px rgba(79,70,229,0.3)',
                                                            transition: 'all 0.3s'
                                                        }}
                                                    >
                                                        {marking ? <Loader2 size={22} style={{ animation: 'spin 1s linear infinite' }} /> : (isAccountBlocked ? <Lock size={18} /> : (success ? <CheckCircle2 size={22} /> : <Zap size={18} />))}
                                                        {isAccountBlocked ? `Wait ${Math.floor(blockTimeLeft / 60)}:${(blockTimeLeft % 60).toString().padStart(2, '0')}` : (marking ? 'Processing...' : (success ? 'Attendance Marked!' : 'Mark Attendance Present'))}
                                                    </button>

                                                    <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.78rem', marginTop: '1rem', fontWeight: 500 }}>
                                                        Your GPS location will be checked against the classroom zone
                                                    </p>
                                                </>
                                            ) : (
                                                <div style={{ background: '#fef2f2', border: '1px dashed #fca5a5', padding: '2rem', borderRadius: '16px', textAlign: 'center', color: '#b91c1c' }}>
                                                    <MapPin size={32} style={{ margin: '0 auto 1rem', opacity: 0.8, color: '#ef4444' }} />
                                                    <div style={{ fontWeight: 800, fontSize: '1rem', color: '#991b1b', marginBottom: '0.5rem' }}>You are outside the 50m radius</div>
                                                    <div style={{ fontSize: '0.85rem' }}>Move closer to the classroom (or near a window to improve GPS accuracy) to unlock the attendance code entry.</div>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        ) : (
                            /* No Active Session State */
                            <div style={{ background: 'white', borderRadius: '24px', padding: '5rem 3rem', textAlign: 'center', boxShadow: '0 6px 30px rgba(79,70,229,0.09)', border: '1px solid rgba(99,102,241,0.1)' }}>
                                <div style={{ width: '80px', height: '80px', background: '#f1f5f9', borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 2rem' }}>
                                    <Wifi size={40} color="#cbd5e1" />
                                </div>
                                <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#475569', marginBottom: '0.75rem' }}>No Active Session</h3>
                                <p style={{ color: '#94a3b8', fontSize: '0.95rem', maxWidth: '380px', margin: '0 auto 2rem', lineHeight: 1.6 }}>
                                    Waiting for your teacher to start an attendance session for <strong style={{ color: '#6366f1' }}>{user?.branch} • Section {user?.section}</strong>.
                                </p>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.6rem 1.25rem', color: '#64748b', fontSize: '0.82rem', fontWeight: 600 }}>
                                    <Loader2 size={15} style={{ animation: 'spin 2s linear infinite' }} /> Auto-refreshing every 10 seconds...
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                @keyframes gpsPulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(34,197,94,0.4); } 50% { box-shadow: 0 0 0 6px rgba(34,197,94,0); } }
            `}</style>
        </div >
    );
};

export default StudentDashboard;
