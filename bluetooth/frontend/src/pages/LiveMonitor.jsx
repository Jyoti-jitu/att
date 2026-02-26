import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLocation } from '../context/LocationContext'
import {
    MapPin, ArrowLeft, RefreshCw, Radio, Users, CheckCircle, XCircle, Clock
} from 'lucide-react'

function RSSIBar({ rssi }) {
    const pct = Math.max(0, Math.min(100, ((rssi + 95) / 60) * 100))
    const color = rssi >= -65 ? 'bg-success-400' : rssi >= -78 ? 'bg-warning-400' : 'bg-danger-400'
    return (
        <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs text-white/40 w-8 text-right">{pct.toFixed(0)}%</span>
        </div>
    )
}

export default function LiveMonitor() {
    const navigate = useNavigate()
    const { scanning, studentData, scanCount, stats, startScan, stopScan } = useLocation()

    useEffect(() => {
        startScan()
        return () => stopScan()
    }, [])

    const presentPct = stats.total ? Math.round((stats.present / stats.total) * 100) : 0

    return (
        <div className="min-h-screen page-enter">
            {/* ── TOP BAR ── */}
            <header className="fixed top-0 left-0 right-0 z-50 bg-primary-950/90 backdrop-blur-md border-b border-white/10">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button id="monitor-back-btn" onClick={() => navigate(-1)}
                            className="flex items-center gap-2 text-white/50 hover:text-white text-sm transition-colors">
                            <ArrowLeft size={16} /> Back
                        </button>
                        <div className="w-px h-5 bg-white/20" />
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary-600 to-accent-500 flex items-center justify-center">
                                <MapPin size={15} className="text-white" />
                            </div>
                            <div>
                                <span className="font-display font-bold text-white text-sm">Live Classroom Monitor</span>
                                <p className="text-white/40 text-xs">Room 204 — B.Tech CSE 3rd Year</p>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {scanning && (
                            <div className="flex items-center gap-2 text-success-400 text-sm">
                                <RefreshCw size={14} className="animate-spin" />
                                <span className="font-medium">Scanning… scan #{scanCount}</span>
                            </div>
                        )}
                        <button
                            id="monitor-toggle-scan"
                            onClick={() => scanning ? stopScan() : startScan()}
                            className={`flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl transition-all ${scanning
                                    ? 'bg-danger-500/20 border border-danger-500/30 text-danger-400 hover:bg-danger-500/30'
                                    : 'btn-primary'
                                }`}>
                            <Radio size={14} className={scanning ? 'animate-pulse' : ''} />
                            {scanning ? 'Stop Scan' : 'Start Scan'}
                        </button>
                    </div>
                </div>
            </header>

            <div className="pt-24 pb-10 px-6 max-w-7xl mx-auto">
                {/* ── SUMMARY STATS ── */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    {[
                        { label: 'Total', value: stats.total, color: 'from-blue-600 to-cyan-500', icon: Users },
                        { label: 'Present', value: stats.present, color: 'from-emerald-600 to-green-500', icon: CheckCircle },
                        { label: 'Absent', value: stats.absent, color: 'from-red-600 to-red-500', icon: XCircle },
                        { label: 'Rate', value: `${presentPct}%`, color: 'from-purple-600 to-violet-500', icon: Clock },
                    ].map(card => {
                        const Icon = card.icon
                        return (
                            <div key={card.label} className="glass-card p-5 flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center shadow-lg flex-shrink-0`}>
                                    <Icon size={18} className="text-white" />
                                </div>
                                <div>
                                    <div className="font-display text-2xl font-bold text-white">{card.value}</div>
                                    <div className="text-xs text-white/50">{card.label}</div>
                                </div>
                            </div>
                        )
                    })}
                </div>

                {/* ── MONITOR TABLE ── */}
                <div className="glass-card overflow-hidden">
                    <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
                        <h2 className="font-display font-semibold text-white flex items-center gap-2">
                            <Radio size={16} className={`text-primary-400 ${scanning ? 'animate-pulse' : ''}`} />
                            Real-Time Location Scan
                        </h2>
                        <div className="flex items-center gap-2 text-xs text-white/40">
                            <Clock size={12} />
                            Updated: {new Date().toLocaleTimeString()}
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-white/5 sticky top-0">
                                <tr>
                                    {['#', 'Student Name', 'Roll No.', 'RSSI (dBm)', 'Signal Level', 'Distance', 'Status', 'Last Seen'].map(h => (
                                        <th key={h} className="table-header whitespace-nowrap">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {studentData.map((s, idx) => (
                                    <tr key={s.id} className="hover:bg-white/5 transition-colors group">
                                        <td className="table-cell text-white/30 text-xs font-mono">{String(idx + 1).padStart(2, '0')}</td>
                                        <td className="table-cell">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-800 to-primary-700 
                                        flex items-center justify-center text-xs font-bold text-primary-300
                                        group-hover:scale-110 transition-transform">
                                                    {s.name[0]}
                                                </div>
                                                <span className="font-medium text-white">{s.name}</span>
                                            </div>
                                        </td>
                                        <td className="table-cell text-white/50 font-mono text-xs">{s.rollNumber}</td>
                                        <td className="table-cell">
                                            <div>
                                                <span className={`font-bold text-sm ${s.rssiClass}`}>{s.rssi} dBm</span>
                                                <RSSIBar rssi={s.rssi} />
                                            </div>
                                        </td>
                                        <td className="table-cell">
                                            <span className={`text-sm ${s.rssiClass}`}>{s.rssiLabel}</span>
                                        </td>
                                        <td className="table-cell">
                                            <span className="text-accent-400 font-semibold">{s.distance}</span>
                                        </td>
                                        <td className="table-cell">
                                            <div className="flex items-center gap-2">
                                                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${s.status === 'Present' ? 'bg-success-400 animate-pulse' :
                                                        s.status === 'Absent' ? 'bg-danger-400' : 'bg-warning-400 animate-pulse'
                                                    }`} />
                                                <span className={
                                                    s.status === 'Present' ? 'badge-present' :
                                                        s.status === 'Absent' ? 'badge-absent' : 'badge-scanning'
                                                }>{s.status}</span>
                                            </div>
                                        </td>
                                        <td className="table-cell text-white/40 text-xs font-mono">{s.lastSeen}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* footer legend */}
                    <div className="px-6 py-4 border-t border-white/10 flex flex-wrap items-center gap-6 text-xs text-white/50">
                        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-success-400" /> Present: RSSI &gt; -70 dBm</div>
                        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-warning-400" /> Borderline: -70 to -85 dBm</div>
                        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-danger-400" />  Absent: RSSI &lt; -85 dBm</div>
                        <div className="ml-auto flex items-center gap-1.5">
                            <MapPin size={12} className="text-primary-400" />
                            Scan interval: 2s · Free-space path-loss model
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
