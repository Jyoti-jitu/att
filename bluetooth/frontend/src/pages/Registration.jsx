import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { User, Phone, Mail, BookOpen, Layers, ShieldCheck, ArrowRight, Check, Smartphone, GraduationCap } from 'lucide-react';
import toast from 'react-hot-toast';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const Registration = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState(1); // 1: Info, 2: Student OTP, 3: Parent OTP
    const [formData, setFormData] = useState({
        name: '',
        roll_no: '',
        mobile: '',
        branch: 'CSE',
        semester: '1',
        section: '1',
        email: '',
        parent_mobile: '',
        password: '',
        confirm_password: ''
    });

    const [studentOtp, setStudentOtp] = useState(['', '', '', '', '', '']);
    const [parentOtp, setParentOtp] = useState(['', '', '', '', '', '']);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [windowWidth, setWindowWidth] = useState(window.innerWidth);

    useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const isMobile = windowWidth <= 768;
    const isTiny = windowWidth <= 480;

    const branches = ['CSE', 'CSE-AI', 'CSE-DS', 'IT', 'ECE', 'EEE', 'MECH'];
    const semesters = ['1', '2', '3', '4', '5', '6', '7', '8'];
    const sections = ['1', '2', '3'];

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleOtpChange = (type, index, value) => {
        if (!/^\d*$/.test(value)) return;
        const newOtp = type === 'student' ? [...studentOtp] : [...parentOtp];
        newOtp[index] = value.slice(-1);

        if (type === 'student') setStudentOtp(newOtp);
        else setParentOtp(newOtp);

        // Auto-focus next input
        if (value && index < 5) {
            const nextInput = document.getElementById(`${type}-otp-${index + 1}`);
            if (nextInput) nextInput.focus();
        }
    };

    const handleNextStep = async (e) => {
        e.preventDefault();
        if (formData.password !== formData.confirm_password) {
            const msg = 'Passwords do not match';
            setError(msg);
            toast.error(msg);
            return;
        }
        if (formData.password.length < 6) {
            const msg = 'Password must be at least 6 characters';
            setError(msg);
            toast.error(msg);
            return;
        }
        if (formData.mobile.trim() === formData.parent_mobile.trim()) {
            const msg = 'Student and Guardian mobile numbers cannot be identical.';
            setError(msg);
            toast.error(msg);
            return;
        }
        setError('');
        setLoading(true);

        try {
            const res = await fetch(`${API}/api/auth/send-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: formData.mobile })
            });
            const data = await res.json();
            if (res.ok) {
                toast.success('OTP sent to your mobile');
                setStep(2); // Go to Student OTP
            } else {
                const errMsg = data.error || 'Failed to send OTP to Student Mobile';
                setError(errMsg);
                toast.error(errMsg);
            }
        } catch (err) {
            const errMsg = 'Is the server running? ' + err.message;
            setError(errMsg);
            toast.error(errMsg);
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyStudentOtp = async () => {
        const otp = studentOtp.join('');
        if (otp.length < 6) {
            setError('Please enter all 6 digits.');
            return;
        }
        setError('');
        setLoading(true);

        try {
            const res = await fetch(`${API}/api/auth/verify-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: formData.mobile, otp })
            });
            const data = await res.json();
            if (res.ok) {
                toast.success('Mobile Verified. Sending code to parent.');
                // Verified. Now send OTP to parent.
                await fetch(`${API}/api/auth/send-otp`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phone: formData.parent_mobile })
                });
                setStep(3); // Go to Parent OTP
            } else {
                const errMsg = data.error || 'Invalid OTP';
                setError(errMsg);
                toast.error(errMsg);
            }
        } catch (err) {
            const errMsg = 'Server connection failed.';
            setError(errMsg);
            toast.error(errMsg);
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyParentOtpAndRegister = async () => {
        const otp = parentOtp.join('');
        if (otp.length < 6) return;

        setError('');
        setLoading(true);

        try {
            // 1. Verify Parent OTP
            const otpRes = await fetch(`${API}/api/auth/verify-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: formData.parent_mobile, otp })
            });
            const otpData = await otpRes.json();

            if (!otpRes.ok) {
                setError(otpData.error || 'Invalid Parent OTP');
                setLoading(false);
                return;
            }

            // 2. Register Student
            const res = await fetch(`${API}/api/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...formData })
            });
            const data = await res.json();
            if (res.ok) {
                toast.success('Registration successful! Welcome to GeoAttend.');
                navigate('/login/student');
            } else {
                setError(data.error || 'Registration failed');
            }
        } catch (err) {
            setError('Server connection failed. Is the backend running?');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: isTiny ? '1rem' : '2rem' }}>
            <div className="bg-mesh" />

            <div className="glass-card animate-fade-in" style={{ maxWidth: '1000px', width: '100%', padding: isTiny ? '2rem 1.25rem' : isMobile ? '2.5rem' : '3.5rem' }}>
                <center style={{ marginBottom: isTiny ? '2.5rem' : '3.5rem' }}>
                    <div className="badge" style={{ textTransform: 'uppercase', letterSpacing: '0.1em' }}>Secure Enrollment</div>
                    <h2 style={{ fontSize: isTiny ? '1.8rem' : isMobile ? '2.2rem' : '2.8rem', fontWeight: 800, color: '#1e3a8a', marginBottom: '0.5rem' }}>Student Registration</h2>

                    {/* Progress Bar */}
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1.5rem', width: '100%', maxWidth: '600px' }}>
                        {[
                            { id: 1, label: isTiny ? 'INFO' : 'INFO' },
                            { id: 2, label: isTiny ? 'S-OTP' : 'STUDENT OTP' },
                            { id: 3, label: isTiny ? 'P-OTP' : 'PARENT OTP' }
                        ].map((s) => (
                            <div key={s.id} style={{ flex: 1, textAlign: 'center' }}>
                                <div style={{
                                    height: '4px',
                                    background: step >= s.id ? '#2563eb' : '#e2e8f0',
                                    borderRadius: '2px',
                                    marginBottom: '0.5rem',
                                    transition: 'all 0.3s'
                                }} />
                                <span style={{
                                    fontSize: '0.65rem',
                                    fontWeight: 800,
                                    color: step >= s.id ? '#2563eb' : '#94a3b8'
                                }}>{s.label}</span>
                            </div>
                        ))}
                    </div>
                </center>

                {error && (
                    <div style={{ color: '#ef4444', background: '#fef2f2', border: '1px solid #fecaca', padding: '1rem', borderRadius: '1rem', marginBottom: '2.5rem', textAlign: 'center', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontSize: isTiny ? '0.85rem' : '1rem' }}>
                        ⚠️ {error}
                    </div>
                )}

                {step === 1 ? (
                    <form onSubmit={handleNextStep}>
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(320px, 1fr))', gap: isMobile ? '2rem' : '3rem' }}>
                            {/* Personal Info */}
                            <div>
                                <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', color: '#1e3a8a', fontSize: '1.1rem', fontWeight: 700 }}>
                                    <div style={{ background: '#eff6ff', padding: '0.5rem', borderRadius: '0.5rem' }}><User size={20} /></div> Basic Details
                                </h4>
                                <div className="form-group">
                                    <label>Full Name</label>
                                    <input className="input" name="name" placeholder="John Doe" value={formData.name} onChange={handleChange} required />
                                </div>
                                <div className="form-group">
                                    <label>Roll Number</label>
                                    <input className="input" name="roll_no" placeholder="CS2024001" value={formData.roll_no} onChange={handleChange} required />
                                </div>
                                <div className="form-group">
                                    <label>Mobile Number</label>
                                    <input className="input" name="mobile" placeholder="+91 00000 00000" value={formData.mobile} onChange={handleChange} required />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: isTiny ? '1fr' : 'repeat(3, 1fr)', gap: '0.75rem' }}>
                                    <div className="form-group">
                                        <label>Branch</label>
                                        <select className="input" name="branch" value={formData.branch} onChange={handleChange}>
                                            {branches.map(b => <option key={b} value={b}>{b}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>Semester</label>
                                        <select className="input" name="semester" value={formData.semester} onChange={handleChange}>
                                            {semesters.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>Section</label>
                                        <select className="input" name="section" value={formData.section} onChange={handleChange}>
                                            {sections.map(s => <option key={s} value={s}>{formData.branch}-{s}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Contact & Security */}
                            <div>
                                <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', color: '#4f46e5', fontSize: '1.1rem', fontWeight: 700 }}>
                                    <div style={{ background: '#eef2ff', padding: '0.5rem', borderRadius: '0.5rem' }}><Mail size={20} /></div> Security & Contacts
                                </h4>
                                <div className="form-group">
                                    <label>Student Email</label>
                                    <input className="input" type="email" name="email" placeholder="student@college.edu" value={formData.email} onChange={handleChange} required />
                                </div>
                                <div className="form-group">
                                    <label>Guardian Mobile</label>
                                    <input className="input" name="parent_mobile" placeholder="+91 00000 00000" value={formData.parent_mobile} onChange={handleChange} required />
                                </div>
                                <div className="form-group">
                                    <label>Account Password</label>
                                    <input className="input" type="password" name="password" placeholder="Password" value={formData.password} onChange={handleChange} required />
                                </div>
                                <div className="form-group">
                                    <label>Verify Password</label>
                                    <input className="input" type="password" name="confirm_password" placeholder="Password" value={formData.confirm_password} onChange={handleChange} required />
                                </div>
                            </div>
                        </div>

                        <div style={{ marginTop: '3rem', textAlign: 'center' }}>
                            <button className="btn btn-primary" style={{ width: '100%', maxWidth: '500px', height: '4rem', fontSize: '1.1rem' }} disabled={loading}>
                                {loading ? 'Processing...' : 'Send Verification Codes'} <ArrowRight size={22} />
                            </button>
                        </div>
                    </form>
                ) : step === 2 ? (
                    <div style={{ textAlign: 'center', maxWidth: '500px', margin: '0 auto' }}>
                        <div className="icon-wrapper bg-blue" style={{ margin: '0 auto 2rem', width: '4.5rem', height: '4.5rem', borderRadius: '1.25rem' }}>
                            <Smartphone size={32} />
                        </div>
                        <h3 style={{ fontSize: isTiny ? '1.5rem' : '1.8rem', fontWeight: 800, marginBottom: '0.75rem' }}>Student Verification</h3>
                        <p style={{ color: '#64748b', marginBottom: '2.5rem', fontSize: isTiny ? '0.9rem' : '1.1rem' }}>
                            Verification code sent to your mobile <br /> <strong style={{ color: '#1e293b' }}>{formData.mobile}</strong>
                        </p>

                        <div style={{ display: 'flex', gap: isTiny ? '0.5rem' : '1rem', justifyContent: 'center', marginBottom: '3rem' }}>
                            {studentOtp.map((digit, idx) => (
                                <input
                                    key={idx}
                                    id={`student-otp-${idx}`}
                                    className="input"
                                    autoComplete="off"
                                    style={{
                                        width: isTiny ? '2.5rem' : '3.5rem',
                                        height: isTiny ? '3.5rem' : '4.5rem',
                                        textAlign: 'center',
                                        fontSize: isTiny ? '1.4rem' : '1.8rem',
                                        fontWeight: 800,
                                        padding: 0,
                                        background: '#f8fafc',
                                        border: '2px solid #e2e8f0',
                                        borderRadius: '0.75rem'
                                    }}
                                    value={digit}
                                    onChange={(e) => handleOtpChange('student', idx, e.target.value)}
                                    maxLength={1}
                                />
                            ))}
                        </div>

                        <button className="btn btn-primary" style={{ width: '100%', height: '3.5rem', fontSize: '1.1rem' }} onClick={handleVerifyStudentOtp} disabled={loading}>
                            {loading ? 'Verifying...' : 'Verify Student ID'} <Check size={22} />
                        </button>

                        <button style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', marginTop: '1.5rem', fontWeight: 600 }} onClick={() => setStep(1)}>
                            ← Edit Details
                        </button>
                    </div>
                ) : (
                    <div style={{ textAlign: 'center', maxWidth: '500px', margin: '0 auto' }}>
                        <div className="icon-wrapper bg-indigo" style={{ margin: '0 auto 2rem', width: '4.5rem', height: '4.5rem', borderRadius: '1.25rem' }}>
                            <ShieldCheck size={32} />
                        </div>
                        <h3 style={{ fontSize: isTiny ? '1.5rem' : '1.8rem', fontWeight: 800, marginBottom: '0.75rem' }}>Guardian Approval</h3>
                        <p style={{ color: '#64748b', marginBottom: '2.5rem', fontSize: isTiny ? '0.9rem' : '1.1rem' }}>
                            Second code sent to Parent/Guardian mobile <br /> <strong style={{ color: '#1e293b' }}>{formData.parent_mobile}</strong>
                        </p>

                        <div style={{ display: 'flex', gap: isTiny ? '0.5rem' : '1rem', justifyContent: 'center', marginBottom: '3rem' }}>
                            {parentOtp.map((digit, idx) => (
                                <input
                                    key={idx}
                                    id={`parent-otp-${idx}`}
                                    className="input"
                                    autoComplete="off"
                                    style={{
                                        width: isTiny ? '2.5rem' : '3.5rem',
                                        height: isTiny ? '3.5rem' : '4.5rem',
                                        textAlign: 'center',
                                        fontSize: isTiny ? '1.4rem' : '1.8rem',
                                        fontWeight: 800,
                                        padding: 0,
                                        background: '#f8fafc',
                                        border: '2px solid #e2e8f0',
                                        borderRadius: '0.75rem'
                                    }}
                                    value={digit}
                                    onChange={(e) => handleOtpChange('parent', idx, e.target.value)}
                                    maxLength={1}
                                />
                            ))}
                        </div>

                        <button className="btn btn-primary" style={{ width: '100%', height: '3.5rem', fontSize: '1.1rem' }} onClick={handleVerifyParentOtpAndRegister} disabled={loading}>
                            {loading ? 'Finalizing Profile...' : 'Complete Enrollment'} <Check size={22} />
                        </button>

                        <button style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', marginTop: '1.5rem', fontWeight: 600 }} onClick={() => setStep(2)}>
                            ← Previous Step
                        </button>
                    </div>
                )}

                <div style={{ marginTop: '3.5rem', textAlign: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '2.5rem', fontSize: '1rem' }}>
                    <p style={{ color: '#64748b' }}>
                        Already have an account? <Link to="/login/student" style={{ color: '#2563eb', fontWeight: 700, textDecoration: 'none' }}>Sign In here</Link>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Registration;
