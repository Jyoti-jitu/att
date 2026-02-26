import { createContext, useContext, useState, useCallback, useRef } from 'react'

const LocationContext = createContext(null)

// ── Thresholds ─────────────────────────────────────────────────────────────
export const RSSI_PRESENT = -70   // dBm  →  Present
export const RSSI_ABSENT = -85   // dBm  →  Absent
export const DISTANCE_LIMIT = 10   // metres — max allowed for check-in

// ── Free-Space Path Loss distance estimation ───────────────────────────────
export function estimateDistance(rssi, txPower = -59, n = 2.5) {
    if (rssi === 0) return 999
    const d = Math.pow(10, (txPower - rssi) / (10 * n))
    return Math.round(d * 10) / 10   // one decimal
}

export function rssiToLabel(rssi) {
    if (rssi >= -55) return 'Excellent'
    if (rssi >= -65) return 'Good'
    if (rssi >= -75) return 'Fair'
    if (rssi >= -85) return 'Weak'
    return 'Very Weak'
}

export function rssiColor(rssi) {
    if (rssi >= -65) return 'text-green-400'
    if (rssi >= -78) return 'text-yellow-400'
    return 'text-red-400'
}

export function isWithinRange(rssi) {
    return rssi > RSSI_ABSENT   // > -85 dBm = detectable; > -70 = comfortable
}

export function isWebLocationSupported() {
    if (typeof navigator === 'undefined' || !navigator.bluetooth) return false
    // Web Location requires a secure context (HTTPS or localhost)
    if (!window.isSecureContext) return false
    return true
}

export async function getLocationState() {
    if (!isWebLocationSupported()) return 'unsupported'
    try {
        if (navigator.bluetooth.getAvailability) {
            const available = await navigator.bluetooth.getAvailability()
            return available ? 'on' : 'off'
        }
        return 'unknown'
    } catch {
        return 'unknown'
    }
}

/**
 * Triggers the browser's native Location prompt.
 * Must be called from a user gesture (e.g. button click).
 */
export async function requestLocationPrompt(setInternalError = null) {
    console.log('Attempting to trigger Location prompt...')

    if (!window.isSecureContext) {
        const msg = 'Location requires a secure connection (HTTPS) or localhost.'
        console.error(msg)
        if (setInternalError) setInternalError(msg)
        return false
    }

    if (!isWebLocationSupported()) {
        const msg = 'Web Location is not supported in this browser. Try Chrome or Edge.'
        console.warn(msg)
        if (setInternalError) setInternalError(msg)
        return false
    }

    try {
        // We use requestDevice with a simple filter to trigger the system dialog
        // This is the only way to "proactively" ask for Location via Web APIs
        await navigator.bluetooth.requestDevice({
            acceptAllDevices: true,
            // optionalServices is required on some browsers even with acceptAllDevices
            optionalServices: ['generic_access']
        })
        console.log('Location prompt/picker interaction successful.')
        return true
    } catch (e) {
        let msg = e.message
        if (e.name === 'NotFoundError') msg = 'Location hardware not found or disabled in OS settings.'
        if (e.name === 'SecurityError') msg = 'Permission denied or not a secure context.'

        console.warn('Location prompt failed:', e.name, msg)
        if (setInternalError) setInternalError(msg)
        return false
    }
}

// ── Scan for BLE devices and return RSSI ──────────────────────────────────
// We scan for ANY BLE advertisement. The strongest signal = classroom proximity.
// In production you'd filter by a specific serviceUUID your beacon broadcasts.
export async function scanForBeacon(onDeviceFound, { serviceUUID = null } = {}) {
    if (!isWebBluetoothSupported()) throw new Error('Web Bluetooth not supported in this browser')

    const filters = serviceUUID
        ? [{ services: [serviceUUID] }]
        : [{ namePrefix: 'SmartAttend' }, { namePrefix: 'eddystone' }, { namePrefix: 'iBeacon' }]

    // requestLEScan is available in Chrome on Android/Linux (Experimental)
    if (navigator.bluetooth.requestLEScan) {
        let scan
        try {
            scan = await navigator.bluetooth.requestLEScan({
                filters: [{}],   // scan all
                keepRepeatedDevices: true,
            })
            navigator.bluetooth.addEventListener('advertisementreceived', event => {
                onDeviceFound({
                    id: event.device?.id || 'unknown',
                    name: event.device?.name || 'BLE Device',
                    rssi: event.rssi,
                })
            })
            return scan   // caller can call scan.stop()
        } catch (e) {
            if (scan) scan.stop()
            throw e
        }
    }

    // Fallback: requestDevice (requires user gesture, shows picker)
    const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: serviceUUID ? [serviceUUID] : [],
    })
    // We can't read RSSI directly from requestDevice, so we simulate from device proximity
    onDeviceFound({ id: device.id, name: device.name || 'BLE Device', rssi: -60 })
    return null
}

// ──────────────────────────────────────────────────────────────────────────
export function LocationProvider({ children }) {
    const [btState, setBtState] = useState('unknown')  // 'on'|'off'|'unsupported'|'unknown'
    const [scanning, setScanning] = useState(false)
    const [nearbyDevices, setNearbyDevices] = useState([])
    const [beaconRSSI, setBeaconRSSI] = useState(null)
    const [scanError, setScanError] = useState(null)
    const scanRef = useRef(null)
    const simRef = useRef(null)

    // ── Check Location state ─────────────────────────────────────────────
    const checkLocation = useCallback(async () => {
        const state = await getLocationState()
        setBtState(state)
        return state
    }, [])
        const state = await getBluetoothState()
        setBtState(state)
        return state
    }, [])

    // ── Start BLE scan ────────────────────────────────────────────────────
    const startScan = useCallback(async () => {
        setScanError(null)
        setScanning(false) // Reset state before check
        setNearbyDevices([])

        // ── Mandatory Location Check ──
        if (navigator.bluetooth?.getAvailability) {
            const isAvailable = await navigator.bluetooth.getAvailability()
            if (!isAvailable) {
                setBtState('off')
                // Instead of just blocking, we can try to trigger the prompt if this was 
                // called from a user gesture. However, startScan is sometimes called 
                // from useEffect (StudentCheckIn). 
                // For now, we'll set the error and let the UI provide a dedicated prompt button.
                setScanError('Location is OFF. Please turn on Location to continue.')
                return // BLOCK scan
            }
            setBtState('on')
        }

        setScanning(true)

        // ── Path 1: real BLE scan (Android Chrome only) ───
        if (navigator.bluetooth?.requestLEScan) {
            try {
                const scan = await navigator.bluetooth.requestLEScan({
                    filters: [{}],
                    keepRepeatedDevices: true,
                })
                scanRef.current = scan
                navigator.bluetooth.addEventListener('advertisementreceived', (ev) => {
                    const rssi = ev.rssi ?? -75
                    setBeaconRSSI(rssi)
                    setNearbyDevices(prev => {
                        const id = ev.device?.id || 'dev'
                        const existing = prev.findIndex(d => d.id === id)
                        const entry = {
                            id,
                            name: ev.device?.name || 'BLE Device',
                            rssi,
                            distance: estimateDistance(rssi),
                        }
                        if (existing >= 0) { const n = [...prev]; n[existing] = entry; return n }
                        return [...prev, entry]
                    })
                })
                return
            } catch (e) {
                if (e.name === 'NotFoundError' || e.name === 'SecurityError') {
                    setScanError('Bluetooth permission denied. Please allow Bluetooth access.')
                    setScanning(false)
                    return
                }
                console.warn('requestLEScan failed, falling back to simulation:', e.message)
            }
        }

        // ── Path 2: Simulation (Desktop/Other) ──
        // Only reaches here if BT is ON but requestLEScan is not supported
        console.log('Using simulation mode (Bluetooth is ON)')
        simulateScan()
    }, [])





    // ── Simulated scan (desktop fallback) ─────────────────────────────────
    const simulateScan = () => {
        setScanning(true)
        let tick = 0
        simRef.current = setInterval(() => {
            tick++
            // simulate RSSI fluctuating around -62 (comfortable in-room)
            const base = -62
            const rssi = Math.round(base + (Math.random() - 0.5) * 14)
            setBeaconRSSI(rssi)
            setNearbyDevices([{
                id: 'sim-beacon',
                name: 'SmartAttend Beacon (Simulated)',
                rssi,
                distance: estimateDistance(rssi),
            }])
        }, 2000)
    }

    // ── Stop scan ─────────────────────────────────────────────────────────
    const stopScan = useCallback(() => {
        setScanning(false)
        if (scanRef.current) { try { scanRef.current.stop() } catch { } scanRef.current = null }
        if (simRef.current) { clearInterval(simRef.current); simRef.current = null }
    }, [])
    return (
        <LocationContext.Provider value={{
            btState, scanning, nearbyDevices, beaconRSSI, scanError,
            checkLocation, startScan, stopScan, requestLocationPrompt,
            isSupported: isWebLocationSupported(),
            RSSI_PRESENT, RSSI_ABSENT, DISTANCE_LIMIT,
            estimateDistance, rssiToLabel, rssiColor, isWithinRange,
        }}>
            {children}
        </LocationContext.Provider>
    )
}

export const useLocation = () => {
    const ctx = useContext(LocationContext)
    if (!ctx) throw new Error('useLocation must be used within LocationProvider')
    return ctx
}
