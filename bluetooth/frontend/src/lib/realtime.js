import { supabase } from './supabase'

/**
 * Subscribe to real-time attendance insertions for a session.
 * Returns an unsubscribe function — call it on component unmount.
 *
 * Usage:
 *   const unsub = subscribeToAttendance(sessionId, (newRecord) => {
 *     setRecords(prev => [newRecord, ...prev])
 *   })
 *   return () => unsub()
 */
export function subscribeToAttendance(sessionId, onInsert) {
    if (!supabase) {
        // Local mode: no realtime, caller must poll
        return () => { }
    }

    const channel = supabase
        .channel(`attendance-${sessionId}`)
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'attendance_records',
                filter: `session_id=eq.${sessionId}`,
            },
            (payload) => {
                onInsert(payload.new)
            }
        )
        .subscribe()

    return () => {
        supabase.removeChannel(channel)
    }
}


/**
 * Subscribe to session status changes (e.g., when teacher ends session).
 */
export function subscribeToSession(sessionId, onChange) {
    if (!supabase) return () => { }

    const channel = supabase
        .channel(`session-${sessionId}`)
        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'sessions',
                filter: `id=eq.${sessionId}`,
            },
            (payload) => {
                onChange(payload.new)
            }
        )
        .subscribe()

    return () => {
        supabase.removeChannel(channel)
    }
}

/**
 * Subscribe to ALL session changes (INSERT + UPDATE).
 * Used by Student Dashboard to:
 *   - Detect when a new session is created (INSERT)
 *   - Detect when a session is ended (UPDATE is_active → false)
 * Returns an unsubscribe function.
 */
export function subscribeToAllSessions(onChange) {
    if (!supabase) return () => { }

    const channel = supabase
        .channel('all-sessions')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sessions' },
            (payload) => onChange(payload.new))
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sessions' },
            (payload) => onChange(payload.new))
        .subscribe()

    return () => {
        supabase.removeChannel(channel)
    }
}
