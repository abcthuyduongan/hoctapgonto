import React, { useEffect } from 'react';
import { Icon, type IconName } from './Icon';

export interface ToastProps {
  message: string;
  icon?: IconName;
  durationMs?: number;
  onDismiss: () => void;
  className?: string;
}

export const Toast: React.FC<ToastProps> = ({
  message,
  icon = 'info',
  durationMs = 4000,
  onDismiss,
  className = '',
}) => {
  useEffect(() => {
    if (durationMs > 0) {
      const timer = setTimeout(onDismiss, durationMs);
      return () => clearTimeout(timer);
    }
  }, [durationMs, onDismiss]);

  return (
    <div className={`ui-toast ${className}`} role="status" aria-live="polite">
      <Icon name={icon} size={20} aria-hidden />
      <span>{message}</span>
    </div>
  );
};

export default Toast;
