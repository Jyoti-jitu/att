import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { MapPin, Users, Mail, Eye, EyeOff, AlertCircle, ArrowLeft, GraduationCap, Lock } from 'lucide-react'
import toast from 'react-hot-toast'

import { API } from '../lib/api';

const DEMO_ACCOUNTS = [
    { name: 'Arjun Sharma', email: 'arjun@student.edu', password: 'student123' },
    { name: 'Priya Patel', email: 'priya@student.edu', password: 'student123' },
    { name: 'Rohan Verma', email: 'rohan@student.edu', password: 'student123' },
]

export default function StudentLogin() {
    const navigate = useNavigate()
    const { login } = useAuth()
    const [email, setEmail] = useState('arjun@student.edu')
    const [password, setPassword] = useState('student123')
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e, force = false) => {
        if (e) e.preventDefault()
        setLoading(true)
        try {
            const res = await fetch(`${API}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, role: 'student', forceLogin: force })
            });

            const data = await res.json();

            if (res.status === 409) {
                toast((t) => (
                    <div className="text-white">
                        <p className="font-bold mb-1 text-sm">Active Session Found</p>
                        <p className="text-xs mb-3 opacity-80">Another device is logged in. Terminate and sign in here?</p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => { toast.dismiss(t.id); handleSubmit(null, true); }}
                                className="bg-white text-primary-900 px-3 py-1 rounded text-xs font-bold"
                            >
                                Yes
                            </button>
                            <button
                                onClick={() => toast.dismiss(t.id)}
                                className="bg-white/20 text-white px-3 py-1 rounded text-xs"
                            >
                                No
                            </button>
                        </div>
                    </div>
                ), { duration: 6000, style: { background: '#1e3a8a', padding: '16px' } });
                return;
            }

            if (res.ok) {
                toast.success('Signed in successfully!');
                login(data.user, data.token);
                navigate('/student/dashboard');
            } else {
                toast.error(data.error || 'Invalid credentials');
            }
        } catch (err) {
            toast.error('Connection failure. Check server status.');
        } finally {
            setLoading(false)
        }
    }

    const quickFill = (acc) => {
        setEmail(acc.email)
        setPassword(acc.password)
    }

    return (
        <div className="min-h-screen flex items-center justify-center px-4 page-enter">
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-accent-600/20 rounded-full blur-3xl" />
                <div className="absolute bottom-1/3 left-1/4 w-80 h-80 bg-primary-700/15 rounded-full blur-3xl" />
            </div>

            <div className="w-full max-w-md relative z-10">
                <button id="student-back-btn" onClick={() => navigate('/')}
                    className="flex items-center gap-2 text-white/50 hover:text-white mb-8 transition-colors text-sm">
                    <ArrowLeft size={16} /> Back to Home
                </button>

                <div className="glass-card p-8">
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent-500 to-primary-600 
                            flex items-center justify-center mx-auto mb-4 shadow-glow">
                            <GraduationCap size={30} className="text-white" />
                        </div>
                        <h1 className="font-display text-2xl font-bold text-white mb-1">Student Portal</h1>
                        <p className="text-white/50 text-sm">Access your attendance records</p>
                    </div>

                    {/* Quick fill */}
                    <div className="mb-6">
                        <p className="text-xs text-white/40 mb-2">Quick demo accounts:</p>
                        <div className="flex flex-wrap gap-2">
                            {DEMO_ACCOUNTS.map(acc => (
                                <button
                                    key={acc.email}
                                    id={`quick-fill-${acc.name.split(' ')[0].toLowerCase()}`}
                                    onClick={() => quickFill(acc)}
                                    className="text-xs bg-white/10 hover:bg-white/20 border border-white/15 rounded-lg px-3 py-1.5 text-white/70 hover:text-white transition-all">
                                    {acc.name.split(' ')[0]}
                                </button>
                            ))}
                        </div>
                    </div>



                    <form id="student-login-form" onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="text-sm font-medium text-white/70 block mb-2">
                                <Mail size={14} className="inline mr-1.5" />Student Email
                            </label>
                            <input
                                id="student-email-input"
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                className="input-field"
                                placeholder="you@student.edu"
                                required
                            />
                        </div>

                        <div>
                            <label className="text-sm font-medium text-white/70 block mb-2">
                                Password
                            </label>
                            <div className="relative">
                                <input
                                    id="student-password-input"
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    className="input-field pr-11"
                                    placeholder="••••••••"
                                    required
                                />
                                <button
                                    type="button"
                                    id="student-toggle-password"
                                    onClick={() => setShowPassword(v => !v)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors">
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        <button
                            id="student-login-submit"
                            type="submit"
                            disabled={loading}
                            className="btn-primary w-full flex items-center justify-center gap-2">
                            {loading ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Signing In…
                                </>
                            ) : (
                                <>
                                    <Users size={16} /> Sign In as Student
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-6 pt-5 border-t border-white/10 text-center">
                        <span className="text-white/40 text-sm">Are you faculty? </span>
                        <button id="switch-to-admin" onClick={() => navigate('/admin/login')}
                            className="text-primary-400 hover:text-primary-300 text-sm font-medium transition-colors">
                            Admin Login →
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
