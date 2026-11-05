import { useState, useEffect, useRef } from 'react';
import { onlineApi } from '../core/online-client';
import type { ParentDashboardResponse } from '../core/online-contracts';

interface ParentPinModalProps {
  studentId?: string;
  hasPin?: boolean;
  onSuccess: (data: ParentDashboardResponse) => void;
  onClose: () => void;
}

export default function ParentPinModal({ studentId, hasPin = true, onSuccess, onClose }: ParentPinModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isSetupMode] = useState(!hasPin);
  const [step, setStep] = useState<'enter' | 'confirm'>('enter');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [lockoutSec, setLockoutSec] = useState(0);

  useEffect(() => {
    dialogRef.current?.showModal();
    return () => {
      dialogRef.current?.close();
    };
  }, []);

  useEffect(() => {
    if (lockoutSec <= 0) return;
    const timer = setInterval(() => {
      setLockoutSec(s => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutSec]);

  const handleKeyClick = (val: string) => {
    if (busy || lockoutSec > 0) return;
    if (val === 'clear') {
      setPin('');
      return;
    }
    if (val === 'backspace') {
      setPin(p => p.slice(0, -1));
      return;
    }
    if (pin.length < 6) {
      setPin(p => p + val);
    }
  };

  const handleVerify = async (enteredPin: string) => {
    if (enteredPin.length < 4) {
      setError('Mã PIN cần có từ 4 đến 6 chữ số.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onlineApi.verifyParentPin(enteredPin);
      const dashboard = await onlineApi.parentDashboard(studentId);
      onSuccess(dashboard);
    } catch (err: any) {
      const msg = err?.message || 'Không thể xác thực mã PIN.';
      setError(msg);
      setPin('');
      if (msg.includes('khóa') || err?.status === 429) {
        setLockoutSec(15 * 60);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSetupNext = () => {
    if (pin.length < 4) {
      setError('Mã PIN cần có từ 4 đến 6 chữ số.');
      return;
    }
    setConfirmPin(pin);
    setPin('');
    setStep('confirm');
    setError('');
  };

  const handleSetupSubmit = async (confirmedPin: string) => {
    if (confirmedPin !== confirmPin) {
      setError('Mã PIN xác nhận không khớp. Hãy thử lại.');
      setPin('');
      setStep('enter');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onlineApi.setupParentPin({ pin: confirmedPin, studentId });
      const dashboard = await onlineApi.parentDashboard(studentId);
      onSuccess(dashboard);
    } catch (err: any) {
      setError(err?.message || 'Chưa thiết lập được mã PIN.');
      setPin('');
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = () => {
    if (isSetupMode) {
      if (step === 'enter') handleSetupNext();
      else handleSetupSubmit(pin);
    } else {
      handleVerify(pin);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className="online-dialog parent-pin-dialog"
      aria-labelledby="parent-pin-title"
      onCancel={e => { e.preventDefault(); if (!busy) onClose(); }}
    >
      <div className="parent-pin-container">
        <div className="parent-pin-header">
          <span className="parent-pin-icon" aria-hidden="true">🔒</span>
          <h2 id="parent-pin-title">
            {isSetupMode
              ? (step === 'enter' ? 'Thiết lập mã PIN phụ huynh' : 'Xác nhận lại mã PIN')
              : 'Khu vực dành cho Phụ huynh'}
          </h2>
          <p className="parent-pin-desc">
            {isSetupMode
              ? (step === 'enter' ? 'Nhập mã PIN gồm 4–6 số để quản lý giờ học và duyệt quà' : 'Nhập lại mã PIN vừa chọn để xác nhận')
              : 'Nhập mã PIN phụ huynh để xem báo cáo và duyệt quà'}
          </p>
          <button
            type="button"
            className="parent-pin-close"
            onClick={onClose}
            disabled={busy}
            aria-label="Đóng"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="online-notice online-error" role="alert">
            {error}
          </div>
        )}

        {lockoutSec > 0 && (
          <div className="parent-pin-lockout" role="alert">
            ⏳ Mã PIN bị tạm khóa. Vui lòng đợi {Math.floor(lockoutSec / 60)}:{('0' + (lockoutSec % 60)).slice(-2)}
          </div>
        )}

        <div className="parent-pin-display" aria-live="polite">
          {[0, 1, 2, 3, 4, 5].map(idx => (
            <span
              key={idx}
              className={`parent-pin-dot ${idx < pin.length ? 'filled' : ''}`}
            />
          ))}
        </div>

        <input
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          value={pin}
          onChange={e => {
            const val = e.target.value.replace(/\D/g, '').slice(0, 6);
            setPin(val);
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') handleSubmit();
          }}
          className="parent-pin-hidden-input"
          autoFocus
          disabled={busy || lockoutSec > 0}
          aria-label="Mã PIN"
        />

        <div className="parent-pin-keypad" role="group" aria-label="Bàn phím số PIN">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
            <button
              key={num}
              type="button"
              className="parent-key-btn"
              onClick={() => handleKeyClick(String(num))}
              disabled={busy || lockoutSec > 0}
            >
              {num}
            </button>
          ))}
          <button
            type="button"
            className="parent-key-btn parent-key-action"
            onClick={() => handleKeyClick('clear')}
            disabled={busy || lockoutSec > 0}
            title="Xóa hết"
          >
            C
          </button>
          <button
            type="button"
            className="parent-key-btn"
            onClick={() => handleKeyClick('0')}
            disabled={busy || lockoutSec > 0}
          >
            0
          </button>
          <button
            type="button"
            className="parent-key-btn parent-key-action"
            onClick={() => handleKeyClick('backspace')}
            disabled={busy || lockoutSec > 0}
            title="Xóa ký tự cuối"
          >
            ⌫
          </button>
        </div>

        <div className="parent-pin-actions">
          <button
            type="button"
            className="online-btn online-primary parent-pin-submit"
            onClick={handleSubmit}
            disabled={busy || lockoutSec > 0 || pin.length < 4}
          >
            {busy ? 'Đang kiểm tra…' : (isSetupMode && step === 'enter' ? 'Tiếp tục ➔' : 'Xác nhận')}
          </button>
        </div>
      </div>
    </dialog>
  );
}
