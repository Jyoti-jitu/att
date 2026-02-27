import React, { useRef, useState, useEffect } from 'react';

const OTPInput = ({ length = 6, value = '', onChange, onComplete, disabled = false }) => {
    const [otp, setOtp] = useState(new Array(length).fill(''));
    const [activeInput, setActiveInput] = useState(-1);
    const inputRefs = useRef([]);

    // Sync state with value prop (Controlled Component)
    useEffect(() => {
        const valStr = value || '';
        if (valStr === otp.join('')) return; // Avoid loops

        const newOtp = valStr.split('').slice(0, length);
        while (newOtp.length < length) newOtp.push('');
        setOtp(newOtp);
    }, [value, length]);

    const handleChange = (e, index) => {
        const val = e.target.value;
        if (isNaN(val)) return; // Only allow numbers

        const newOtp = [...otp];
        newOtp[index] = val.substring(val.length - 1); // Only take last char
        setOtp(newOtp);

        // Calculate string
        const otpString = newOtp.join('');

        // Notify parent
        if (onChange) onChange(otpString);

        // Auto-focus next
        if (val && index < length - 1) {
            inputRefs.current[index + 1]?.focus();
        }

        // Trigger complete
        if (otpString.length === length && onComplete) {
            onComplete(otpString);
        }
    };

    const handleKeyDown = (e, index) => {
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handlePaste = (e) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData('text').slice(0, length);
        if (!/^\d+$/.test(pastedData)) return;

        const newOtp = pastedData.split('');
        while (newOtp.length < length) newOtp.push('');

        // Update local state immediately for visual
        setOtp(newOtp);

        // Notify parent
        const otpString = newOtp.join('');
        if (onChange) onChange(otpString);

        // Focus logic
        const nextIndex = Math.min(pastedData.length, length - 1);
        inputRefs.current[nextIndex]?.focus();

        // Trigger complete
        if (otpString.length === length && onComplete) {
            onComplete(otpString);
        }
    };

    return (
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
            {otp.map((digit, index) => (
                <input
                    key={index}
                    ref={(el) => (inputRefs.current[index] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleChange(e, index)}
                    onKeyDown={(e) => handleKeyDown(e, index)}
                    onPaste={handlePaste}
                    disabled={disabled}
                    autoFocus={index === 0}
                    style={{
                        width: '45px',
                        height: '45px',
                        fontSize: '20px',
                        fontWeight: '600',
                        textAlign: 'center',
                        border: `2px solid ${activeInput === index ? '#2563eb' : '#e2e8f0'}`,
                        borderRadius: '12px',
                        outline: 'none',
                        padding: '0',
                        margin: '0',
                        boxSizing: 'border-box',
                        transition: 'all 0.2s',
                        backgroundColor: disabled ? '#f8fafc' : '#fff',
                        color: disabled ? '#94a3b8' : '#1e293b',
                        boxShadow: activeInput === index ? '0 0 0 4px rgba(37, 99, 235, 0.1)' : 'none'
                    }}
                    onFocus={() => {
                        setActiveInput(index);
                        inputRefs.current[index]?.select();
                    }}
                    onBlur={() => setActiveInput(-1)}
                />
            ))}
        </div>
    );
};

export default OTPInput;
