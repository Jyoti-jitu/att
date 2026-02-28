import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
    Users, Clock, Calendar,
    Search, FileText,
    CheckCircle2, ArrowLeft, Loader2, User, Mail
} from 'lucide-react';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { GITA_LOGO } from '../utils/logoBase64';

import { API } from '../lib/api';

const SessionHistory = () => {
    const { logout } = useAuth();
    const navigate = useNavigate();

    // Data
    const [sessions, setSessions] = useState([]);
    const [filteredRecords, setFilteredRecords] = useState([]);
    const [selectedSession, setSelectedSession] = useState(null);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [dateFilter, setDateFilter] = useState(''); // Empty means all dates

    const [windowWidth, setWindowWidth] = useState(window.innerWidth);
    useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    const isMobile = windowWidth <= 768;

    const filteredSessions = sessions.filter(s => {
        if (!dateFilter) return true;
        // Fix: Use local date extraction so timezone differences don't break the filter
        const d = new Date(s.start_time);
        const sessionDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return sessionDate === dateFilter;
    });

    // Auto-select first session when filter results change
    useEffect(() => {
        if (filteredSessions.length > 0) {
            // If current selected is NOT in the filtered list, select the first one
            const isStillVisible = selectedSession && filteredSessions.some(s => s.id === selectedSession.id);
            if (!isStillVisible) {
                handleSessionSelect(filteredSessions[0]);
            }
        } else if (!loading) {
            setSelectedSession(null);
            setFilteredRecords([]);
        }
    }, [dateFilter, sessions]);

    const fetchHistory = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API}/api/sessions/detailed-history`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const data = await res.json();

            if (res.ok) {
                const fetchedSessions = data.sessions || [];
                setSessions(fetchedSessions);

                // Auto-select logic for the whole list (only on first load)
                if (fetchedSessions.length > 0 && !selectedSession) {
                    handleSessionSelect(fetchedSessions[0]);
                }
            } else {
                toast.error(data.error || 'Failed to fetch history');
            }
        } catch (e) {
            console.error(e);
            toast.error('Server error. Please try again.');
        } finally {
            setLoading(false);
        }
    }, [selectedSession]);

    useEffect(() => {
        fetchHistory();
    }, [fetchHistory]);

    const handleSessionSelect = (session) => {
        setSelectedSession(session);
        setFilteredRecords(session.records || []);
        setSearchTerm(''); // Reset search when changing sessions
    };

    const handleSearch = (e) => {
        const term = e.target.value.toLowerCase();
        setSearchTerm(term);
        if (selectedSession) {
            const filtered = selectedSession.records.filter(r =>
                (r.students?.name || '').toLowerCase().includes(term) ||
                (r.students?.roll_no || '').toLowerCase().includes(term)
            );
            setFilteredRecords(filtered);
        }
    };

    const downloadPDF = async () => {
        try {
            if (!selectedSession || filteredRecords.length === 0) {
                toast.error("No records to export!");
                return;
            }

            toast.loading("Generating PDF...", { id: 'pdf-toast' });

            const doc = new jsPDF();
            let logoAdded = false;

            try {
                // Add the embedded base64 image to the PDF (x, y, width, height)
                doc.addImage(GITA_LOGO, 'PNG', 14, 10, 25, 25);
                logoAdded = true;
            } catch (e) {
                console.warn('Could not inject base64 logo.', e);
            }

            // Adjust text format based on whether the logo is present or not
            const textStartX = logoAdded ? 45 : 14;

            doc.setFontSize(18);
            doc.text(`Attendance Report: ${selectedSession.subject}`, textStartX, 18);
            doc.setFontSize(11);
            doc.text(`Date: ${new Date(selectedSession.start_time).toLocaleDateString()} | Branch: ${selectedSession.branch}-${selectedSession.section}`, textStartX, 26);

            const tableColumn = ["#", "Student Name", "Roll Number", "Status", "Time"];
            const tableRows = filteredRecords.map((r, i) => [
                i + 1,
                r.students?.name || 'Unknown',
                r.students?.roll_no || 'N/A',
                "PRESENT",
                new Date(r.timestamp || new Date()).toLocaleTimeString()
            ]);

            autoTable(doc, {
                head: [tableColumn],
                body: tableRows,
                startY: logoAdded ? 40 : 35,
                theme: 'striped'
            });

            doc.save(`Attendance_${selectedSession.subject}.pdf`);
            toast.success("PDF Downloaded successfully!", { id: 'pdf-toast' });

        } catch (err) {
            console.error("PDF Export Error:", err);
            toast.error("Failed to generate PDF: " + err.message, { id: 'pdf-toast' });
        }
    };

    const sendEmailReport = async (recipientRole, recipientEmail) => {
        try {
            if (!selectedSession || filteredRecords.length === 0) {
                toast.error("No records to export!");
                return;
            }

            toast.loading(`Automating PDF Attachment for ${recipientRole}...`, { id: 'email-toast' });

            const doc = new jsPDF();
            let logoAdded = false;

            try {
                doc.addImage(GITA_LOGO, 'PNG', 14, 10, 25, 25);
                logoAdded = true;
            } catch (e) {
                console.warn('Could not inject base64 logo.', e);
            }

            const textStartX = logoAdded ? 45 : 14;

            doc.setFontSize(18);
            doc.text(`Attendance Report: ${selectedSession.subject}`, textStartX, 18);
            doc.setFontSize(11);
            doc.text(`Date: ${new Date(selectedSession.start_time).toLocaleDateString()} | Branch: ${selectedSession.branch}-${selectedSession.section}`, textStartX, 26);

            const tableColumn = ["#", "Student Name", "Roll Number", "Status", "Time"];
            const tableRows = filteredRecords.map((r, i) => [
                i + 1,
                r.students?.name || 'Unknown',
                r.students?.roll_no || 'N/A',
                "PRESENT",
                new Date(r.timestamp || new Date()).toLocaleTimeString()
            ]);

            autoTable(doc, {
                head: [tableColumn],
                body: tableRows,
                startY: logoAdded ? 40 : 35,
                theme: 'striped'
            });

            // 1. Get raw PDF as base64 (this is needed for the attachment)
            const pdfBase64 = doc.output('datauristring');
            const filename = `Attendance_${selectedSession.subject}.pdf`;

            // 2. Call the server to send the mail with ATTACHMENT
            const res = await fetch(`${API}/api/reports/send-email`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: recipientEmail,
                    subject: `Attendance Report: ${selectedSession.subject} (${selectedSession.branch}-${selectedSession.section})`,
                    body: `
                        <h2>Daily Attendance Report</h2>
                        <p>Dear ${recipientRole},</p>
                        <p>Please find attached the latest attendance report generated from GeoAttend.</p>
                        <ul>
                            <li><b>Subject:</b> ${selectedSession.subject}</li>
                            <li><b>Branch:</b> ${selectedSession.branch} - Section ${selectedSession.section}</li>
                            <li><b>Date:</b> ${new Date(selectedSession.start_time).toLocaleDateString()}</li>
                            <li><b>Total Present:</b> ${filteredRecords.length} Students</li>
                        </ul>
                        <p>Best Regards,<br/>GeoAttend System</p>
                    `,
                    pdfBase64,
                    filename
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to send email');

            toast.success(`Sent to ${recipientRole} with PDF Attached!`, { id: 'email-toast' });

        } catch (err) {
            console.error("Automated Email Error:", err);
            toast.error("Failed to attach & send: " + err.message, { id: 'email-toast' });
        }
    };

    return (
        <div style={{ minHeight: '100vh', background: '#f8faff', fontFamily: "'Inter', sans-serif" }}>
            {/* Minimal Navbar */}
            <nav style={{ background: 'white', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 100 }}>
                <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '64px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <button onClick={() => navigate('/teacher/dashboard')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <ArrowLeft size={20} />
                        </button>
                        <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>Attendance Record</h1>
                    </div>
                    <button onClick={logout} style={{ color: '#ef4444', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem' }}>Logout</button>
                </div>
            </nav>

            <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1.5rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '320px 1fr', gap: '2rem' }}>

                    {/* LEFT: SESSION LIST & FILTER */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ background: 'white', padding: '1.25rem', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                            <label style={{ display: 'block', fontWeight: 800, color: '#64748b', fontSize: '0.7rem', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Filter by Date</label>
                            <input
                                type="date"
                                value={dateFilter}
                                onChange={(e) => setDateFilter(e.target.value)}
                                style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none', background: '#f8fafc' }}
                            />
                            {dateFilter && (
                                <button
                                    onClick={() => setDateFilter('')}
                                    style={{ marginTop: '0.5rem', width: '100%', padding: '0.4rem', background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                                >
                                    Clear Filter
                                </button>
                            )}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0.5rem 0' }}>
                            <span style={{ fontWeight: 800, color: '#64748b', fontSize: '0.85rem', textTransform: 'uppercase' }}>
                                {dateFilter ? 'Filtered Sessions' : 'Available Sessions'}
                            </span>
                            {loading && <Loader2 className="animate-spin" size={16} color="#4f46e5" />}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', maxHeight: '70vh', overflowY: 'auto' }}>
                            {filteredSessions.map(s => (
                                <div
                                    key={s.id}
                                    onClick={() => handleSessionSelect(s)}
                                    style={{
                                        background: selectedSession?.id === s.id ? '#4f46e5' : 'white',
                                        color: selectedSession?.id === s.id ? 'white' : '#1e293b',
                                        borderRadius: '16px', padding: '1.25rem', cursor: 'pointer',
                                        boxShadow: selectedSession?.id === s.id ? '0 10px 20px rgba(79, 70, 229, 0.15)' : '0 2px 8px rgba(0,0,0,0.02)',
                                        border: '1px solid #e2e8f0', transition: 'all 0.2s',
                                        position: 'relative'
                                    }}
                                >
                                    <div style={{ fontWeight: 800, fontSize: '1rem', marginBottom: '0.4rem' }}>{s.subject}</div>
                                    <div style={{ fontSize: '0.8rem', opacity: 0.8, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                        <Calendar size={12} /> {new Date(s.start_time).toLocaleDateString()}
                                    </div>
                                    <div style={{ fontSize: '0.8rem', opacity: 0.8, display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.2rem' }}>
                                        <Users size={12} /> {s.branch}-{s.section}
                                    </div>
                                    {selectedSession?.id === s.id && (
                                        <div style={{ position: 'absolute', right: '1.25rem', top: '50%', transform: 'translateY(-50%)' }}>
                                            <CheckCircle2 size={20} />
                                        </div>
                                    )}
                                </div>
                            ))}
                            {filteredSessions.length === 0 && !loading && (
                                <div style={{ textAlign: 'center', padding: '3rem 2rem', color: '#94a3b8', background: 'white', borderRadius: '16px', border: '1px dashed #cbd5e1' }}>
                                    <Calendar size={32} style={{ opacity: 0.2, marginBottom: '1rem', margin: '0 auto' }} />
                                    <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>No sessions found for this {dateFilter ? 'date' : 'criteria'}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* RIGHT: STUDENT LIST */}
                    {selectedSession ? (
                        <div style={{ background: 'white', borderRadius: '24px', border: '1px solid #e2e8f0', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
                            <div style={{ padding: '2rem', borderBottom: '1px solid #f1f5f9' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
                                    <div>
                                        <div style={{ fontSize: '0.8rem', color: '#4f46e5', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.25rem' }}>Active View</div>
                                        <h2 style={{ fontSize: '1.75rem', fontWeight: 900, color: '#1e293b', margin: 0 }}>{selectedSession.subject}</h2>
                                        <p style={{ color: '#64748b', fontSize: '0.95rem', marginTop: '0.5rem' }}>
                                            {selectedSession.branch} Section {selectedSession.section} • {new Date(selectedSession.start_time).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#4f46e5', lineHeight: 1 }}>{filteredRecords.length}</div>
                                        <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>Students Present</div>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                    <div style={{ position: 'relative', flex: 1 }}>
                                        <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} size={16} />
                                        <input
                                            type="text"
                                            placeholder="Search by student name or roll number..."
                                            value={searchTerm}
                                            onChange={handleSearch}
                                            style={{ width: '100%', padding: '0.85rem 1rem 0.85rem 2.5rem', borderRadius: '12px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '0.9rem', background: '#f8fafc' }}
                                        />
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                        <button onClick={() => sendEmailReport('HOD', 'jyotiranjansahoo485@gmail.com')} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.85rem 1rem', borderRadius: '12px', background: '#e0e7ff', color: '#4338ca', border: 'none', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                            <Mail size={18} /> Send HOD
                                        </button>
                                        <button onClick={() => sendEmailReport('Principal', 'jyotiranjansahoo485@gmail.com')} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.85rem 1rem', borderRadius: '12px', background: '#e0e7ff', color: '#4338ca', border: 'none', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                            <Mail size={18} /> Send Principal
                                        </button>
                                        <button onClick={downloadPDF} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.85rem 1.5rem', borderRadius: '12px', background: '#4f46e5', color: 'white', border: 'none', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                            <FileText size={18} /> Export PDF
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div style={{ flex: 1, overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                    <thead>
                                        <tr style={{ background: '#f8fafc' }}>
                                            <th style={{ padding: '1rem 2rem', color: '#64748b', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase' }}>S.No</th>
                                            <th style={{ padding: '1rem 2rem', color: '#64748b', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase' }}>Present Student Name</th>
                                            <th style={{ padding: '1rem 2rem', color: '#64748b', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase' }}>Roll Number</th>
                                            <th style={{ padding: '1rem 2rem', color: '#64748b', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase' }}>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredRecords.map((r, i) => (
                                            <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                <td style={{ padding: '1rem 2rem', color: '#94a3b8', fontSize: '0.9rem' }}>{i + 1}</td>
                                                <td style={{ padding: '1rem 2rem' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4f46e5' }}>
                                                            <User size={16} />
                                                        </div>
                                                        <span style={{ fontWeight: 700, color: '#1e293b' }}>{r.students?.name || 'Unknown Student'}</span>
                                                    </div>
                                                </td>
                                                <td style={{ padding: '1rem 2rem', color: '#4f46e5', fontWeight: 700, fontFamily: 'monospace' }}>{r.students?.roll_no || 'N/A'}</td>
                                                <td style={{ padding: '1rem 2rem' }}>
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.25rem 0.75rem', borderRadius: '20px', background: '#ecfdf5', color: '#10b981', fontSize: '0.75rem', fontWeight: 900 }}>
                                                        <CheckCircle2 size={12} /> PRESENT
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                        {filteredRecords.length === 0 && (
                                            <tr>
                                                <td colSpan="4" style={{ padding: '4rem', textAlign: 'center', color: '#94a3b8' }}>
                                                    <Users size={40} style={{ marginBottom: '1rem', opacity: 0.2, margin: '0 auto' }} />
                                                    <p style={{ fontWeight: 600 }}>No students marked present for this session yet.</p>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        <div style={{ background: 'white', borderRadius: '24px', border: '1px solid #e2e8f0', padding: '4rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem', color: '#cbd5e1' }}>
                                <Clock size={40} />
                            </div>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e293b', marginBottom: '0.5rem' }}>Please select a session</h3>
                            <p style={{ color: '#64748b', maxWidth: '300px' }}>Choose a class session from the left to view the list of present students.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SessionHistory;
