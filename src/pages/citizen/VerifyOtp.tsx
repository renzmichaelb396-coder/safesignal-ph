import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'wouter';
import { citizenApi } from '../../lib/api';

export default function VerifyOtp() {
  const [, navigate] = useLocation();
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const citizenId = localStorage.getItem('pending_citizen_id');

  useEffect(() => {
    if (!citizenId) {
      navigate('/register');
    }
  }, [citizenId, navigate]);

  useEffect(() => {
    if (resendCountdown > 0) {
      const timer = setTimeout(() => setResendCountdown(resendCountdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCountdown]);

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    if (newOtp.every(digit => digit)) {
      handleSubmit(newOtp);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleSubmit = async (otpDigits = otp) => {
    const otpCode = otpDigits.join('');
    if (otpCode.length !== 6) {
      setError('OTP must be 6 digits');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const data: any = await citizenApi.verifyOtp({
        citizen_id: parseInt(citizenId || '0'),
        otp: otpCode,
      });
      localStorage.setItem('citizen_token', data.token);
      localStorage.removeItem('pending_citizen_id');
      navigate('/home');
    } catch (err: any) {
      setError(err.message || 'OTP verification failed');
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    try {
      await citizenApi.resendOtp(parseInt(citizenId || '0'));
      setResendCountdown(60);
    } catch (err: any) {
      setError(err.message || 'Resend failed');
    }
  };

  const otpBoxStyle = (index: number) => ({
    width: '48px',
    height: '56px',
    fontSize: '24px',
    fontWeight: 'bold',
    textAlign: 'center' as const,
    border: '2px solid rgba(255,255,255,0.2)',
    borderRadius: '12px',
    background: 'rgba(255,255,255,0.07)',
    color: '#fff',
    outline: 'none',
    transition: 'border-color 0.2s',
  });

  return (
    <div className="citizen-container px-5 py-6 flex flex-col items-center justify-between min-h-screen" style={{ background: 'var(--citizen-bg)' }}>
      <div className="w-full">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/">
            <button style={{ color: '#aaa', background: 'none', border: 'none', fontSize: 20 }}>←</button>
          </Link>
          <div>
            <h1 style={{ color: '#fff', fontSize: 20, fontWeight: 700, margin: 0 }}>Verify OTP</h1>
            <p style={{ color: '#888', fontSize: 12, margin: 0 }}>Check your SMS</p>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="flex gap-2 justify-center">
            {otp.map((digit, i) => (
              <input
                key={i}
                ref={el => { inputRefs.current[i] = el; }}
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={1}
                value={digit}
                onChange={e => handleOtpChange(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                style={otpBoxStyle(i)}
                autoFocus={i === 0}
                disabled={loading}
              />
            ))}
          </div>

          {error && (
            <div className="p-3 rounded-xl text-sm" style={{ background: 'rgba(230,57,70,0.2)', color: '#ff6b6b' }}>
              {error}
            </div>
          )}

          <div className="text-center">
            {resendCountdown > 0 ? (
              <p style={{ color: '#888', fontSize: 13 }}>
                Resend OTP in <strong style={{ color: 'var(--ph-gold)' }}>{resendCountdown}s</strong>
              </p>
            ) : (
              <button
                onClick={handleResend}
                style={{ background: 'none', border: 'none', color: 'var(--ph-gold)', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}
              >
                Didn't receive code? Resend OTP
              </button>
            )}
          </div>
        </div>
      </div>

      <p style={{ color: '#666', fontSize: 11, textAlign: 'center' }}>
        We'll never share your number
      </p>
    </div>
  );
}
