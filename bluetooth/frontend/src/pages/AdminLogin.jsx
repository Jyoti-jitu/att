import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { MapPin, Lock, Mail, Eye, EyeOff, AlertCircle, ArrowLeft, Shield } from 'lucide-react'

export default function AdminLogin() {
    const navigate = useNavigate()
    const { login } = useAuth()
    const [email, setEmail] = useState('admin@college.edu')
    const [password, setPassword] = useState('admin123')
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const handleSubmit = async e => {
        e.preventDefault()
        setError('')
        setLoading(true)
        try {
            const result = await login(email, password, 'admin')
            if (result.success) navigate('/admin/dashboard')
            else setError(result.error)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center px-4 page-enter">
            {/* Background blobs */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-1/3 left-1/4 w-96 h-96 bg-primary-700/20 rounded-full blur-3xl" />
                <div className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-accent-600/15 rounded-full blur-3xl" />
            </div>

            <div className="w-full max-w-md relative z-10">
                {/* back button */}
                <button id="admin-back-btn" onClick={() => navigate('/')}
                    className="flex items-center gap-2 text-white/50 hover:text-white mb-8 transition-colors text-sm">
                    <ArrowLeft size={16} /> Back to Home
                </button>

                <div className="glass-card p-8">
                    {/* header */}
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-600 to-accent-500 
                            flex items-center justify-center mx-auto mb-4 shadow-glow">
                            <Shield size={30} className="text-white" />
                        </div>
                        <h1 className="font-display text-2xl font-bold text-white mb-1">Admin Login</h1>
                        <p className="text-white/50 text-sm">Secure access to admin dashboard</p>
                    </div>

                    {/* demo credentials hint */}
                    <div className="bg-primary-600/15 border border-primary-500/30 rounded-xl p-3 mb-6 text-xs text-primary-300">
                        <strong>Demo:</strong> admin@college.edu / admin123
                    </div>

                    {error && (
                        <div className="flex items-center gap-2 bg-danger-500/15 border border-danger-500/30 
                            rounded-xl p-3 mb-5 text-danger-400 text-sm">
                            <AlertCircle size={16} /> {error}
                        </div>
                    )}

                    <form id="admin-login-form" onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="text-sm font-medium text-white/70 block mb-2">
                                <Mail size={14} className="inline mr-1.5" />Email Address
                            </label>
                            <input
                                id="admin-email-input"
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                className="input-field"
                                placeholder="admin@college.edu"
                                required
                            />
                        </div>

                        <div>
                            <label className="text-sm font-medium text-white/70 block mb-2">
                                <Lock size={14} className="inline mr-1.5" />Password
                            </label>
                            <div className="relative">
                                <input
                                    id="admin-password-input"
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    className="input-field pr-11"
                                    placeholder="••••••••"
                                    required
                                />
                                <button
                                    type="button"
                                    id="admin-toggle-password"
                                    onClick={() => setShowPassword(v => !v)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors">
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        <button
                            id="admin-login-submit"
                            type="submit"
                            disabled={loading}
                            className="btn-primary w-full flex items-center justify-center gap-2 mt-2">
                            {loading ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Authenticating…
                                </>
                            ) : (
                                <>
                                    <Lock size={16} /> Sign In as Admin
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-6 pt-5 border-t border-white/10 text-center">
                        <span className="text-white/40 text-sm">Not an admin? </span>
                        <button id="switch-to-student" onClick={() => navigate('/student/login')}
                            className="text-primary-400 hover:text-primary-300 text-sm font-medium transition-colors">
                            Student Login →
                        </button>
                    </div>
                </div>

                <div className="flex items-center justify-center gap-2 mt-6 text-white/30 text-xs">
                    <Lock size={12} /> <span>256-bit SSL encrypted · JWT secured</span>
                </div>
            </div>
        </div>
    )
}
