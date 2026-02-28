import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { getCurrentLocation } from '../lib/geo';
import { useNavigate } from 'react-router-dom';
import {
    Users, MapPin, Clock, LogOut, Zap, Play, Square,
    ShieldCheck, Smartphone, LayoutDashboard, Activity,
    CheckCircle2, Lock, Radio, History,
    Crosshair, MousePointer2, AlertTriangle, Save, X, Loader2
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import toast from 'react-hot-toast';

// Fix Leaflet marker icon issue
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

import { API } from '../lib/api';

const TeacherDashboard = () => {
    const { logout, isDemoMode, setIsDemoMode, user } = useAuth();
    const navigate = useNavigate();
    const [branch, setBranch] = useState('CSE');
    const [section, setSection] = useState('1');
    const [semester, setSemester] = useState('1');
    const [subject, setSubject] = useState('ED');
    const [timeSlot, setTimeSlot] = useState('08:00 - 09:00');
    const [duration, setDuration] = useState('5');
    const [sessionDate, setSessionDate] = useState(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(false);
    const [sessionError, setSessionError] = useState('');
    const [activeSession, setActiveSession] = useState(null);
    const [timeLeft, setTimeLeft] = useState(0);
    const [stats, setStats] = useState({ presentCount: 0 });
    const [pulse, setPulse] = useState(true);
    const [showSecurityLogs, setShowSecurityLogs] = useState(false);
    const [windowWidth, setWindowWidth] = useState(window.innerWidth);
    const [manualLocation, setManualLocation] = useState(null); // {lat, lng}
    const [showMapPicker, setShowMapPicker] = useState(false);
    const [calibrating, setCalibrating] = useState(false);

    useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const isMobile = windowWidth <= 768;
    const isTiny = windowWidth <= 480;

    const branches = ['CSE', 'CSE-AI', 'CSE-DS', 'IT', 'ECE', 'EEE', 'MECH'];
    const sections = ['1', '2', '3'];
    const semesters = ['1', '2', '3', '4', '5', '6', '7', '8'];
    const subjects = ['ED', 'CD', 'SE', 'DL', 'CC', 'AW'];
    const timeSlots = [
        '08:00 - 09:00',
        '09:00 - 10:00',
        '10:00 - 11:00',
        '11:00 - 12:00',
        '12:00 - 13:00',
        '13:00 - 14:00',
    ];

    useEffect(() => {
        const interval = setInterval(() => setPulse(p => !p), 1000);
        return () => clearInterval(interval);
    }, []);

    const terminateSession = useCallback(async (sessionId) => {
        try {
            await fetch(`${API}/api/sessions/${sessionId}/close`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
        } catch (e) { console.error(e); }
        setActiveSession(null);
        setTimeLeft(0);
        setStats({ presentCount: 0 });
    }, []);

    const calibrateLocation = async () => {
        setCalibrating(true);
        try {
            const loc = await getCurrentLocation();
            setManualLocation({ lat: loc.lat, lng: loc.lng });
            setShowMapPicker(true);
            toast.success('Estimated position locked. Fine-tune on map.');
        } catch (err) {
            // Do NOT set a fake fallback location if GPS fails
            toast.error(`GPS Error: ${err.message || 'Could not fetch location'}`);
        } finally {
            setCalibrating(false);
        }
    };

    useEffect(() => {
        // Auto-fetch location when dashboard opens
        if (navigator.geolocation && !isDemoMode && !manualLocation) {
            setCalibrating(true);
            getCurrentLocation().then(loc => {
                setManualLocation({ lat: loc.lat, lng: loc.lng });
                toast.success('Location synced automatically.');
            }).catch(err => {
                console.warn('Auto GPS fetch failed:', err);
                toast.error(`Auto-Sync GPS Error: ${err.message || 'Could not fetch location'}`);
            }).finally(() => {
                setCalibrating(false);
            });
        }
    }, [isDemoMode]);

    const startSession = async () => {
        setLoading(true);
        setSessionError('');
        try {
            let loc = null;
            if (manualLocation) {
                loc = { ...manualLocation, accuracy: 5 };
            } else if (isDemoMode) {
                loc = { lat: 12.9716, lng: 77.5946, accuracy: 5 };
            } else {
                loc = await getCurrentLocation();
            }
            const res = await fetch(`${API}/api/sessions/start`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    branch, section, semester, subject, timeSlot, duration,
                    lat: loc.lat, lng: loc.lng, accuracy: loc.accuracy
                })
            });

            let data;
            const contentType = res.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
                data = await res.json();
            } else {
                setSessionError(`Server error (${res.status}). Make sure the backend is running.`);
                setLoading(false);
                return;
            }

            if (res.ok) {
                toast.success('Session started successfully!');
                setActiveSession(data);
                setTimeLeft(parseInt(duration) * 60);
            } else {
                const msg = data.error || 'Failed to start session.';
                setSessionError(msg);
                toast.error(msg);
            }
        } catch (err) {
            setSessionError('Could not start session: ' + (err.message || 'Unknown error'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!activeSession) return;

        // Only terminate if we're actually tracking a live countdown and it hits 0
        if (timeLeft <= 0) {
            terminateSession(activeSession.id);
            return;
        }

        const timer = setInterval(() => setTimeLeft(prev => Math.max(0, prev - 1)), 1000);
        return () => clearInterval(timer);
    }, [timeLeft, activeSession, terminateSession]);

    useEffect(() => {
        let poll;
        if (activeSession) {
            const fetchStats = async () => {
                try {
                    const res = await fetch(`${API}/api/sessions/${activeSession.id}/stats`, {
                        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                    });
                    const data = await res.json();
                    setStats(data);
                } catch (err) { console.error(err); }
            };
            fetchStats();
            poll = setInterval(fetchStats, 5000);
        }
        return () => clearInterval(poll);
    }, [activeSession]);

    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    const timerColor = timeLeft < 30 ? '#ef4444' : timeLeft < 60 ? '#f59e0b' : '#22c55e';
    const timerPercent = (timeLeft / (parseInt(duration) * 60)) * 100;

    return (
        <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #f0f4ff 0%, #e8effe 50%, #f5f3ff 100%)', fontFamily: "'Inter', sans-serif" }}>
            <div className="bg-mesh" />

            {/* ── NAVBAR ── */}
            <nav style={{
                background: 'rgba(255,255,255,0.85)',
                backdropFilter: 'blur(20px)',
                borderBottom: '1px solid rgba(99,102,241,0.12)',
                position: 'sticky', top: 0, zIndex: 100,
                boxShadow: '0 2px 20px rgba(99,102,241,0.08)'
            }}>
                <div style={{ maxWidth: '1200px', margin: '0 auto', padding: isMobile ? '0 1rem' : '0 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: isMobile ? '64px' : '72px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '0.5rem' : '0.875rem' }}>
                        <div style={{ width: isMobile ? '36px' : '44px', height: isMobile ? '36px' : '44px', borderRadius: '10px', background: 'linear-gradient(135deg, #4f46e5, #2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(79,70,229,0.3)' }}>
                            <Radio size={isMobile ? 18 : 22} color="white" />
                        </div>
                        <div>
                            <div style={{ fontSize: isMobile ? '1rem' : '1.15rem', fontWeight: 800, color: '#1e3a8a' }}>Teacher Portal</div>
                            {!isTiny && <div style={{ fontSize: '0.65rem', color: '#6366f1', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>GeoAttend System</div>}
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button
                            onClick={() => navigate('/teacher/session-history')}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.4rem',
                                padding: isMobile ? '0.4rem 0.8rem' : '0.5rem 1.1rem',
                                borderRadius: '10px',
                                background: '#f0f4ff',
                                color: '#4f46e5',
                                border: '1px solid #dbeafe',
                                fontWeight: 700,
                                fontSize: isMobile ? '0.75rem' : '0.875rem',
                                cursor: 'pointer'
                            }}
                        >
                            <History size={14} /> Session History
                        </button>
                        <button onClick={logout} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: isMobile ? '0.4rem 0.8rem' : '0.5rem 1.1rem', borderRadius: '10px', background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', fontWeight: 700, fontSize: isMobile ? '0.75rem' : '0.875rem', cursor: 'pointer' }}>
                            <LogOut size={14} /> Logout
                        </button>
                    </div>
                </div>
            </nav>

            <div style={{ maxWidth: '1200px', margin: '0 auto', padding: isMobile ? '1.5rem 1rem' : '2.5rem 2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2.5rem' }}>
                    <div style={{ width: isMobile ? '48px' : '64px', height: isMobile ? '48px' : '64px', borderRadius: '18px', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid #dbeafe', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
                        <LayoutDashboard size={isMobile ? 24 : 32} color="#4f46e5" />
                    </div>
                    <div>
                        <h1 style={{ fontSize: isMobile ? '1.5rem' : '2.2rem', fontWeight: 900, color: '#1e293b', letterSpacing: '-0.02em', margin: 0 }}>Dashboard</h1>
                        <p style={{ color: '#64748b', fontSize: isMobile ? '0.85rem' : '1rem', fontWeight: 500, margin: '0.2rem 0 0' }}>Prof. {user?.name || 'Teacher'}</p>
                    </div>
                </div>

                {isDemoMode && (
                    <div style={{
                        background: 'linear-gradient(135deg, #fffbeb, #fef3c7)',
                        border: '1px solid #fde68a', borderRadius: '16px',
                        padding: '1rem 1.5rem', marginBottom: '2rem',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        boxShadow: '0 4px 12px rgba(245,158,11,0.1)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#92400e', fontWeight: 700, fontSize: isMobile ? '0.8rem' : '0.95rem' }}>
                            <Zap size={20} fill="currentColor" /> Simulation Mode Active
                        </div>
                        <button onClick={() => setIsDemoMode(false)} style={{ background: '#d97706', color: 'white', border: 'none', padding: '0.4rem 1rem', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem' }}>
                            Switch to Real GPS
                        </button>
                    </div>
                )}

                {!activeSession ? (
                    /* ─── PRE-SESSION: Unified Central Hub ─── */
                    <div style={{ maxWidth: '1000px', margin: '0 auto', marginBottom: '4rem', width: '100%' }}>

                        {/* Session Form */}
                        <div style={{ background: 'white', borderRadius: '28px', padding: isMobile ? '1.5rem' : '3rem', boxShadow: '0 12px 40px rgba(79,70,229,0.08)', border: '1px solid rgba(99,102,241,0.08)' }}>
                            <h2 style={{ fontSize: isMobile ? '1.25rem' : '1.75rem', fontWeight: 800, color: '#1e293b', marginBottom: '0.5rem' }}>Initialize Session</h2>
                            <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '2.5rem' }}>Set your class parameters and start broadcasting</p>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontWeight: 700, color: '#475569', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Branch</label>
                                    <select value={branch} onChange={e => setBranch(e.target.value)} style={{ width: '100%', padding: '0.85rem 1rem', borderRadius: '12px', border: '2px solid #e2e8f0', fontSize: '0.95rem', fontWeight: 700, color: '#1e293b', background: '#f8fafc', outline: 'none' }}>
                                        {branches.map(b => <option key={b} value={b}>{b}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontWeight: 700, color: '#475569', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Section</label>
                                    <select value={section} onChange={e => setSection(e.target.value)} style={{ width: '100%', padding: '0.85rem 1rem', borderRadius: '12px', border: '2px solid #e2e8f0', fontSize: '0.95rem', fontWeight: 700, color: '#1e293b', background: '#f8fafc', outline: 'none' }}>
                                        {sections.map(s => <option key={s} value={s}>Section {s}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontWeight: 700, color: '#475569', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Semester</label>
                                    <select value={semester} onChange={e => setSemester(e.target.value)} style={{ width: '100%', padding: '0.85rem 1rem', borderRadius: '12px', border: '2px solid #e2e8f0', fontSize: '0.95rem', fontWeight: 700, color: '#1e293b', background: '#f8fafc', outline: 'none' }}>
                                        {semesters.map(s => <option key={s} value={s}>Semester {s}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontWeight: 700, color: '#475569', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Subject</label>
                                    <select value={subject} onChange={e => setSubject(e.target.value)} style={{ width: '100%', padding: '0.85rem 1rem', borderRadius: '12px', border: '2px solid #e2e8f0', fontSize: '0.95rem', fontWeight: 700, color: '#1e293b', background: '#f8fafc', outline: 'none' }}>
                                        {subjects.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1.25rem', marginBottom: '2rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontWeight: 700, color: '#475569', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Date</label>
                                    <input type="date" value={sessionDate} onChange={e => setSessionDate(e.target.value)} style={{ width: '100%', padding: '0.85rem 1rem', borderRadius: '12px', border: '2px solid #e2e8f0', fontSize: '0.95rem', fontWeight: 700, color: '#1e293b', background: '#f8fafc', outline: 'none' }} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontWeight: 700, color: '#475569', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Window (Minutes)</label>
                                    <input type="number" value={duration} onChange={e => setDuration(e.target.value)} style={{ width: '100%', padding: '0.85rem 1rem', borderRadius: '12px', border: '2px solid #e2e8f0', fontSize: '0.95rem', fontWeight: 700, color: '#1e293b', background: '#f8fafc', outline: 'none' }} />
                                </div>
                            </div>

                            {/* Embedded Map Calibration (Integrated into form) */}
                            <div style={{ marginBottom: '2.5rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
                                    <div style={{ width: '36px', height: '36px', background: 'rgba(79,70,229,0.1)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Crosshair size={20} color="#4f46e5" />
                                    </div>
                                    <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>Classroom Anchor Location</h3>
                                </div>

                                <div style={{ height: '240px', borderRadius: '20px', overflow: 'hidden', border: '2px solid #e2e8f0', position: 'relative', background: '#f8fafc' }}>
                                    {manualLocation ? (
                                        <>
                                            <MapContainer center={[manualLocation.lat, manualLocation.lng]} zoom={18} style={{ height: '100%', width: '100%', zIndex: 1 }}>
                                                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                                                <Marker position={[manualLocation.lat, manualLocation.lng]} />
                                                <MapEventsHandler onMapClick={(latlng) => setManualLocation({ lat: latlng.lat, lng: latlng.lng })} />
                                                <RecenterMap lat={manualLocation.lat} lng={manualLocation.lng} />
                                            </MapContainer>
                                            {/* Floating Coordinate Pill */}
                                            <div style={{ position: 'absolute', bottom: '15px', left: '15px', right: '15px', background: 'white', padding: '0.75rem 1rem', borderRadius: '14px', boxShadow: '0 8px 20px rgba(0,0,0,0.15)', zIndex: 10, border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div>
                                                    <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Selected Anchor</div>
                                                    <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#1e293b', fontFamily: 'monospace' }}>{manualLocation.lat.toFixed(6)}, {manualLocation.lng.toFixed(6)}</div>
                                                </div>
                                                <button onClick={calibrateLocation} style={{ background: '#f0f4ff', border: 'none', color: '#4f46e5', padding: '0.4rem 0.8rem', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer' }}>Change</button>
                                            </div>
                                        </>
                                    ) : (
                                        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', textAlign: 'center' }}>
                                            <MapPin size={40} color="#cbd5e1" style={{ marginBottom: '1rem' }} />
                                            <p style={{ color: '#94a3b8', fontSize: '0.85rem', fontWeight: 600, marginBottom: '1.5rem' }}>No anchor point calibrated for this classroom.</p>
                                            <button
                                                onClick={calibrateLocation}
                                                disabled={calibrating}
                                                style={{ padding: '0.75rem 1.5rem', borderRadius: '12px', background: '#4f46e5', color: 'white', border: 'none', fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 12px rgba(79,70,229,0.3)' }}
                                            >
                                                {calibrating ? 'Setting Sync...' : 'Sync Classroom Map'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <button
                                onClick={startSession}
                                disabled={loading || (!manualLocation && !isDemoMode)}
                                style={{ width: '100%', height: '64px', background: (loading || (!manualLocation && !isDemoMode)) ? '#cbd5e1' : 'linear-gradient(135deg, #4f46e5 0%, #2563eb 100%)', color: 'white', border: 'none', borderRadius: '18px', fontSize: '1.1rem', fontWeight: 800, cursor: (loading || (!manualLocation && !isDemoMode)) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', boxShadow: (loading || (!manualLocation && !isDemoMode)) ? 'none' : '0 8px 24px rgba(79,70,229,0.3)', transition: 'all 0.2s' }}
                            >
                                {loading ? <Loader2 className="animate-spin" /> : <Play size={22} fill="white" />}
                                {loading ? 'Starting...' : 'Launch Live Session'}
                            </button>
                            {(!manualLocation && !isDemoMode && !loading) && <p style={{ color: '#6366f1', fontSize: '0.75rem', marginTop: '0.75rem', textAlign: 'center', fontWeight: 700 }}>↑ Please calibrate location before starting</p>}
                            {sessionError && <p style={{ color: '#ef4444', fontSize: '0.85rem', marginTop: '1rem', textAlign: 'center', fontWeight: 600 }}>⚠️ {sessionError}</p>}
                        </div>

                        {/* Security drawer removed */}
                    </div>
                ) : (
                    /* ─── LIVE SESSION VIEW ─── */
                    <div style={{ marginBottom: '3rem' }}>
                        <div style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)', borderRadius: '32px', padding: isMobile ? '1.5rem' : '2.5rem', color: 'white', marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem', boxShadow: '0 20px 50px rgba(0,0,0,0.2)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                                <div style={{ width: '64px', height: '64px', borderRadius: '20px', background: 'rgba(34,197,94,0.1)', border: '2px solid rgba(34,197,94,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Activity size={32} color="#4ade80" className="pulse" />
                                </div>
                                <div>
                                    <div style={{ color: '#4ade80', fontWeight: 800, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '0.4rem' }}>● Session Live</div>
                                    <h2 style={{ fontSize: isMobile ? '1.35rem' : '1.85rem', fontWeight: 900, margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        {activeSession.subject}
                                        <span style={{ fontSize: '0.9rem', color: '#818cf8', fontWeight: 800, background: 'rgba(129,140,248,0.1)', padding: '0.3rem 0.75rem', borderRadius: '10px', border: '1px solid rgba(129,140,248,0.2)' }}>Sec {activeSession.section}</span>
                                    </h2>
                                    <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.75rem' }}>
                                        <div style={{ padding: '0.4rem 0.8rem', borderRadius: '8px', background: 'rgba(255,255,255,0.07)', fontSize: '0.75rem', fontWeight: 800, color: 'white', display: 'flex', alignItems: 'center', gap: '0.4rem', border: '1px solid rgba(255,255,255,0.1)' }}>
                                            <div style={{ width: '6px', height: '6px', background: '#3b82f6', borderRadius: '50%' }} /> {activeSession.branch}
                                        </div>
                                        <div style={{ padding: '0.4rem 0.8rem', borderRadius: '8px', background: 'rgba(255,255,255,0.07)', fontSize: '0.75rem', fontWeight: 800, color: 'white', display: 'flex', alignItems: 'center', gap: '0.4rem', border: '1px solid rgba(255,255,255,0.1)' }}>
                                            <div style={{ width: '6px', height: '6px', background: '#ec4899', borderRadius: '50%' }} /> Sem {activeSession.semester}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.03)', padding: '1.25rem 2rem', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.05)', minWidth: isMobile ? '100%' : '180px' }}>
                                <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.25rem' }}>Closing In</div>
                                <div style={{ fontSize: '2.5rem', fontWeight: 900, color: timerColor, fontFamily: 'monospace' }}>{formatTime(timeLeft)}</div>
                                <div style={{ height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', marginTop: '0.5rem', overflow: 'hidden' }}>
                                    <div style={{ height: '100%', width: `${timerPercent}%`, background: timerColor, transition: 'width 1s linear' }} />
                                </div>
                            </div>
                        </div>

                        {/* OTP Display */}
                        <div style={{ background: 'white', borderRadius: '32px', padding: isMobile ? '2rem 1.5rem' : '3rem', textAlign: 'center', boxShadow: '0 12px 40px rgba(79,70,229,0.08)', border: '1px solid rgba(99,102,241,0.08)', marginBottom: '2rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: '#94a3b8', fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '2rem' }}>
                                <Lock size={16} /> Secure Verification Code
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
                                {String(activeSession.otp).split('').map((char, i) => (
                                    <div key={i} style={{ width: isMobile ? '56px' : '74px', height: isMobile ? '74px' : '96px', background: '#f8faff', border: '2px solid #e0e7ff', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: isMobile ? '2rem' : '3rem', fontWeight: 900, color: '#4f46e5', boxShadow: '0 4px 12px rgba(99,102,241,0.05)' }}>{char}</div>
                                ))}
                            </div>
                            <p style={{ color: '#64748b', fontSize: '0.95rem', fontWeight: 500 }}>Share this code with your students for real-time validation.</p>
                        </div>

                        {/* Live Interaction Stats */}
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
                            <div style={{ background: 'white', borderRadius: '24px', padding: '1.75rem', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                                <div style={{ width: '56px', height: '56px', background: '#f0f4ff', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CheckCircle2 size={28} color="#4f46e5" /></div>
                                <div>
                                    <div style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase' }}>Confirmed Present</div>
                                    <div style={{ fontSize: '2rem', fontWeight: 900, color: '#1e293b' }}>{stats.presentCount}</div>
                                </div>
                            </div>
                            <div style={{ background: '#fef2f2', border: '2px solid #fca5a5', borderRadius: '20px', padding: isMobile ? '1rem' : '1.25rem', textAlign: 'center', gridColumn: isMobile ? '1' : 'span 2' }}>
                                <div style={{ color: '#dc2626', display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}><MapPin size={24} /></div>
                                <div style={{ fontSize: '0.7rem', color: '#ef4444', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.25rem' }}>Classroom Anchor Point</div>
                                <div style={{ fontSize: isMobile ? '0.9rem' : '1.1rem', fontWeight: 900, color: '#991b1b', fontFamily: 'monospace' }}>
                                    {activeSession.teacher_lat.toFixed(6)}°, {activeSession.teacher_lng.toFixed(6)}°
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <button
                                onClick={() => terminateSession(activeSession.id)}
                                style={{ height: '58px', background: '#f8fafc', border: '2px solid #e2e8f0', color: '#64748b', borderRadius: '16px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem' }}
                            >
                                <Square size={18} fill="currentColor" /> Finish Early
                            </button>
                            <button
                                onClick={async () => {
                                    if (window.confirm('Are you sure? This session and its records will be PERMANENTLY DELETED and no absence emails will be sent.')) {
                                        try {
                                            const res = await fetch(`${API}/api/sessions/${activeSession.id}/cancel`, {
                                                method: 'DELETE',
                                                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                                            });
                                            if (res.ok) {
                                                toast.success('Session discarded successfully.');
                                                setActiveSession(null);
                                                setTimeLeft(0);
                                            }
                                        } catch (err) { toast.error('Error cancelling session'); }
                                    }
                                }}
                                style={{ height: '58px', background: '#fef2f2', border: '2px solid #fecaca', color: '#ef4444', borderRadius: '16px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem' }}
                            >
                                <X size={20} /> Cancel Session
                            </button>
                        </div>
                    </div>
                )}

                {/* Security Center section removed */}

                {/* Security Center section removed */}
            </div>

            {/* Map Picker Modal */}
            {showMapPicker && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isMobile ? 0 : '2rem' }}>
                    <div style={{ background: 'white', width: '100%', maxWidth: '960px', height: isMobile ? '100%' : '85vh', borderRadius: isMobile ? 0 : '32px', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
                        <div style={{ padding: '1.5rem 2rem', background: '#0f172a', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Define Classroom Anchor</h3>
                                <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>Tap exactly where you are standing in the room</p>
                            </div>
                            <button onClick={() => setShowMapPicker(false)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: '0.5rem', borderRadius: '50%', cursor: 'pointer' }}><X size={20} /></button>
                        </div>
                        <div style={{ flex: 1, position: 'relative' }}>
                            <MapContainer center={[manualLocation.lat, manualLocation.lng]} zoom={19} style={{ height: '100%', width: '100%' }}>
                                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap' />
                                <Marker position={[manualLocation.lat, manualLocation.lng]} />
                                <MapEventsHandler onMapClick={(latlng) => setManualLocation({ lat: latlng.lat, lng: latlng.lng })} />
                                <RecenterMap lat={manualLocation.lat} lng={manualLocation.lng} />
                            </MapContainer>
                            <div style={{ position: 'absolute', bottom: isMobile ? '20px' : '30px', left: isMobile ? '10px' : '50%', right: isMobile ? '10px' : 'auto', transform: isMobile ? 'none' : 'translateX(-50%)', zIndex: 1000, background: 'white', padding: '1.25rem', borderRadius: '24px', boxShadow: '0 12px 40px rgba(0,0,0,0.2)', border: '1px solid #e2e8f0', minWidth: isMobile ? '0' : '400px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.2rem' }}>Selected Anchor</div>
                                        <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#1e293b', fontFamily: 'monospace' }}>{manualLocation.lat.toFixed(6)}, {manualLocation.lng.toFixed(6)}</div>
                                    </div>
                                    <button onClick={() => setShowMapPicker(false)} style={{ background: '#22c55e', color: 'white', border: 'none', padding: '0.85rem 1.5rem', borderRadius: '14px', fontWeight: 800, cursor: 'pointer', boxShadow: '0 8px 20px rgba(34,197,94,0.3)' }}>Confirm Location</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

/* Map Helpers */
const MapEventsHandler = ({ onMapClick }) => {
    useMapEvents({ click: (e) => onMapClick(e.latlng) });
    return null;
};

const RecenterMap = ({ lat, lng }) => {
    const map = useMap();
    useEffect(() => { map.setView([lat, lng]); }, [lat, lng, map]);
    return null;
};

export default TeacherDashboard;
