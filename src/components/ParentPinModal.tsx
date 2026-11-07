import { useState, useEffect, useRef } from 'react';
import { onlineApi } from '../core/online-client';
import type { ParentDashboardResponse } from '../core/online-contracts';
import { PinPad } from '../ui/PinPad';

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
  const validPin = isSetupMode ? /^\d{6}$/.test(pin) : /^\d{4,6}$/.test(pin);

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

  const handleVerify = async (enteredPin: string) => {
    if (busy || lockoutSec > 0) return;
    if (!/^\d{4,6}$/.test(enteredPin)) {
      setError('Nhập mã PIN hiện có gồm 4–6 chữ số.');
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
    if (pin.length < 6) {
      setError('Mã PIN cần có đủ 6 chữ số.');
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
    if (busy || lockoutSec > 0 || !validPin) return;
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
              ? (step === 'enter' ? 'Nhập mã PIN gồm 6 số để quản lý giờ học và duyệt quà' : 'Nhập lại mã PIN 6 số vừa chọn để xác nhận')
              : 'Nhập mã PIN hiện có (4–6 số) để xem báo cáo và duyệt quà. Mã PIN mới gồm 6 số.'}
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

        <PinPad
          pinLength={6}
          value={pin}
          onChange={setPin}
          disabled={busy || lockoutSec > 0}
          lockedNotice={
            lockoutSec > 0
              ? `⏳ Mã PIN bị tạm khóa. Vui lòng đợi ${Math.floor(lockoutSec / 60)}:${('0' + (lockoutSec % 60)).slice(-2)}`
              : undefined
          }
        />

        <div className="parent-pin-actions">
          <button
            type="button"
            className="online-btn online-primary parent-pin-submit"
            onClick={handleSubmit}
            disabled={busy || lockoutSec > 0 || !validPin}
          >
            {busy ? 'Đang kiểm tra…' : (isSetupMode && step === 'enter' ? 'Tiếp tục ➔' : 'Xác nhận')}
          </button>
        </div>
      </div>
    </dialog>
  );
}
