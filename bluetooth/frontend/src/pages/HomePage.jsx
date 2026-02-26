import React from 'react';
import { Link } from 'react-router-dom';
import {
    MapPin,
    ShieldCheck,
    Zap,
    Users,
    Lock,
    ArrowRight,
    Clock,
    Smartphone
} from 'lucide-react';

const HomePage = () => {
    return (
        <div className="min-h-screen">
            {/* Background Aesthetic */}
            <div className="bg-mesh" />

            {/* Navigation */}
            <nav className="glass" style={{ position: 'fixed', top: 0, width: '100%', zIndex: 100, padding: '1rem 0' }}>
                <div className="container" style={{ padding: '0 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div className="bg-blue" style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
                            <center style={{ width: '100%' }}>📍</center>
                        </div>
                        <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e3a8a' }}>GeoAttend</span>
                    </div>
                    <div style={{ display: 'flex', gap: '2rem' }}>
                        <Link to="/login/student" className="nav-link">Student Portal</Link>
                        <Link to="/login/teacher" className="nav-link">Teacher Portal</Link>
                        <Link to="/register" className="btn btn-primary" style={{ padding: '0.5rem 1.25rem', fontSize: '0.875rem' }}>Get Started</Link>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <header className="hero-section container animate-fade-in">
                <div className="badge">✨ Next-Gen Attendance System</div>
                <h1 className="hero-title">
                    Attendance, <span style={{ color: '#2563eb', WebkitTextFillColor: 'initial', background: 'none' }}>Verified</span> by <br /> Precise Location.
                </h1>
                <p className="subtitle">
                    Eliminate proxy attendance with section-based access control, real-time geo-fencing, and dynamic OTP verification. Simple for teachers, seamless for students.
                </p>
                <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center' }}>
                    <Link to="/register/teacher" className="btn btn-primary" style={{ background: '#7c3aed' }}>
                        Teacher Portal <ArrowRight size={20} />
                    </Link>
                    <Link to="/login/student" className="btn btn-outline">
                        Student Check-in
                    </Link>
                </div>

                {/* Decorative Stats */}
                <div style={{ marginTop: '5rem', display: 'flex', gap: '4rem', justifyContent: 'center', opacity: 0.7 }}>
                    <div>
                        <div style={{ fontSize: '2rem', fontWeight: 800 }}>10m</div>
                        <div style={{ color: '#64748b', fontSize: '0.875rem' }}>Geo-fence Radius</div>
                    </div>
                    <div>
                        <div style={{ fontSize: '2rem', fontWeight: 800 }}>100%</div>
                        <div style={{ color: '#64748b', fontSize: '0.875rem' }}>Anti-Proxy</div>
                    </div>
                    <div>
                        <div style={{ fontSize: '2rem', fontWeight: 800 }}>3min</div>
                        <div style={{ color: '#64748b', fontSize: '0.875rem' }}>Session Timer</div>
                    </div>
                </div>
            </header>

            {/* Features Grid */}
            <section className="container">
                <center>
                    <h2 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '1rem' }}>Powerful Security Features</h2>
                    <p className="subtitle">Our system ensures physical presence through multiple layers of verification.</p>
                </center>

                <div className="feature-grid">
                    <div className="glass-card">
                        <div className="icon-wrapper bg-blue">
                            <MapPin size={32} />
                        </div>
                        <h3>Geo-Fenced Radius</h3>
                        <p style={{ color: '#64748b', marginTop: '1rem' }}>
                            Uses the Haversine formula to verify students are within a strict <strong>10-meter</strong> radius of the teacher's live location. Proxy attendance is mathematically blocked.
                        </p>
                    </div>

                    <div className="glass-card">
                        <div className="icon-wrapper bg-indigo">
                            <Zap size={32} />
                        </div>
                        <h3>Dynamic OTP</h3>
                        <p style={{ color: '#64748b', marginTop: '1rem' }}>
                            Each session generates a unique 6-digit OTP that expires in 3 minutes, preventing students from sharing codes remotely.
                        </p>
                    </div>

                    <div className="glass-card">
                        <div className="icon-wrapper bg-violet">
                            <ShieldCheck size={32} />
                        </div>
                        <h3>Section Locking</h3>
                        <p style={{ color: '#64748b', marginTop: '1rem' }}>
                            Students are permanently assigned to sections. They can only join sessions created for their specific class and branch.
                        </p>
                    </div>
                </div>
            </section>

            {/* How it Works */}
            <section className="container" style={{ marginTop: '8rem' }}>
                <div className="glass-card" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '4rem', alignItems: 'center', padding: '4rem' }}>
                    <div>
                        <h2 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '2rem' }}>Ready for the <br /> Modern Classroom?</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                            <div style={{ display: 'flex', gap: '1.5rem' }}>
                                <div className="bg-blue" style={{ width: '3rem', height: '3rem', borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>1</div>
                                <div>
                                    <h4 style={{ fontWeight: 700 }}>Teacher Starts Session</h4>
                                    <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Selects section and captures current classroom coordinates.</p>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '1.5rem' }}>
                                <div className="bg-indigo" style={{ width: '3rem', height: '3rem', borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>2</div>
                                <div>
                                    <h4 style={{ fontWeight: 700 }}>Student Location Check</h4>
                                    <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Student must be within <strong>10 meters</strong> of the teacher for attendance to be accepted. No proxy possible.</p>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '1.5rem' }}>
                                <div className="bg-violet" style={{ width: '3rem', height: '3rem', borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>3</div>
                                <div>
                                    <h4 style={{ fontWeight: 700 }}>Dual Verification</h4>
                                    <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Student enters OTP and marked present instantly in the cloud.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div style={{ position: 'relative' }}>
                        <div className="glass-card animate-float" style={{ padding: '2rem', border: '1px solid #2563eb', background: 'white' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                                <div style={{ fontWeight: 800 }}>Live Session</div>
                                <div style={{ color: '#10b981', fontWeight: 600 }}>Active • 02:45</div>
                            </div>
                            <div className="otp-box" style={{ margin: '1rem 0', fontSize: '2rem', letterSpacing: '0.3rem' }}>482 910</div>
                            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                                <div style={{ background: '#f1f5f9', padding: '1rem', borderRadius: '0.75rem', flex: 1 }}>
                                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>PRESENT</div>
                                    <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>42 / 60</div>
                                </div>
                                <div style={{ background: '#f1f5f9', padding: '1rem', borderRadius: '0.75rem', flex: 1 }}>
                                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>DIST(AVG)</div>
                                    <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>4.2 m</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Security Explanation */}
            <section className="container" style={{ marginTop: '4rem' }}>
                <div style={{ border: '1px solid #e2e8f0', background: '#f8fafc', padding: '3rem', borderRadius: '1.5rem', textAlign: 'center' }}>
                    <div className="bg-blue" style={{ width: '4rem', height: '4rem', borderRadius: '50%', margin: '0 auto 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1e3a8a' }}>
                        <Lock size={30} />
                    </div>
                    <h2 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '1rem', color: '#0f172a' }}>Multi-Layer Security Architecture</h2>
                    <p style={{ color: '#475569', fontSize: '1.1rem', maxWidth: '800px', margin: '0 auto', lineHeight: '1.6' }}>
                        "This system uses multi-layer verification including device binding, geo-fencing (<strong>10-meter strict radius</strong>), time-restricted attendance window, and section-based filtering to eliminate proxy attendance completely."
                    </p>
                </div>
            </section>

            {/* Footer */}
            <footer className="container" style={{ marginTop: '10rem', paddingBottom: '4rem', borderTop: '1px solid rgba(0,0,0,0.05)', textAlign: 'center' }}>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                    <div className="bg-blue" style={{ width: '2rem', height: '2rem', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>📍</div>
                    <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#1e3a8a' }}>GeoAttend</span>
                </div>
                <p style={{ color: '#64748b' }}>Built for professional college environments and secure attendance tracking.</p>
                <div style={{ marginTop: '2rem', color: '#94a3b8', fontSize: '0.875rem' }}>
                    © 2026 Smart Attendance System by Antigravity AI
                </div>
            </footer>
        </div >
    );
};

export default HomePage;
