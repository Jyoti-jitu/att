import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { User, ShieldCheck, Mail, Phone, Lock, ArrowRight, Check, Key, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

import { API } from '../lib/api';

const TeacherRegistration = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        name: '',
        username: '',
        mobile: '',
        email: '',
        password: '',
        confirm_password: '',
        securityToken: ''
    });
    const [loading, setLoading] = useState(false);
    const [windowWidth, setWindowWidth] = useState(window.innerWidth);

    useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const isMobile = windowWidth <= 600;

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        setError('');

        if (formData.password !== formData.confirm_password) {
            const msg = 'Passwords do not match';
            setError(msg);
            toast.error(msg);
            return;
        }

        if (formData.securityToken !== '157500') {
            const msg = 'Invalid Security Token. Access Denied.';
            setError(msg);
            toast.error(msg);
            return;
        }

        setLoading(true);

        try {
            const res = await fetch(`${API}/api/auth/register/teacher`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            const data = await res.json();
            if (res.ok) {
                toast.success('Faculty Registration Successful!');
                setTimeout(() => navigate('/login/teacher'), 1500);
            } else {
                toast.error(data.error || 'Check details and token');
            }
        } catch (err) {
            toast.error('Connection Error. Could not reach server.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isMobile ? '1rem' : '2rem' }}>
            <div className="bg-mesh" />

            <div className="glass-card animate-fade-in" style={{ maxWidth: '650px', width: '100%', padding: isMobile ? '2rem 1.5rem' : '3.5rem' }}>
                <center style={{ marginBottom: '3rem' }}>
                    <div className="badge" style={{ background: '#f5f3ff', color: '#7c3aed', border: '1px solid #ddd6fe' }}>Faculty Authorization</div>
                    <h2 style={{ fontSize: isMobile ? '1.8rem' : '2.5rem', fontWeight: 800, color: '#1e3a8a', marginBottom: '0.5rem' }}>Teacher Registration</h2>
                    <p style={{ color: '#64748b' }}>Create your administrative account</p>
                </center>



                <form onSubmit={handleRegister}>
                    <div style={{ display: 'grid', gap: '1.5rem' }}>
                        <div className="form-group">
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <User size={16} /> Full Name
                            </label>
                            <input className="input" name="name" placeholder="Prof. John Doe" value={formData.name} onChange={handleChange} required />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1.5rem' }}>
                            <div className="form-group">
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <ShieldCheck size={16} /> Username
                                </label>
                                <input className="input" name="username" placeholder="jdoe_faculty" value={formData.username} onChange={handleChange} required />
                            </div>
                            <div className="form-group">
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Phone size={16} /> Mobile No
                                </label>
                                <input className="input" name="mobile" placeholder="+91 00000 00000" value={formData.mobile} onChange={handleChange} required />
                            </div>
                        </div>

                        <div className="form-group">
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Mail size={16} /> Faculty Email
                            </label>
                            <input className="input" type="email" name="email" placeholder="faculty@college.edu" value={formData.email} onChange={handleChange} required />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1.5rem' }}>
                            <div className="form-group">
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Lock size={16} /> Password
                                </label>
                                <input className="input" type="password" name="password" placeholder="••••••••" value={formData.password} onChange={handleChange} required />
                            </div>
                            <div className="form-group">
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Lock size={16} /> Confirm
                                </label>
                                <input className="input" type="password" name="confirm_password" placeholder="••••••••" value={formData.confirm_password} onChange={handleChange} required />
                            </div>
                        </div>

                        <div className="form-group" style={{ marginTop: '1rem', background: '#f8fafc', padding: isMobile ? '1rem' : '1.5rem', borderRadius: '1rem', border: '1px dashed #e2e8f0' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#1e3a8a' }}>
                                <Key size={16} /> Security Token
                            </label>
                            <input
                                className="input"
                                name="securityToken"
                                placeholder="Enter 6-digit Auth Token"
                                value={formData.securityToken}
                                onChange={handleChange}
                                style={{ background: 'white', letterSpacing: '0.2em', textAlign: 'center', fontSize: isMobile ? '1rem' : '1.2rem', fontWeight: 800 }}
                                required
                            />
                            <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.75rem', textAlign: 'center' }}>
                                * Required for identifying faculty privileges.
                            </p>
                        </div>
                    </div>

                    <button className="btn btn-primary" style={{ width: '100%', height: '4rem', marginTop: '3rem', fontSize: '1.1rem', background: '#7c3aed' }} disabled={loading}>
                        {loading ? 'Authorizing...' : <><ShieldCheck size={20} /> Register as Faculty</>}
                    </button>

                    <div style={{ marginTop: '2.5rem', textAlign: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '2rem' }}>
                        <span style={{ color: '#64748b' }}>Already have a faculty account?</span>
                        <Link to="/login/teacher" style={{ color: '#7c3aed', fontWeight: 700, marginLeft: '0.5rem', textDecoration: 'none' }}>Login Portal</Link>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default TeacherRegistration;
