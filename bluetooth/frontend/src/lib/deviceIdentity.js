/**
 * Device Identity Module
 * 
 * Generates and persists a stable device fingerprint for student attendance.
 * This acts as a "Location device ID substitute" for web browsers,
 * which block real MAC access for privacy reasons.
 * 
 * In a real Android native app (React Native), you would use:
 *   LocationManager.getLastKnownLocation().getDeviceId()
 * to get the actual Bluetooth MAC address.
 */

const DEVICE_ID_KEY = 'smartattend_device_id'

/**
 * Generate a stable unique device ID.
 * Stored in localStorage — persists across sessions on the same device/browser.
 * First call generates it; subsequent calls return the same ID.
 */
export function getDeviceId() {
    let id = localStorage.getItem(DEVICE_ID_KEY)
    if (!id) {
        id = generateUUID()
        localStorage.setItem(DEVICE_ID_KEY, id)
    }
    return id
}

/**
 * Get browser + device fingerprint components.
 * Combined with the device UUID, this creates a strong device identity.
 */
export function getDeviceFingerprint() {
    const nav = navigator
    const components = [
        getDeviceId(),
        nav.userAgent,
        nav.language,
        screen.width + 'x' + screen.height,
        screen.colorDepth,
        nav.hardwareConcurrency || 0,
        Intl.DateTimeFormat().resolvedOptions().timeZone,
        nav.platform || '',
    ]
    return {
        deviceId: getDeviceId(),
        userAgent: nav.userAgent,
        platform: nav.platform || 'Unknown',
        screenRes: `${screen.width}×${screen.height}`,
        language: nav.language,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        fingerprint: hashString(components.join('|')),
    }
}

/**
 * Try to get a Web Location device ID (requires user gesture + Location on).
 * This is the closest to a real Location ID that web allows.
 * Returns null if Location is unavailable or user cancels.
 */
export async function getLocationDeviceId() {
    if (!navigator.geolocation?.getCurrentPosition) return null
    try {
        // For location, we can't get a device ID directly, so we'll use a hash of coordinates
        return new Promise((resolve) => {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const coords = `${position.coords.latitude},${position.coords.longitude}`
                    resolve(btoa(coords).slice(0, 16)) // simple hash
                },
                () => resolve(null)
            )
        })
    } catch {
        return null
    }
}

/**
 * Format a device UUID to look like a MAC address (for display).
 * e.g. "a4526d1f-..." → "A4:52:6D:1F:★★:★★"
 */
export function formatAsMac(uuid) {
    if (!uuid) return 'Unknown'
    const hex = uuid.replace(/-/g, '').substring(0, 12).toUpperCase()
    const pairs = hex.match(/.{1,2}/g) || []
    return pairs.slice(0, 4).join(':') + ':★★:★★'
}

/**
 * Get a display-friendly device label
 */
export function getDeviceLabel() {
    const ua = navigator.userAgent
    if (/android/i.test(ua)) return '📱 Android'
    if (/iphone|ipad/i.test(ua)) return '📱 iOS'
    if (/windows/i.test(ua)) return '💻 Windows'
    if (/mac/i.test(ua)) return '💻 Mac'
    return '🖥️ Unknown Device'
}

// ── Helpers ──────────────────────────────────────────────────────────────
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = (Math.random() * 16) | 0
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
    })
}

function hashString(str) {
    let hash = 5381
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash) + str.charCodeAt(i)
        hash |= 0
    }
    return Math.abs(hash).toString(16).toUpperCase().padStart(8, '0')
}
