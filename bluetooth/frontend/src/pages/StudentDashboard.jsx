import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getCurrentLocation, getDistance } from '../lib/geo';
import {
    User, Smartphone, Wifi, MapPin, ShieldCheck, LogOut, Zap,
    Target, CheckCircle2, AlertCircle, Loader2, Clock, BookOpen,
    Navigation, Radio, XCircle, Lock, GraduationCap, Users, Crosshair
} from 'lucide-react';
import toast from 'react-hot-toast';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

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
            const data = await res.json();
            setActiveSession(data);
            if (data?.expiry_time) {
                const secs = Math.max(0, Math.floor((new Date(data.expiry_time) - new Date()) / 1000));
                setSessionTimeLeft(secs);
            } else {
                setLiveDistance(null);
                setGpsStatus('idle');
            }
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
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
                if (liveLocation && locationAccuracy < 30 && gpsStatus !== 'scanning' && gpsStatus !== 'error') {
                    loc = { lat: liveLocation.lat, lng: liveLocation.lng, accuracy: locationAccuracy };
                } else {
                    toast.loading('Locking onto GPS satellites...', { id: 'gps-lock' });
                    try {
                        loc = await getCurrentLocation();
                        toast.success('Location locked!', { id: 'gps-lock' });
                    } catch (err) {
                        toast.error('GPS Error: Please ensure Location is ON.', { id: 'gps-lock' });
                        throw err;
                    }
                }
            }

            const dist = getDistance(activeSession.teacher_lat, activeSession.teacher_lng, loc.lat, loc.lng);
            setDistance(dist);
            setLiveDistance(dist);
            setLocationAccuracy(loc.accuracy);
            setLiveLocation({ lat: loc.lat, lng: loc.lng });

            const effectiveDist = Math.max(0, dist - (loc.accuracy || 0));
            if (effectiveDist > 50) {
                const err = `Location mismatch. You are approx. ${dist.toFixed(0)}m away.`;
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
            setError(err.message || 'System Error.');
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

                    {!isMobile && (
                        <div style={{ display: 'flex', gap: '1.5rem', marginLeft: '2rem' }}>
                            <button onClick={() => setActiveTab('attendance')} style={{ background: 'none', border: 'none', padding: '0.5rem 1rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem', color: activeTab === 'attendance' ? '#2563eb' : '#64748b', borderBottom: activeTab === 'attendance' ? '2px solid #2563eb' : 'none', transition: 'all 0.2s' }}>Attendance</button>
                            <button onClick={() => { setActiveTab('report'); if (!summaryData) fetchSummary(); }} style={{ background: 'none', border: 'none', padding: '0.5rem 1rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem', color: activeTab === 'report' ? '#2563eb' : '#64748b', borderBottom: activeTab === 'report' ? '2px solid #2563eb' : 'none', transition: 'all 0.2s' }}>Overall Report</button>
                        </div>
                    )}
                    <button onClick={logout} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: isMobile ? '0.4rem 0.8rem' : '0.5rem 1.1rem', borderRadius: '10px', background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', fontWeight: 700, fontSize: isMobile ? '0.75rem' : '0.875rem', cursor: 'pointer' }}>
                        <LogOut size={14} /> Logout
                    </button>
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
                            </div>
                            <div style={{ marginTop: '1.25rem' }}>
                                <button onClick={() => { setActiveTab(activeTab === 'attendance' ? 'report' : 'attendance'); if (activeTab === 'attendance' && !summaryData) fetchSummary(); }} style={{ width: '100%', padding: '0.875rem', background: activeTab === 'report' ? '#4f46e5' : '#f8fafc', color: activeTab === 'report' ? 'white' : '#4f46e5', border: activeTab === 'report' ? 'none' : '1.5px solid #4f46e5', borderRadius: '14px', fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', transition: 'all 0.2s' }}>
                                    {activeTab === 'attendance' ? <><BookOpen size={16} /> View Report</> : <><Zap size={16} /> Mark Attendance</>}
                                </button>
                            </div>
                        </div>
                        <div style={{ background: gps.bg, border: `2px solid ${gps.border}`, borderRadius: '20px', padding: '1.5rem', transition: 'all 0.4s' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                                {gps.icon}
                                <div style={{ fontWeight: 800, color: gps.text, fontSize: '0.95rem' }}>{gpsStatus.toUpperCase()}</div>
                            </div>
                            {liveDistance !== null && (
                                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: gps.text }}>Distance: <strong>{liveDistance.toFixed(1)}m</strong></div>
                            )}
                        </div>
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
                                                    <div style={{ fontSize: '1.75rem', fontWeight: 900, marginBottom: '0.5rem' }}>{activeSession.subject}</div>
                                                    <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                                                        <span style={{ fontSize: '0.75rem', fontWeight: 800, background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', padding: '0.3rem 0.8rem', borderRadius: '10px', border: '1px solid rgba(34, 197, 94, 0.2)' }}>Section {activeSession.section}</span>
                                                        <span style={{ fontSize: '0.75rem', fontWeight: 800, background: 'rgba(255, 255, 255, 0.08)', color: 'white', padding: '0.3rem 0.8rem', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.15)' }}>{activeSession.branch}</span>
                                                        <span style={{ fontSize: '0.75rem', fontWeight: 800, background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', padding: '0.3rem 0.8rem', borderRadius: '10px', border: '1px solid rgba(99, 102, 241, 0.2)' }}>Sem {activeSession.semester}</span>
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
                                                <p style={{ color: '#64748b', fontSize: '0.95rem' }}>{activeSession.subject} with Prof. Teacher</p>
                                            </div>

                                            {success ? (
                                                <div style={{ textAlign: 'center', padding: '2rem' }}>
                                                    <CheckCircle2 size={60} color="#10b981" style={{ margin: '0 auto 1rem' }} />
                                                    <h3 style={{ color: '#065f46', fontWeight: 900 }}>Attendance Marked!</h3>
                                                </div>
                                            ) : (
                                                <>
                                                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                                                        <div style={{ background: '#f0fdf4', border: '1px solid #dcfce7', borderRadius: '16px', padding: '1.25rem', textAlign: 'center' }}>
                                                            <Clock size={20} color="#0ea5e9" style={{ margin: '0 auto 0.5rem' }} />
                                                            <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#0ea5e9', letterSpacing: '0.05em', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Time Left</div>
                                                            <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0ea5e9' }}>{formatTime(sessionTimeLeft)}</div>
                                                        </div>
                                                        <div style={{ background: '#f5f3ff', border: '1px solid #ede9fe', borderRadius: '16px', padding: '1.25rem', textAlign: 'center' }}>
                                                            <Crosshair size={20} color="#6366f1" style={{ margin: '0 auto 0.5rem' }} />
                                                            <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#6366f1', letterSpacing: '0.05em', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Target GPS</div>
                                                            <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#6366f1' }}>50 meters</div>
                                                        </div>
                                                        <div style={{ background: '#faf5ff', border: '1px solid #f3e8ff', borderRadius: '16px', padding: '1.25rem', textAlign: 'center' }}>
                                                            <Users size={20} color="#a855f7" style={{ margin: '0 auto 0.5rem' }} />
                                                            <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#a855f7', letterSpacing: '0.05em', marginBottom: '0.25rem', textTransform: 'uppercase' }}>ID Verification</div>
                                                            <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#a855f7' }}>Active Code</div>
                                                        </div>
                                                    </div>

                                                    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '16px', padding: '1.25rem', textAlign: 'center', marginBottom: '1.5rem' }}>
                                                        <MapPin size={20} color="#ef4444" style={{ margin: '0 auto 0.5rem' }} />
                                                        <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#ef4444', letterSpacing: '0.05em', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Classroom Anchor Point (Verified)</div>
                                                        <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#991b1b' }}>{activeSession.teacher_lat?.toFixed(6) || '20.226613'}°, {activeSession.teacher_lng?.toFixed(6) || '85.730935'}°</div>
                                                    </div>

                                                    {gpsStatus === 'ok' ? (
                                                        <>
                                                            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                                                                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#4f46e5', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>VERIFICATION CODE</div>
                                                                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                                                                    {otp.map((digit, i) => (
                                                                        <input key={i} ref={el => otpRefs.current[i] = el} type="text" maxLength="1" value={digit} onChange={e => handleOtpChange(i, e.target.value)} style={{ width: isMobile ? '40px' : '55px', height: isMobile ? '50px' : '65px', borderRadius: '12px', border: '1px solid #e2e8f0', textAlign: 'center', fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', background: 'white' }} />
                                                                    ))}
                                                                </div>
                                                            </div>
                                                            <button onClick={handleMarkAttendance} disabled={marking} style={{ width: '100%', padding: '1rem', background: marking ? '#cbd5e1' : '#2563eb', color: 'white', borderRadius: '12px', fontWeight: 800, border: 'none', cursor: marking ? 'not-allowed' : 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem', transition: 'background 0.2s' }}>
                                                                {marking && <Loader2 size={20} className="animate-spin" />}
                                                                {marking ? 'Processing...' : 'Mark Present'}
                                                            </button>
                                                            <div style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.75rem', color: '#94a3b8' }}>Your GPS location will be checked against the classroom zone</div>
                                                        </>
                                                    ) : (
                                                        <div style={{ textAlign: 'center', padding: '2rem' }}>
                                                            <MapPin size={40} color="#ef4444" style={{ margin: '0 auto 1rem' }} />
                                                            <p style={{ color: '#64748b' }}>Move closer to classroom to unlock.</p>
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
                                        <button onClick={fetchSummary} disabled={fetchingSummary} style={{ padding: '0.5rem 1rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px' }}>{fetchingSummary ? '...' : 'Refresh'}</button>
                                    </div>
                                </div>
                                {showReport && summaryData ? (
                                    <>
                                        <button onClick={() => window.print()} style={{ width: '100%', padding: '0.75rem', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '12px', color: '#475569', fontWeight: 700, marginBottom: '1.5rem' }}>Print Report</button>
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
