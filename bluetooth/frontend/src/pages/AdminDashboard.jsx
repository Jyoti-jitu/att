import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
    MapPin, Users, CheckCircle, XCircle, LogOut,
    Activity, Monitor, LayoutDashboard, Plus, BookOpen,
    Radio, Clock
} from 'lucide-react'
import { getSessions, getAttendanceRecords } from '../lib/supabase'
import toast from 'react-hot-toast'

import { API } from '../lib/api';

function ScanPulse() {
    return (
        <div className="relative w-8 h-8 flex items-center justify-center">
            <div className="absolute w-full h-full rounded-full bg-primary-500/30 animate-ping" />
            <div className="w-4 h-4 rounded-full bg-primary-500 flex items-center justify-center">
                <Radio size={10} className="text-white animate-pulse" />
            </div>
        </div>
    )
}

export default function AdminDashboard() {
    const navigate = useNavigate()
    const { user, logout } = useAuth()
    const [sessions, setSessions] = useState([])
    const [activeSession, setActiveSession] = useState(null)
    const [recentRecords, setRecentRecords] = useState([])
    const [loading, setLoading] = useState(true)
    const [adminStats, setAdminStats] = useState({
        totalStudents: 0,
        studentsPresent: 0,
        studentsAbsent: 0,
        blockedAttempts: 0,
        logs: []
    })

    useEffect(() => {
        if (!user || user.role !== 'admin') navigate('/admin/login')
        else loadData()
    }, [user])

    async function loadData() {
        setLoading(true)
        try {
            const all = await getSessions()
            setSessions(all)
            const active = all.find(s => s.is_active)
            setActiveSession(active || null)
            if (active) {
                const recs = await getAttendanceRecords(active.id)
                setRecentRecords(recs.slice(0, 8))
            }
            // Fetch backend stats
            const statsRes = await fetch(`${API}/api/admin/stats`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            })
            if (statsRes.ok) {
                const statsData = await statsRes.json()
                setAdminStats(statsData)
            }
        } catch (err) {
            console.error('Data load error:', err)
            toast.error('Failed to load dashboard data')
        }
        finally { setLoading(false) }
    }

    if (!user) return null

    const totalSessions = sessions.length
    const completedSessions = sessions.filter(s => !s.is_active).length

    return (
        <div className="min-h-screen flex page-enter">
            {/* ── SIDEBAR ── */}
            <div className="w-64 flex-shrink-0 bg-primary-950/80 border-r border-white/10
                      flex flex-col p-4 fixed h-full overflow-y-auto z-40">
                <div className="flex items-center gap-3 mb-8 px-2 py-3">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary-600 to-accent-500 flex items-center justify-center shadow-glow">
                        <MapPin size={16} className="text-white" />
                    </div>
                    <div>
                        <div className="font-display font-bold text-white text-sm">SmartAttend</div>
                        <div className="text-white/40 text-xs">Admin Panel</div>
                    </div>
                </div>

                <nav className="flex flex-col gap-1 flex-1">
                    <button id="sidebar-dashboard" className="sidebar-link active">
                        <LayoutDashboard size={18} /> Dashboard
                    </button>
                    <button id="sidebar-session" onClick={() => navigate('/admin/session')}
                        className="sidebar-link">
                        <Plus size={18} /> New Session
                    </button>
                    <button id="sidebar-monitor" onClick={() => navigate('/monitor')}
                        className="sidebar-link">
                        <Monitor size={18} /> Live Monitor
                    </button>

                    {activeSession && (
                        <div className="mt-4 p-3 bg-success-500/10 border border-success-500/20 rounded-xl">
                            <div className="flex items-center gap-2 mb-1">
                                <ScanPulse />
                                <span className="text-success-400 text-xs font-semibold">Session Active</span>
                            </div>
                            <p className="text-white text-xs font-medium">{activeSession.subject}</p>
                            <p className="text-white/40 text-xs">{activeSession.room}</p>
                            <button id="goto-active-session" onClick={() => navigate('/admin/session')}
                                className="mt-2 text-xs text-primary-400 hover:text-primary-300 underline transition-colors">
                                Manage →
                            </button>
                        </div>
                    )}
                </nav>

                <div className="border-t border-white/10 pt-4 mt-4">
                    <div className="flex items-center gap-3 mb-3 px-2">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-700 to-accent-600 flex items-center justify-center">
                            <span className="text-white font-bold text-sm">{user.name?.[0]}</span>
                        </div>
                        <div>
                            <div className="text-white text-sm font-semibold truncate w-36">{user.name}</div>
                            <div className="text-white/40 text-xs">{user.department}</div>
                        </div>
                    </div>
                    <button id="admin-logout-btn" onClick={() => { logout(); navigate('/') }}
                        className="flex items-center gap-2 text-white/50 hover:text-danger-400 text-sm px-4 py-2 w-full rounded-lg hover:bg-danger-500/10 transition-all">
                        <LogOut size={16} /> Logout
                    </button>
                </div>
            </div>

            {/* ── MAIN ── */}
            <div className="flex-1 ml-64 p-6 overflow-y-auto min-h-screen">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="font-display text-2xl font-bold text-white">Admin Dashboard</h1>
                        <p className="text-white/40 text-sm mt-0.5">
                            {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </p>
                    </div>
                    <button id="new-session-cta" onClick={() => navigate('/admin/session')}
                        className="btn-primary flex items-center gap-2">
                        <Plus size={16} /> New Session
                    </button>
                </div>

                {/* stat cards */}
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                    {[
                        { label: 'Total Students', value: adminStats.totalStudents, icon: Users, color: 'from-blue-600 to-cyan-500' },
                        { label: 'Present Today', value: adminStats.studentsPresent, icon: CheckCircle, color: 'from-emerald-600 to-green-500' },
                        { label: 'Absent Today', value: adminStats.studentsAbsent, icon: Radio, color: 'from-slate-600 to-slate-500' },
                        { label: 'Active Session', value: activeSession ? 1 : 0, icon: Activity, color: activeSession ? 'from-green-600 to-emerald-500' : 'from-slate-600 to-slate-500' }
                    ].map(card => {
                        const Icon = card.icon
                        return (
                            <div key={card.label} className="stat-card">
                                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center shadow-lg`}>
                                    <Icon size={18} className="text-white" />
                                </div>
                                <div>
                                    <div className="font-display text-2xl font-bold text-white">{card.value}</div>
                                    <div className="text-xs text-white/60">{card.label}</div>
                                </div>
                            </div>
                        )
                    })}
                </div>

                {/* active session banner */}
                {activeSession ? (
                    <div className="glass-card p-6 mb-6 border border-success-500/20">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <ScanPulse />
                                <div>
                                    <p className="font-semibold text-white">{activeSession.subject} — {activeSession.room}</p>
                                    <p className="text-sm text-white/50">{activeSession.class_year} · by {activeSession.teacher_name}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="badge-present flex items-center gap-1.5">
                                    <span className="w-2 h-2 bg-success-400 rounded-full animate-pulse" /> Session Active
                                </span>
                                <button id="manage-session-btn" onClick={() => navigate('/admin/session')}
                                    className="btn-primary text-sm px-4 py-2.5 flex items-center gap-2">
                                    <Activity size={14} /> Manage
                                </button>
                            </div>
                        </div>
                        {recentRecords.length > 0 && (
                            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {recentRecords.map(r => (
                                    <div key={r.id} className="bg-white/5 rounded-lg px-3 py-2 flex items-center gap-2">
                                        <div className="w-7 h-7 rounded-lg bg-primary-800 flex items-center justify-center text-xs font-bold text-primary-300">
                                            {r.student_name?.[0]}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-xs text-white truncate">{r.student_name?.split(' ')[0]}</p>
                                            <p className="text-xs text-white/40">{r.roll_number}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="glass-card p-10 mb-6 text-center border border-dashed border-white/15">
                        <Radio size={36} className="text-white/20 mx-auto mb-3" />
                        <p className="text-white/40 font-medium">No active session</p>
                        <p className="text-white/30 text-sm mb-5">Start a new attendance session to allow students to check in</p>
                        <button id="start-session-main" onClick={() => navigate('/admin/session')}
                            className="btn-primary inline-flex items-center gap-2">
                            <Plus size={16} /> Start New Session
                        </button>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* session history */}
                    <div className="glass-card overflow-hidden">
                        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
                            <h2 className="font-display font-semibold text-white flex items-center gap-2">
                                <Clock size={16} className="text-primary-400" /> Session History
                            </h2>
                            <button id="refresh-sessions-btn" onClick={loadData} className="text-white/40 hover:text-white text-xs transition-colors">
                                Refresh
                            </button>
                        </div>
                        {sessions.length === 0 ? (
                            <div className="p-10 text-center text-white/30">
                                <BookOpen size={30} className="mx-auto mb-3 opacity-30" />
                                <p>No sessions created yet.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-white/5 max-h-80 overflow-y-auto">
                                {sessions.map(s => (
                                    <div key={s.id} className="px-6 py-4 hover:bg-white/5 transition-colors flex items-center justify-between">
                                        <div>
                                            <p className="font-medium text-white">{s.subject}</p>
                                            <p className="text-sm text-white/50">{s.room} · {s.class_year} · {s.teacher_name}</p>
                                        </div>
                                        <div className="text-right">
                                            <span className={s.is_active ? 'badge-present' : 'text-white/30 text-xs'}>
                                                {s.is_active ? 'Active' : 'Ended'}
                                            </span>
                                            <p className="text-xs text-white/30 mt-1">{new Date(s.created_at).toLocaleString()}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    {/* Blocked Logs section removed */}
                </div>
            </div>
        </div>
    )
}
