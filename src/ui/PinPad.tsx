import React, { useState } from 'react';
import { Icon } from './Icon';

export interface PinPadProps {
  pinLength?: number; // chuẩn 6 số
  value?: string;
  onChange?: (pin: string) => void;
  onComplete?: (pin: string) => void;
  disabled?: boolean;
  lockedNotice?: string;
  className?: string;
}

export const PinPad: React.FC<PinPadProps> = ({
  pinLength = 6,
  value,
  onChange,
  onComplete,
  disabled = false,
  lockedNotice,
  className = '',
}) => {
  const [internalDigits, setInternalDigits] = useState<string[]>([]);
  const isControlled = value !== undefined && onChange !== undefined;
  const digits = isControlled ? value.split('') : internalDigits;

  const updatePin = (nextDigits: string[]) => {
    const nextStr = nextDigits.join('');
    if (isControlled) {
      onChange!(nextStr);
    } else {
      setInternalDigits(nextDigits);
    }
    if (nextDigits.length === pinLength && onComplete) {
      onComplete(nextStr);
    }
  };

  const handleDigit = (digit: string) => {
    if (disabled || digits.length >= pinLength) return;
    updatePin([...digits, digit]);
  };

  const handleDelete = () => {
    if (disabled || digits.length === 0) return;
    updatePin(digits.slice(0, -1));
  };

  const handleClear = () => {
    if (disabled) return;
    updatePin([]);
  };

  return (
    <div className={`ui-pinpad ${className}`.trim()}>
      {lockedNotice ? (
        <div className="ui-pinpad-locked parent-pin-lockout" role="alert">
          {lockedNotice}
        </div>
      ) : (
        <>
          <div
            className="ui-pinpad-dots parent-pin-display"
            aria-live="polite"
            aria-label={`Đã nhập ${digits.length} trên ${pinLength} số`}
          >
            {Array.from({ length: pinLength }, (_, i) => (
              <span
                key={i}
                className={`ui-pinpad-dot parent-pin-dot ${i < digits.length ? 'ui-pinpad-dot-filled filled' : ''}`}
              />
            ))}
          </div>

          <div className="ui-pinpad-grid parent-pin-keypad" role="group" aria-label="Bàn phím nhập mã số">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((n) => (
              <button
                key={n}
                type="button"
                className="ui-pinpad-btn parent-key-btn"
                disabled={disabled}
                onClick={() => handleDigit(n)}
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              className="ui-pinpad-btn parent-key-btn parent-key-action"
              disabled={disabled}
              onClick={handleClear}
              title="Xóa hết"
              aria-label="Xóa tất cả"
            >
              C
            </button>
            <button
              type="button"
              className="ui-pinpad-btn parent-key-btn"
              disabled={disabled}
              onClick={() => handleDigit('0')}
            >
              0
            </button>
            <button
              type="button"
              className="ui-pinpad-btn parent-key-btn parent-key-action"
              disabled={disabled}
              onClick={handleDelete}
              title="Xóa ký tự cuối"
              aria-label="Xóa số vừa nhập"
            >
              <Icon name="back" size={22} aria-hidden />
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default PinPad;
