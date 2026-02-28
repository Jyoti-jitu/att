import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, LogIn, ArrowLeft, ShieldCheck, GraduationCap, Laptop, UserCheck } from 'lucide-react';
import toast from 'react-hot-toast';

import { API } from '../lib/api';

const Login = () => {
    const { role } = useParams(); // 'teacher' or 'student'
    const navigate = useNavigate();
    const { login } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [windowWidth, setWindowWidth] = useState(window.innerWidth);

    useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const isMobile = windowWidth <= 900;
    const isTiny = windowWidth <= 480;

    // Dynamic theme colors
    const themeColor = role === 'teacher' ? '#7c3aed' : '#2563eb';
    const bgColor = role === 'teacher' ? 'rgba(124, 58, 237, 0.05)' : 'rgba(37, 99, 235, 0.05)';

    const handleSubmit = async (e, force = false) => {
        if (e) e.preventDefault();
        setLoading(true);

        try {
            const res = await fetch(`${API}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, role, forceLogin: force })
            });

            const data = await res.json();


            if (res.ok) {
                toast.success('Access Granted. Redirecting...');
                login(data.user, data.token);
                navigate(role === 'teacher' ? '/teacher/dashboard' : '/student/dashboard');
            } else {
                toast.error(data.error || 'Invalid credentials');
            }
        } catch (err) {
            toast.error('Connection failure. Check if backend is alive.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen" style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: isTiny ? '1rem' : '2rem',
            background: bgColor
        }}>
            <div className="bg-mesh" />

            <div className="glass-card animate-fade-in" style={{
                maxWidth: isMobile ? '500px' : '1000px',
                width: '100%',
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
                padding: 0,
                overflow: 'hidden',
                borderRadius: '2rem',
                border: '1px solid rgba(255,255,255,0.4)',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)'
            }}>
                {/* Left Side: Visual Side (Hidden on Mobile) */}
                {!isMobile && (
                    <div style={{
                        background: themeColor,
                        padding: '4rem',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        color: 'white',
                        position: 'relative'
                    }}>
                        <div style={{ position: 'relative', zIndex: 1 }}>
                            <div style={{
                                width: '4rem',
                                height: '4rem',
                                background: 'rgba(255,255,255,0.2)',
                                borderRadius: '1rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: '2rem'
                            }}>
                                {role === 'teacher' ? <ShieldCheck size={32} /> : <GraduationCap size={32} />}
                            </div>
                            <h1 style={{ fontSize: '3rem', fontWeight: 800, lineHeight: 1.1, marginBottom: '1.5rem' }}>
                                {role === 'teacher' ? 'Faculty Portal' : 'Student Hub'}
                            </h1>
                            <p style={{ fontSize: '1.1rem', opacity: 0.9, fontWeight: 300, lineHeight: 1.6 }}>
                                {role === 'teacher'
                                    ? 'Authorize sessions, monitor real-time attendance, and manage your classroom with geo-precision.'
                                    : 'Check-in securely via Bluetooth & GPS. Stay on track with your academic attendance records.'}
                            </p>

                            <div style={{ marginTop: '3rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <div style={{ background: 'rgba(255,255,255,0.15)', padding: '0.5rem', borderRadius: '0.5rem' }}>
                                        <Laptop size={18} />
                                    </div>
                                    <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>Secure Cloud Verification</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <div style={{ background: 'rgba(255,255,255,0.15)', padding: '0.5rem', borderRadius: '0.5rem' }}>
                                        <UserCheck size={18} />
                                    </div>
                                    <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>Zero-Proxy Protection</span>
                                </div>
                            </div>
                        </div>

                        {/* Abstract Circle Background */}
                        <div style={{
                            position: 'absolute',
                            bottom: '-10%',
                            left: '-10%',
                            width: '300px',
                            height: '300px',
                            border: '40px solid rgba(255,255,255,0.05)',
                            borderRadius: '50%'
                        }} />
                    </div>
                )}

                {/* Right Side: Form Side */}
                <div style={{ padding: isTiny ? '2.5rem 1.5rem' : isMobile ? '3rem' : '5rem 4rem', background: 'white' }}>
                    <div style={{ marginBottom: '3rem' }}>
                        <h2 style={{ fontSize: isTiny ? '1.75rem' : '2.2rem', fontWeight: 800, color: '#1e293b', marginBottom: '0.5rem' }}>Welcome Back</h2>
                        <p style={{ color: '#64748b' }}>Please enter your access details</p>
                    </div>

                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label style={{ color: '#475569', fontSize: '0.85rem' }}>Email Address</label>
                            <div style={{ position: 'relative' }}>
                                <Mail size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                <input
                                    className="input"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder={role === 'teacher' ? 'faculty@college.edu' : 'student@college.edu'}
                                    style={{ paddingLeft: '3rem' }}
                                    required
                                />
                            </div>
                        </div>

                        <div className="form-group" style={{ marginBottom: '2.5rem' }}>
                            <label style={{ color: '#475569', fontSize: '0.85rem' }}>Password</label>
                            <div style={{ position: 'relative' }}>
                                <Lock size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                <input
                                    className="input"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    style={{ paddingLeft: '3rem' }}
                                    required
                                />
                            </div>
                        </div>

                        <button className="btn btn-primary" style={{
                            width: '100%',
                            height: isTiny ? '3.5rem' : '4rem',
                            background: themeColor,
                            fontSize: '1.1rem',
                            borderRadius: '1rem'
                        }} disabled={loading}>
                            {loading ? 'Authenticating...' : `Sign In`}
                        </button>

                        <div style={{ marginTop: '2.5rem', textAlign: 'center' }}>
                            {role === 'student' ? (
                                <p style={{ fontSize: '0.95rem', color: '#64748b' }}>
                                    New student? <Link to="/register" style={{ color: themeColor, fontWeight: 700, textDecoration: 'none' }}>Enroll Now</Link>
                                </p>
                            ) : (
                                <p style={{ fontSize: '0.95rem', color: '#64748b' }}>
                                    Not authorized? <Link to="/register/teacher" style={{ color: themeColor, fontWeight: 700, textDecoration: 'none' }}>Join Faculty</Link>
                                </p>
                            )}
                        </div>
                    </form>

                    <div style={{ marginTop: '3rem', display: 'flex', justifyContent: 'center' }}>
                        <Link to="/" style={{
                            color: '#94a3b8',
                            textDecoration: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            fontSize: '0.9rem',
                            transition: 'color 0.2s'
                        }} onMouseEnter={(e) => e.target.style.color = themeColor} onMouseLeave={(e) => e.target.style.color = '#94a3b8'}>
                            <ArrowLeft size={16} /> Return to Home
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
