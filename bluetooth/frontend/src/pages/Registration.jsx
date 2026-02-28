import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { User, Mail, ArrowRight, ShieldCheck, Phone, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import OTPInput from '../components/OTPInput';

import { API } from '../lib/api';

const Registration = () => {
    const navigate = useNavigate();
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

    const [step, setStep] = useState(1);
    const [otp, setOtp] = useState('');
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

    const handleNextStep = async (e) => {
        e.preventDefault();
        if (formData.password !== formData.confirm_password) {
            toast.error('Passwords do not match');
            return;
        }
        if (formData.password.length < 6) {
            toast.error('Password must be at least 6 characters');
            return;
        }
        if (formData.mobile.trim() === formData.parent_mobile.trim()) {
            toast.error('Student and Guardian mobile numbers cannot be identical.');
            return;
        }

        setLoading(true);

        try {
            const res = await fetch(`${API}/api/auth/send-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: formData.email })
            });
            const data = await res.json();
            if (res.ok) {
                toast.success(`Verification code sent to ${formData.email}`);
                setStep(2);
            } else {
                toast.error(data.error || 'Failed to send OTP');
            }
        } catch (err) {
            toast.error('Connection Error. Could not reach server.');
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = async (e) => {
        if (e) e.preventDefault();
        setLoading(true);

        try {
            const res = await fetch(`${API}/api/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...formData, otp })
            });
            const data = await res.json();
            if (res.ok) {
                toast.success('Registration successful! Welcome Aboard.');
                setTimeout(() => navigate('/login/student'), 1500);
            } else {
                toast.error(data.error || 'Invalid code or data');
            }
        } catch (err) {
            toast.error('Connection lost. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const calculatePasswordStrength = (pwd) => {
        if (!pwd) return 0;
        let score = 0;
        if (pwd.length >= 8) score++;
        if (/[A-Z]/.test(pwd)) score++;
        if (/[0-9]/.test(pwd)) score++;
        if (/[!@#$%^&*]/.test(pwd)) score++;
        return score;
    };

    const strength = calculatePasswordStrength(formData.password);
    const strengthColor = strength <= 1 ? '#ef4444' : strength <= 3 ? '#f59e0b' : '#22c55e';
    const strengthText = strength <= 1 ? 'Weak' : strength <= 3 ? 'Medium' : 'Strong';

    return (
        <div className="min-h-screen" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: isTiny ? '1rem' : '2rem' }}>
            <div className="bg-mesh" />

            <div className="glass-card animate-fade-in" style={{ maxWidth: step === 1 ? '1000px' : '500px', width: '100%', padding: isTiny ? '2rem 1.25rem' : isMobile ? '2.5rem' : '3.5rem' }}>
                <center style={{ marginBottom: isTiny ? '2.5rem' : '3.5rem' }}>
                    <div className="badge" style={{ textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                        {step === 1 ? 'Step 1: Details' : 'Step 2: Verification'}
                    </div>
                    <h2 style={{ fontSize: isTiny ? '1.8rem' : isMobile ? '2.2rem' : '2.8rem', fontWeight: 800, color: '#1e3a8a', marginBottom: '0.5rem' }}>
                        {step === 1 ? 'Student Registration' : 'Verify Email'}
                    </h2>
                    <p style={{ color: '#64748b', fontSize: '1.1rem' }}>
                        {step === 1 ? 'Join the GeoAttend community' : `Enter code sent to ${formData.email}`}
                    </p>
                </center>



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
                                <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', color: '#4f46e5', fontSize: '1.2rem', fontWeight: 800 }}>
                                    <div style={{ background: '#eef2ff', padding: '0.5rem', borderRadius: '0.8rem' }}><ShieldCheck size={22} /></div> Security & Contact
                                </h4>
                                <div className="form-group">
                                    <label>Student Email <span style={{ color: '#ef4444' }}>*</span></label>
                                    <input className="input" type="email" name="email" placeholder="student@college.edu" value={formData.email} onChange={handleChange} required />
                                </div>
                                <div className="form-group">
                                    <label>Guardian Mobile <span style={{ color: '#ef4444' }}>*</span></label>
                                    <input className="input" name="parent_mobile" placeholder="Guardian Phone" value={formData.parent_mobile} onChange={handleChange} required />
                                </div>
                                <div className="form-group">
                                    <label>Account Password <span style={{ color: '#ef4444' }}>*</span></label>
                                    <input className="input" type="password" name="password" placeholder="Create password" value={formData.password} onChange={handleChange} required />
                                    {formData.password && (
                                        <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <div style={{ flex: 1, height: '4px', background: '#e2e8f0', borderRadius: '2px', overflow: 'hidden' }}>
                                                <div style={{ width: `${(strength / 4) * 100}%`, height: '100%', background: strengthColor, transition: 'all 0.3s' }} />
                                            </div>
                                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: strengthColor }}>{strengthText}</span>
                                        </div>
                                    )}
                                </div>
                                <div className="form-group">
                                    <label>Confirm Password <span style={{ color: '#ef4444' }}>*</span></label>
                                    <input className="input" type="password" name="confirm_password" placeholder="Retype password" value={formData.confirm_password} onChange={handleChange} required />
                                </div>
                            </div>
                        </div>

                        <div style={{ marginTop: '3rem', textAlign: 'center' }}>
                            <button className="btn btn-primary" type="submit" style={{ width: '100%', maxWidth: '500px', height: '4rem', fontSize: '1.1rem' }} disabled={loading}>
                                {loading ? 'Sending Code...' : 'Next: Verify Email'} <ArrowRight size={22} />
                            </button>
                        </div>
                    </form>
                ) : (
                    <form onSubmit={handleRegister}>
                        <div className="form-group" style={{ textAlign: 'center', marginBottom: '2rem' }}>
                            <label style={{ fontSize: '1rem', fontWeight: 700, color: '#475569', marginBottom: '1.5rem', display: 'block' }}>Enter 6-digit Verification Code</label>
                            <OTPInput length={6} value={otp} onChange={setOtp} onComplete={handleRegister} />
                            <p style={{ marginTop: '1rem', color: '#94a3b8', fontSize: '0.875rem' }}>The code expires in 5 minutes</p>
                        </div>

                        <div style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <button className="btn btn-primary" type="submit" style={{ width: '100%', height: '4rem', fontSize: '1.1rem' }} disabled={loading}>
                                {loading ? 'Verifying...' : 'Finish Registration'}
                            </button>
                            <button className="btn btn-outline" type="button" onClick={() => setStep(1)} style={{ width: '100%' }}>
                                Back to Details
                            </button>
                        </div>

                        <p style={{ marginTop: '2rem', textAlign: 'center', color: '#64748b' }}>
                            Didn't receive the code? <button type="button" onClick={handleNextStep} style={{ background: 'none', border: 'none', color: '#2563eb', fontWeight: 700, cursor: 'pointer' }}>Resend</button>
                        </p>
                    </form>
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
