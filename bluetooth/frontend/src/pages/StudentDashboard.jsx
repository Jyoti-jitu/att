import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getCurrentLocation, getDistance } from '../lib/geo';
import {
    User, Smartphone, Wifi, MapPin, ShieldCheck, LogOut, Zap,
    Target, CheckCircle2, AlertCircle, Loader2, Clock, BookOpen,
    Navigation, Radio, XCircle, Lock, GraduationCap, Users, Crosshair,
    RefreshCw, Printer, AlertTriangle, Check
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getDeviceFingerprint } from '../lib/deviceIdentity';

import { API } from '../lib/api';

const StudentDashboard = () => {
    const { user, logout, isDemoMode, refreshUser } = useAuth();
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

    // --- View State ---
    const [activeTab, setActiveTab] = useState('attendance'); // 'attendance' | 'report'

    // --- Report State ---
    const [summaryData, setSummaryData] = useState(null);
    const [selectedSemester, setSelectedSemester] = useState('');
    const [fetchingSummary, setFetchingSummary] = useState(false);
    const [showReport, setShowReport] = useState(false);

    useEffect(() => {
        if (user?.semester) setSelectedSemester(user.semester);
    }, [user]);

    const fetchSummary = async () => {
        setFetchingSummary(true);
        try {
            const res = await fetch(`${API}/api/attendance/summary?semester=${selectedSemester}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const data = await res.json();
            setSummaryData(data);
            setShowReport(true);
        } catch (err) {
            console.error(err);
            toast.error('Failed to load attendance report');
        } finally {
            setFetchingSummary(false);
        }
    };

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
            if (!res.ok) {
                setActiveSession(null);
                setLoading(false);
                return;
            }
            const data = await res.json();
            // If API returns {error: ...} or empty, treat as no session
            if (!data || data.error) {
                setActiveSession(null);
            } else {
                setActiveSession(data);
                if (data.expiry_time) {
                    const secs = Math.max(0, Math.floor((new Date(data.expiry_time) - new Date()) / 1000));
                    setSessionTimeLeft(secs);
                }
            }
        } catch (err) {
            console.error(err);
            setActiveSession(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const syncData = () => {
            checkSession();
            if (user?.blocked_until) refreshUser();
        };
        syncData();
        const interval = setInterval(syncData, (user?.blocked_until) ? 5000 : 10000);
        return () => clearInterval(interval);
    }, [user?.blocked_until]);

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

    useEffect(() => {
        if (sessionTimeLeft <= 0) return;
        const timer = setInterval(() => setSessionTimeLeft(p => Math.max(0, p - 1)), 1000);
        return () => clearInterval(timer);
    }, [sessionTimeLeft]);

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
                    // Ignore timeouts (code 3) as the watch will continue trying
                    if (err.code !== 3) {
                        console.error("Continuous GPS Watch Error:", err);
                        if (err.code === 1) {
                            toast.error('Location Access Denied. Please enable location services.', { id: 'gps-perm' });
                            setGpsStatus('error');
                        } else {
                            // Don't flag as permanent error for transient connection issues
                            console.warn("Transient GPS issue:", err.message);
                        }
                    }
                },
                {
                    enableHighAccuracy: true,
                    maximumAge: 5000,
                    timeout: 10000
                }
            );
        } else {
            setGpsStatus('error');
            toast.error('Geolocation is not supported by your browser.');
        }
        return () => { if (watchId) navigator.geolocation.clearWatch(watchId); };
    }, []);

    useEffect(() => {
        if (!activeSession) {
            setLiveDistance(null);
            setGpsStatus(liveLocation ? 'idle' : 'scanning');
            return;
        }

        if (isDemoMode) {
            const demoLat = activeSession.teacher_lat + 0.00004;
            const demoLng = activeSession.teacher_lng;
            const d = getDistance(activeSession.teacher_lat, activeSession.teacher_lng, demoLat, demoLng);

            // Fix: Only update state if values changed to prevent infinite loops
            if (!liveLocation || liveLocation.lat !== demoLat || liveLocation.lng !== demoLng) {
                setLiveLocation({ lat: demoLat, lng: demoLng });
                setLocationAccuracy(10);
            }

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
        const effectiveDist = Math.max(0, d - locationAccuracy);
        if (locationAccuracy > 60 && effectiveDist > 50) {
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
                // OPTIMIZATION: If our background tracker (watchPosition) already has a High-Accuracy lock (< 35m)
                // and it's within range, use it IMMEDIATELY instead of waiting for a new getCurrentPosition() call.
                if (liveLocation && locationAccuracy && locationAccuracy < 35 && gpsStatus === 'ok') {
                    console.log('[GPS] Using background high-accuracy lock:', locationAccuracy);
                    loc = { lat: liveLocation.lat, lng: liveLocation.lng, accuracy: locationAccuracy };
                } else {
                    // Force a fresh read if background tracking is stale or inaccurate
                    toast.loading('Optimizing GPS precision...', { id: 'gps-lock' });
                    try {
                        loc = await getCurrentLocation(); // Fresh hardware read
                        toast.success('Position optimized!', { id: 'gps-lock' });
                    } catch (err) {
                        if (liveLocation) {
                            console.warn('GPS hardware lock failed. Falling back to background sensor.');
                            toast.success('Using secondary sensor!', { id: 'gps-lock' });
                            loc = { lat: liveLocation.lat, lng: liveLocation.lng, accuracy: locationAccuracy || 50 };
                        } else {
                            throw err;
                        }
                    }
                }
            }

            const dist = getDistance(activeSession.teacher_lat, activeSession.teacher_lng, loc.lat, loc.lng);
            const teacherAcc = activeSession.teacher_accuracy || 0;
            const effectiveDist = Math.max(0, dist - loc.accuracy - teacherAcc);

            // Sync UI states with latest reading
            setDistance(dist);
            setLiveDistance(dist);
            setLocationAccuracy(loc.accuracy);
            setLiveLocation({ lat: loc.lat, lng: loc.lng });

            // Clientside soft-check (matches backend logic)
            if (effectiveDist > 65) { // Slightly more generous buffer (65m vs 50m) to account for indoor drift
                const err = `Outside range (${dist.toFixed(0)}m). Please move closer to the professor.`;
                setError(err);
                toast.error(err);
                setMarking(false);
                return;
            }

            const fingerprint = getDeviceFingerprint();

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
                    deviceFingerprint: fingerprint.fingerprint,
                    deviceDetails: {
                        platform: fingerprint.platform,
                        screenRes: fingerprint.screenRes
                    }
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

            // Specifically handle Geolocation errors
            if (err.code === 1) {
                setError('Location access denied. Please go to your browser settings and allow location access for this site.');
            } else if (err.code === 2) {
                setError('Location unavailable. GPS signal is weak. Try moving near a window or outdoors.');
            } else if (err.code === 3) {
                setError('Location request timed out. Please try again or refresh the page.');
            } else if (err.message && err.message.includes('Location')) {
                setError(err.message);
            } else {
                setError('System Error: ' + (err.message || 'Communication failed. Check your network or server.'));
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
            <nav style={{
                background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(20px)',
                borderBottom: '1px solid rgba(99,102,241,0.12)', position: 'sticky', top: 0, zIndex: 100,
                boxShadow: '0 2px 20px rgba(99,102,241,0.08)'
            }}>
                <div style={{ maxWidth: '1200px', margin: '0 auto', padding: isMobile ? '0 1rem' : '0 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: isMobile ? '64px' : '72px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '0.5rem' : '0.875rem' }}>
                        <div style={{ width: isMobile ? '36px' : '44px', height: isMobile ? '36px' : '44px', borderRadius: '10px', background: 'linear-gradient(135deg, #4f46e5, #2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Radio size={isMobile ? 18 : 22} color="white" />
                        </div>
                        <div>
                            <div style={{ fontSize: isMobile ? '0.95rem' : '1.15rem', fontWeight: 800, color: '#1e3a8a' }}>Student Portal</div>
                            {!isTiny && <div style={{ fontSize: '0.65rem', color: '#6366f1', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>GeoAttend System</div>}
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <button
                            onClick={() => setIsDemoMode(!isDemoMode)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '0.4rem',
                                padding: isMobile ? '0.4rem 0.8rem' : '0.5rem 1.1rem',
                                borderRadius: '10px',
                                background: isDemoMode ? '#4f46e5' : '#f8fafc',
                                color: isDemoMode ? 'white' : '#64748b',
                                border: '1px solid #e2e8f0',
                                fontWeight: 700, fontSize: isMobile ? '0.7rem' : '0.8rem',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            <Zap size={14} /> {isDemoMode ? 'Demo ON' : 'Demo OFF'}
                        </button>
                        <button onClick={logout} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: isMobile ? '0.4rem 0.8rem' : '0.5rem 1.1rem', borderRadius: '10px', background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', fontWeight: 700, fontSize: isMobile ? '0.75rem' : '0.875rem', cursor: 'pointer' }}>
                            <LogOut size={14} /> Logout
                        </button>
                    </div>
                </div>
            </nav>

            <div style={{ maxWidth: '1200px', margin: '0 auto', padding: isMobile ? '1.5rem 1rem' : '2.5rem 2rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '340px 1fr', gap: isMobile ? '1.5rem' : '2rem', alignItems: 'start' }}>
                    <div style={{ display: 'flex', flexDirection: isMobile ? 'column-reverse' : 'column', gap: '1.5rem' }}>
                        <div style={{ background: 'white', borderRadius: '24px', padding: isMobile ? '1.5rem' : '2rem', boxShadow: '0 6px 30px rgba(79,70,229,0.09)', border: '1px solid rgba(99,102,241,0.1)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.75rem' }}>
                                <div style={{ width: isMobile ? '48px' : '54px', height: isMobile ? '48px' : '54px', borderRadius: '14px', background: 'linear-gradient(135deg, #4f46e5, #2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <User size={isMobile ? 22 : 26} color="white" />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: isMobile ? '1.1rem' : '1.3rem', fontWeight: 800, color: '#1e293b' }}>{user?.name}</div>
                                    <div style={{ fontSize: isMobile ? '0.75rem' : '0.85rem', color: '#6366f1', fontWeight: 700, textTransform: 'uppercase' }}>{user?.roll_no}</div>
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.85rem' }}>
                                {[
                                    { icon: <GraduationCap size={16} />, label: 'Branch & Sem', val: `${user?.branch} • Sem ${user?.semester}` },
                                    { icon: <Smartphone size={16} />, label: 'Device Status', val: 'Verified' },
                                    { icon: <ShieldCheck size={16} />, label: 'Number', val: user?.mobile },
                                ].map((item, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', background: '#f8fafc', borderRadius: '14px', border: '1px solid #f1f5f9' }}>
                                        <div style={{ color: '#6366f1' }}>{item.icon}</div>
                                        <div>
                                            <div style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>{item.label}</div>
                                            <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#334155' }}>{item.val}</div>
                                        </div>
                                    </div>
                                ))}
                                <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: '#fff7ed', borderRadius: '10px', border: '1px solid #ffedd5', fontSize: '0.6rem', color: '#9a3412', fontFamily: 'monospace' }}>
                                    DEBUG Fingerprint: {getDeviceFingerprint().fingerprint.slice(0, 8)}...
                                </div>
                            </div>
                            <div style={{ marginTop: '1.25rem', padding: '0.35rem', background: '#f1f5f9', borderRadius: '16px', display: 'flex', gap: '0.35rem' }}>
                                <button onClick={() => setActiveTab('attendance')} style={{ flex: 1, padding: '0.8rem', border: 'none', background: activeTab === 'attendance' ? '#4f46e5' : 'transparent', color: activeTab === 'attendance' ? 'white' : '#64748b', borderRadius: '12px', fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', transition: 'all 0.2s', boxShadow: activeTab === 'attendance' ? '0 4px 12px rgba(79, 70, 229, 0.25)' : 'none' }}>
                                    <Zap size={16} /> Live
                                </button>
                                <button onClick={() => { setActiveTab('report'); if (!summaryData) fetchSummary(); }} style={{ flex: 1, padding: '0.8rem', border: 'none', background: activeTab === 'report' ? '#4f46e5' : 'transparent', color: activeTab === 'report' ? 'white' : '#64748b', borderRadius: '12px', fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', transition: 'all 0.2s', boxShadow: activeTab === 'report' ? '0 4px 12px rgba(79, 70, 229, 0.25)' : 'none' }}>
                                    <BookOpen size={16} /> Report
                                </button>
                            </div>
                        </div>
                        {/* ─── Premium Geo-Fence Card (NEW) ─── */}
                        <div style={{
                            background: 'white',
                            borderRadius: '24px',
                            padding: '1.5rem',
                            border: '1px solid #e2e8f0',
                            marginBottom: '1.5rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '1.25rem',
                            position: 'relative',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.02)'
                        }}>
                            <div style={{
                                width: '56px',
                                height: '56px',
                                borderRadius: '50%',
                                background: gpsStatus === 'ok' ? '#ecfdf5' : '#fff7ed',
                                border: `1.5px solid ${gpsStatus === 'ok' ? '#10b981' : '#f59e0b'}`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <MapPin size={24} color={gpsStatus === 'ok' ? '#10b981' : '#f59e0b'} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#1e293b', marginBottom: '0.2rem' }}>Geo-Fence Status</div>
                                <div style={{ fontSize: '1.25rem', fontWeight: 900, color: gpsStatus === 'ok' ? '#059669' : '#d97706', marginBottom: '0.75rem' }}>
                                    {liveDistance !== null ? `${liveDistance.toFixed(1)}m from classroom` : 'Locating...'}
                                </div>

                                {/* Proximity Progress Bar (Visual relative to 50m) */}
                                <div style={{ height: '6px', background: '#f1f5f9', borderRadius: '3px', position: 'relative', overflow: 'hidden', marginBottom: '0.5rem' }}>
                                    <div style={{
                                        position: 'absolute',
                                        left: 0, top: 0, bottom: 0,
                                        width: liveDistance !== null ? `${Math.min(100, Math.max(5, (1 - (liveDistance / 50)) * 100))}%` : '0%',
                                        background: gpsStatus === 'ok' ? 'linear-gradient(90deg, #10b981, #34d399)' : '#f59e0b',
                                        transition: 'width 0.5s ease-out'
                                    }} />
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.7rem', color: '#64748b', fontWeight: 700 }}>
                                    <span style={{ color: '#10b981' }}>✅ Allowed zone:</span> within <strong>50 meters</strong> of teacher
                                </div>
                            </div>
                        </div>

                        {/* GPS Accuracy Warning Notice */}
                        {locationAccuracy > 30 && activeTab === 'attendance' && (
                            <div style={{
                                background: '#fffbeb',
                                border: '1px solid #fef3c7',
                                borderRadius: '16px',
                                padding: '1rem',
                                marginBottom: '1.5rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem'
                            }}>
                                <div style={{ width: '28px', height: '28px', background: '#fef3c7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <AlertTriangle size={16} color="#d97706" />
                                </div>
                                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#92400e', lineHeight: '1.4' }}>
                                    Low GPS accuracy (±{locationAccuracy.toFixed(0)}m). Move to an open area for accurate verification.
                                </div>
                            </div>
                        )}
                    </div>

                    <div>
                        {activeTab === 'attendance' ? (
                            <>
                                {loading ? (
                                    <div style={{ background: 'white', borderRadius: '24px', padding: '4rem', textAlign: 'center' }}>
                                        <Loader2 size={40} color="#6366f1" className="animate-spin" style={{ margin: '0 auto 1rem' }} />
                                        <p style={{ color: '#64748b', fontWeight: 600 }}>Scanning...</p>
                                    </div>
                                ) : activeSession ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                        {isAccountBlocked && (
                                            <div style={{ background: '#fff7ed', border: '1px solid #fdba74', borderRadius: '16px', padding: '1.25rem', display: 'flex', gap: '1rem' }}>
                                                <Clock size={20} color="#ea580c" />
                                                <div>
                                                    <div style={{ color: '#9a3412', fontWeight: 800 }}>Account Blocked</div>
                                                    <div style={{ color: '#c2410c', fontSize: '0.82rem' }}>Wait {formatTime(blockTimeLeft)} min.</div>
                                                </div>
                                            </div>
                                        )}
                                        <div style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)', borderRadius: '24px', padding: '1.5rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'white', gap: '1rem', marginBottom: '2rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                                                {/* Left Icon */}
                                                <div style={{ position: 'relative', flexShrink: 0 }}>
                                                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(74, 222, 128, 0.1)', border: '1px solid rgba(74, 222, 128, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <Radio size={24} color="#4ade80" />
                                                    </div>
                                                    <div style={{ position: 'absolute', top: 0, right: 0, width: '10px', height: '10px', background: '#3b82f6', borderRadius: '50%', border: '2px solid #0f172a' }} />
                                                </div>

                                                <div>
                                                    <div style={{ color: '#4ade80', fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.05em', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                                        <div style={{ width: '6px', height: '6px', background: '#4ade80', borderRadius: '50%' }} /> LIVE SESSION
                                                    </div>
                                                    <div style={{ fontSize: '1.75rem', fontWeight: 900, marginBottom: '0.5rem' }}>{activeSession?.subject || 'Unknown Class'}</div>
                                                    <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                                                        <span style={{ fontSize: '0.75rem', fontWeight: 800, background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', padding: '0.3rem 0.8rem', borderRadius: '10px', border: '1px solid rgba(34, 197, 94, 0.2)' }}>Section {activeSession?.section || 'N/A'}</span>
                                                        <span style={{ fontSize: '0.75rem', fontWeight: 800, background: 'rgba(255, 255, 255, 0.08)', color: 'white', padding: '0.3rem 0.8rem', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.15)' }}>{activeSession?.branch || 'General'}</span>
                                                        <span style={{ fontSize: '0.75rem', fontWeight: 800, background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', padding: '0.3rem 0.8rem', borderRadius: '10px', border: '1px solid rgba(99, 102, 241, 0.2)' }}>Sem {activeSession?.semester || '?'}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Right Timer Box */}
                                            <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '0.75rem 1.25rem', minWidth: '100px' }}>
                                                <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.1em', marginBottom: '0.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}>
                                                    <Clock size={12} /> EXPIRES
                                                </div>
                                                <div style={{ fontSize: '1.8rem', fontWeight: 900, color: timerColor, fontFamily: 'monospace' }}>{formatTime(sessionTimeLeft)}</div>
                                            </div>
                                        </div>

                                        <div style={{ background: 'white', borderRadius: '24px', padding: isMobile ? '1.5rem' : '2.5rem', boxShadow: '0 6px 30px rgba(0,0,0,0.05)' }}>
                                            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                                                <h2 style={{ fontSize: '1.75rem', fontWeight: 900, color: '#1e293b', marginBottom: '0.25rem' }}>Active Session Found</h2>
                                                <p style={{ color: '#64748b', fontSize: '0.95rem' }}>{activeSession?.subject || 'Lecture'} with Prof. Teacher</p>
                                            </div>

                                            {success ? (
                                                <div style={{ textAlign: 'center', padding: '2rem' }}>
                                                    <CheckCircle2 size={60} color="#10b981" style={{ margin: '0 auto 1rem' }} />
                                                    <h3 style={{ color: '#065f46', fontWeight: 900 }}>Attendance Marked!</h3>
                                                </div>
                                            ) : (
                                                <>
                                                    {gpsStatus === 'ok' ? (
                                                        <div style={{ textAlign: 'center', marginTop: '1rem', borderTop: '1px solid #f1f5f9', paddingTop: '2rem' }}>
                                                            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                                <Lock size={14} /> ENTER 6-DIGIT VERIFICATION CODE
                                                            </div>

                                                            {/* Modern OTP Input Grid */}
                                                            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginBottom: '2.5rem' }}>
                                                                {otp.map((digit, i) => (
                                                                    <input
                                                                        key={i}
                                                                        ref={el => otpRefs.current[i] = el}
                                                                        type="text"
                                                                        maxLength="1"
                                                                        value={digit}
                                                                        onChange={e => handleOtpChange(i, e.target.value)}
                                                                        onKeyDown={e => {
                                                                            if (e.key === 'Backspace' && !digit && i > 0) otpRefs.current[i - 1]?.focus();
                                                                        }}
                                                                        style={{
                                                                            width: isMobile ? '46px' : '60px',
                                                                            height: isMobile ? '56px' : '72px',
                                                                            borderRadius: '14px',
                                                                            border: digit ? '2px solid #4f46e5' : '2px solid #e2e8f0',
                                                                            background: digit ? '#f5f3ff' : 'white',
                                                                            textAlign: 'center',
                                                                            fontSize: '1.8rem',
                                                                            fontWeight: 900,
                                                                            color: '#1e293b',
                                                                            boxShadow: digit ? '0 4px 12px rgba(79, 70, 229, 0.1)' : 'none',
                                                                            transition: 'all 0.2s ease',
                                                                            outline: 'none'
                                                                        }}
                                                                    />
                                                                ))}
                                                            </div>

                                                            {/* Premium Confirm Button */}
                                                            <button
                                                                onClick={handleMarkAttendance}
                                                                disabled={marking || otp.some(d => !d)}
                                                                style={{
                                                                    width: '100%',
                                                                    height: '64px',
                                                                    background: (marking || otp.some(d => !d)) ? '#94a3b8' : 'linear-gradient(135deg, #4f46e5 0%, #2563eb 100%)',
                                                                    color: 'white',
                                                                    borderRadius: '18px',
                                                                    fontWeight: 800,
                                                                    border: 'none',
                                                                    cursor: (marking || otp.some(d => !d)) ? 'not-allowed' : 'pointer',
                                                                    display: 'flex',
                                                                    justifyContent: 'center',
                                                                    alignItems: 'center',
                                                                    gap: '0.75rem',
                                                                    fontSize: '1.15rem',
                                                                    boxShadow: (marking || otp.some(d => !d)) ? 'none' : '0 8px 24px rgba(37, 99, 235, 0.3)',
                                                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                                                                }}
                                                            >
                                                                {marking ? <Loader2 size={24} className="animate-spin" /> : <div style={{ width: '24px', height: '24px', border: '2px solid white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ width: '8px', height: '8px', background: 'white', borderRadius: '50%' }} /></div>}
                                                                {marking ? 'Validating...' : 'Confirm Attendance'}
                                                            </button>

                                                            <p style={{ marginTop: '1.5rem', color: '#94a3b8', fontSize: '0.8rem', fontWeight: 500 }}>
                                                                Your GPS location will be checked against the classroom zone
                                                            </p>
                                                        </div>
                                                    ) : (
                                                        <div style={{ textAlign: 'center', padding: '3.5rem 2rem', background: '#f8fafc', borderRadius: '24px', border: '1px dashed #e2e8f0', marginTop: '1.25rem' }}>
                                                            <div style={{ width: '64px', height: '64px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
                                                                <MapPin size={32} color="#cbd5e1" />
                                                            </div>
                                                            <p style={{ color: '#64748b', fontWeight: 600, fontSize: '0.95rem' }}>Move closer to the classroom to unlock the attendance verification portal.</p>
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ background: 'white', borderRadius: '24px', padding: '5rem 2rem', textAlign: 'center' }}>
                                        <Wifi size={48} color="#cbd5e1" style={{ margin: '0 auto 1rem' }} />
                                        <p style={{ color: '#94a3b8' }}>No active session found.</p>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div style={{ background: 'white', borderRadius: '24px', padding: '2.5rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
                                    <h3 style={{ fontWeight: 900, color: '#1e3a8a' }}>Attendance Summary</h3>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <select value={selectedSemester} onChange={e => setSelectedSemester(e.target.value)} style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                            {[1, 2, 3, 4, 5, 6, 7, 8].map(s => <option key={s} value={s}>Sem {s}</option>)}
                                        </select>
                                        <button onClick={fetchSummary} disabled={fetchingSummary} style={{ padding: '0.5rem 1.25rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, cursor: fetchingSummary ? 'not-allowed' : 'pointer', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.25)', transition: 'all 0.2s', opacity: fetchingSummary ? 0.7 : 1 }}>
                                            <RefreshCw size={16} className={fetchingSummary ? "animate-spin" : ""} />
                                            {fetchingSummary ? 'Loading...' : 'View'}
                                        </button>
                                    </div>
                                </div>
                                {showReport && summaryData ? (
                                    <>
                                        <button onClick={() => window.print()} style={{ width: '100%', padding: '0.875rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '14px', color: '#334155', fontWeight: 700, marginBottom: '1.5rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }} onMouseEnter={(e) => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.borderColor = '#cbd5e1'; }} onMouseLeave={(e) => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#e2e8f0'; }}>
                                            <Printer size={18} color="#64748b" />
                                            Print Detailed Report
                                        </button>
                                        <div style={{ border: '2px solid #e2e8f0', borderRadius: '16px', overflow: 'hidden' }}>
                                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                                <thead>
                                                    <tr style={{ background: '#0f172a', color: 'white', textAlign: 'left', fontSize: '0.8rem' }}>
                                                        <th style={{ padding: '1rem' }}>Subject</th>
                                                        <th style={{ padding: '1rem' }}>Type</th>
                                                        <th style={{ padding: '1rem', textAlign: 'center' }}>Taken</th>
                                                        <th style={{ padding: '1rem', textAlign: 'center' }}>Attended</th>
                                                        <th style={{ padding: '1rem', textAlign: 'center' }}>%</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {summaryData.subjects?.map((sub, i) => (
                                                        <tr key={i} style={{ borderBottom: '1px solid #e2e8f0', background: i % 2 === 0 ? 'white' : '#f8fafc' }}>
                                                            <td style={{ padding: '1rem', fontWeight: 700, color: '#1e293b' }}>{sub.subject}</td>
                                                            <td style={{ padding: '1rem', color: '#64748b', fontSize: '0.75rem', fontWeight: 600 }}>{sub.type}</td>
                                                            <td style={{ padding: '1rem', textAlign: 'center', fontWeight: 800, color: '#475569' }}>{sub.total}</td>
                                                            <td style={{ padding: '1rem', textAlign: 'center', fontWeight: 800, color: '#2563eb' }}>{sub.attended}</td>
                                                            <td style={{ padding: '1rem', textAlign: 'center', fontWeight: 900, color: parseFloat(sub.percentage) >= 75 ? '#10b981' : '#ef4444' }}>{sub.percentage}%</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                            <div style={{ display: 'flex', justifyContent: 'space-around', padding: '1.5rem', background: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>
                                                <div style={{ textAlign: 'center' }}>
                                                    <div style={{ fontSize: '0.6rem', fontWeight: 800 }}>OVERALL</div>
                                                    <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#1e3a8a' }}>{summaryData.overall_pct}%</div>
                                                </div>
                                                <div style={{ textAlign: 'center' }}>
                                                    <div style={{ fontSize: '0.6rem', fontWeight: 800 }}>THEORY</div>
                                                    <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#4f46e5' }}>{summaryData.theory_pct}%</div>
                                                </div>
                                                <div style={{ textAlign: 'center' }}>
                                                    <div style={{ fontSize: '0.6rem', fontWeight: 800 }}>LAB</div>
                                                    <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#0ea5e9' }}>{summaryData.lab_pct}%</div>
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                ) : <div style={{ padding: '4rem', textAlign: 'center', color: '#94a3b8', border: '2px dashed #e2e8f0', borderRadius: '16px' }}>Select semester and refresh.</div>}
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                .animate-spin { animation: spin 1s linear infinite; }
            `}</style>
        </div>
    );
};

export default StudentDashboard;
