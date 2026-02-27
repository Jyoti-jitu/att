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
    const [windowWidth, setWindowWidth] = React.useState(window.innerWidth);

    React.useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const isMobile = windowWidth <= 900;
    const isTiny = windowWidth <= 480;

    return (
        <div className="min-h-screen">
            {/* Background Aesthetic */}
            <div className="bg-mesh" />

            {/* Navigation */}
            <nav className="glass" style={{ position: 'fixed', top: 0, width: '100%', zIndex: 100, padding: isTiny ? '0.75rem 0' : '1rem 0' }}>
                <div className="container" style={{ padding: isMobile ? '0 1.25rem' : '0 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div className="bg-blue" style={{ width: isTiny ? '2rem' : '2.5rem', height: isTiny ? '2rem' : '2.5rem', borderRadius: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: isTiny ? '1rem' : '1.2rem' }}>
                            <center style={{ width: '100%' }}>📍</center>
                        </div>
                        <span style={{ fontSize: isTiny ? '1.25rem' : '1.5rem', fontWeight: 800, color: '#1e3a8a' }}>GeoAttend</span>
                    </div>
                    <div style={{ display: 'flex', gap: isTiny ? '0.5rem' : '1rem', alignItems: 'center' }}>
                        {!isMobile ? (
                            <>
                                <Link to="/register" className="btn btn-primary" style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem' }}>Student Reg</Link>
                                <Link to="/register/teacher" className="btn btn-primary" style={{ background: '#7c3aed', padding: '0.5rem 1.25rem', fontSize: '0.85rem' }}>Teacher Reg</Link>
                            </>
                        ) : (
                            <Link to="/register" className="btn btn-primary" style={{ padding: '0.4rem 1rem', fontSize: '0.75rem' }}>Join Now</Link>
                        )}
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <header className="hero-section container animate-fade-in" style={{ padding: isMobile ? '7rem 1.5rem 3rem' : '10rem 2rem 6rem' }}>
                <div className="badge" style={{ fontSize: isTiny ? '0.7rem' : '0.875rem', padding: '0.4rem 0.8rem' }}>✨ Next-Gen Attendance System</div>
                <h1 className="hero-title" style={{ fontSize: isTiny ? '2.2rem' : isMobile ? '3.2rem' : '4.5rem' }}>
                    Attendance, <span style={{ color: '#2563eb', WebkitTextFillColor: 'initial', background: 'none' }}>Verified</span> by <br /> Precise Location.
                </h1>
                <p className="subtitle" style={{ fontSize: isTiny ? '0.95rem' : '1.25rem', marginBottom: isMobile ? '2.5rem' : '3rem', maxWidth: '700px' }}>
                    Eliminate proxy attendance with section-based access control, real-time geo-fencing, and dynamic verification. Simple for teachers, seamless for students.
                </p>
                <div style={{ display: 'flex', gap: isMobile ? '1rem' : '1.5rem', justifyContent: 'center', flexDirection: isTiny ? 'column' : 'row', alignItems: 'center' }}>
                    <Link to="/login/teacher" className="btn btn-primary" style={{ background: '#7c3aed', width: isTiny ? '100%' : 'auto', minWidth: '200px' }}>
                        Teacher Check-in <ArrowRight size={20} />
                    </Link>
                    <Link to="/login/student" className="btn btn-outline" style={{ width: isTiny ? '100%' : 'auto', minWidth: '200px' }}>
                        Student Check-in
                    </Link>
                </div>

                {/* Decorative Stats */}
                <div style={{ marginTop: isMobile ? '3rem' : '5rem', display: 'flex', gap: isMobile ? '2rem' : '4rem', justifyContent: 'center', opacity: 0.8, flexWrap: 'wrap' }}>
                    <div>
                        <div style={{ fontSize: isTiny ? '1.5rem' : '2rem', fontWeight: 800, color: '#1e3a8a' }}>10m</div>
                        <div style={{ color: '#64748b', fontSize: isTiny ? '0.7rem' : '0.875rem', fontWeight: 600 }}>Geo-fence</div>
                    </div>
                    <div>
                        <div style={{ fontSize: isTiny ? '1.5rem' : '2rem', fontWeight: 800, color: '#1e3a8a' }}>100%</div>
                        <div style={{ color: '#64748b', fontSize: isTiny ? '0.7rem' : '0.875rem', fontWeight: 600 }}>Anti-Proxy</div>
                    </div>
                    <div>
                        <div style={{ fontSize: isTiny ? '1.5rem' : '2rem', fontWeight: 800, color: '#1e3a8a' }}>3min</div>
                        <div style={{ color: '#64748b', fontSize: isTiny ? '0.7rem' : '0.875rem', fontWeight: 600 }}>Code Window</div>
                    </div>
                </div>
            </header>

            {/* Features Grid */}
            <section className="container" style={{ padding: isMobile ? '3rem 1.5rem' : '5rem 2rem' }}>
                <center>
                    <h2 style={{ fontSize: isTiny ? '1.8rem' : isMobile ? '2.2rem' : '2.8rem', fontWeight: 900, marginBottom: '1rem', color: '#1e293b' }}>Powerful Security Features</h2>
                    <p className="subtitle" style={{ fontSize: isTiny ? '0.9rem' : '1.1rem' }}>Our system ensures physical presence through multiple layers of verification.</p>
                </center>

                <div className="feature-grid" style={{ gap: isMobile ? '1.5rem' : '2.5rem', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(340px, 1fr))' }}>
                    <div className="glass-card" style={{ padding: isTiny ? '1.75rem' : '2.5rem' }}>
                        <div className="icon-wrapper bg-blue">
                            <MapPin size={32} />
                        </div>
                        <h3 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Geo-Fenced Radius</h3>
                        <p style={{ color: '#64748b', marginTop: '1rem', lineHeight: 1.7 }}>
                            Uses the Haversine formula to verify students are within a strict <strong>10-meter</strong> radius of the teacher's live location. Proxy attendance is mathematically blocked.
                        </p>
                    </div>

                    <div className="glass-card" style={{ padding: isTiny ? '1.75rem' : '2.5rem' }}>
                        <div className="icon-wrapper bg-indigo">
                            <Zap size={32} />
                        </div>
                        <h3 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Dynamic OTP</h3>
                        <p style={{ color: '#64748b', marginTop: '1rem', lineHeight: 1.7 }}>
                            Each session generates a unique 6-digit OTP that expires in 3 minutes, preventing students from sharing codes remotely.
                        </p>
                    </div>

                    <div className="glass-card" style={{ padding: isTiny ? '1.75rem' : '2.5rem' }}>
                        <div className="icon-wrapper bg-violet">
                            <ShieldCheck size={32} />
                        </div>
                        <h3 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Section Locking</h3>
                        <p style={{ color: '#64748b', marginTop: '1rem', lineHeight: 1.7 }}>
                            Students are permanently assigned to sections. They can only join sessions created for their specific class and branch.
                        </p>
                    </div>
                </div>
            </section>

            {/* How it Works */}
            <section className="container" style={{ marginTop: isMobile ? '2rem' : '5rem' }}>
                <div className="glass-card" style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr' : '1.2fr 1fr',
                    gap: isMobile ? '3rem' : '4rem',
                    alignItems: 'center',
                    padding: isMobile ? '2rem 1.5rem' : '4rem'
                }}>
                    <div>
                        <h2 style={{ fontSize: isTiny ? '1.8rem' : '2.5rem', fontWeight: 900, marginBottom: '2rem', color: '#1e293b' }}>Ready for the <br /> Modern Classroom?</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '1.5rem' : '2rem' }}>
                            <div style={{ display: 'flex', gap: '1.25rem' }}>
                                <div className="bg-blue" style={{ width: '2.5rem', height: '2.5rem', borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.9rem' }}>1</div>
                                <div>
                                    <h4 style={{ fontWeight: 800, fontSize: '1.1rem' }}>Teacher Starts Session</h4>
                                    <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '0.25rem' }}>Selects section and captures current classroom coordinates.</p>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '1.25rem' }}>
                                <div className="bg-indigo" style={{ width: '2.5rem', height: '2.5rem', borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.9rem' }}>2</div>
                                <div>
                                    <h4 style={{ fontWeight: 800, fontSize: '1.1rem' }}>Student Location Check</h4>
                                    <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '0.25rem' }}>Student must be within <strong>10 meters</strong> of the teacher. No proxy possible.</p>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '1.25rem' }}>
                                <div className="bg-violet" style={{ width: '2.5rem', height: '2.5rem', borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.9rem' }}>3</div>
                                <div>
                                    <h4 style={{ fontWeight: 800, fontSize: '1.1rem' }}>Instant Recording</h4>
                                    <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '0.25rem' }}>Student enters OTP and is marked present instantly in the cloud.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div style={{ position: 'relative' }}>
                        <div className="glass-card animate-float" style={{ padding: '1.5rem', border: '1px solid #2563eb', background: 'white', maxWidth: '380px', margin: '0 auto' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', gap: '1rem' }}>
                                <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>Live Session</div>
                                <div style={{ color: '#10b981', fontWeight: 700, fontSize: '0.8rem', background: '#ecfdf5', padding: '0.25rem 0.6rem', borderRadius: '0.5rem' }}>Active • 02:45</div>
                            </div>
                            <div className="otp-box" style={{ margin: '1rem 0', fontSize: isTiny ? '1.5rem' : '2rem', letterSpacing: isTiny ? '0.15rem' : '0.3rem', padding: '1rem' }}>482 910</div>
                            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                                <div style={{ background: '#f8fafc', padding: '0.8rem', borderRadius: '0.75rem', flex: 1, border: '1px solid #e2e8f0' }}>
                                    <div style={{ fontSize: '0.6rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>PRESENT</div>
                                    <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#1e3a8a' }}>42 / 60</div>
                                </div>
                                <div style={{ background: '#f8fafc', padding: '0.8rem', borderRadius: '0.75rem', flex: 1, border: '1px solid #e2e8f0' }}>
                                    <div style={{ fontSize: '0.6rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>DIST(AVG)</div>
                                    <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#1e3a8a' }}>4.2 m</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Security Explanation */}
            <section className="container" style={{ marginTop: isMobile ? '3rem' : '6rem' }}>
                <div style={{ border: '1px solid #e2e8f0', background: '#f8fafc', padding: isMobile ? '2.5rem 1.5rem' : '4rem', borderRadius: '2rem', textAlign: 'center' }}>
                    <div className="bg-blue" style={{ width: '3.5rem', height: '3.5rem', borderRadius: '50%', margin: '0 auto 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1e3a8a' }}>
                        <Lock size={26} />
                    </div>
                    <h2 style={{ fontSize: isTiny ? '1.5rem' : '2.2rem', fontWeight: 900, marginBottom: '1.25rem', color: '#0f172a' }}>Multi-Layer Security</h2>
                    <p style={{ color: '#475569', fontSize: isTiny ? '0.9rem' : '1.1rem', maxWidth: '850px', margin: '0 auto', lineHeight: '1.8', fontWeight: 500 }}>
                        GeoAttend combines device binding with high-precision geo-fencing (<strong>10-meter radius</strong>), dynamic sequence-based verification, and role-based filtering to create an environment where proxy attendance is technically impossible.
                    </p>
                </div>
            </section>

            {/* Footer */}
            <footer className="container" style={{ marginTop: isMobile ? '5rem' : '8rem', paddingBottom: '3rem', borderTop: '1px solid rgba(0,0,0,0.05)', textAlign: 'center' }}>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                    <div className="bg-blue" style={{ width: '2rem', height: '2rem', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>📍</div>
                    <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e3a8a' }}>GeoAttend</span>
                </div>
                <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Built for professional college environments and secure attendance tracking.</p>
                <div style={{ marginTop: '2.5rem', color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.05em' }}>
                    © 2026 Smart Attendance System by Antigravity AI
                </div>
            </footer>
        </div>
    );
};

export default HomePage;
