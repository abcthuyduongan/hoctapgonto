import React, { useEffect, useRef } from 'react';
import { IconButton } from './IconButton';
import { Icon, type IconName } from './Icon';
import {useModalFocus} from './useModalFocus';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  iconName?: IconName;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  maxWidth?: string;
}

export const Dialog: React.FC<DialogProps> = ({
  open,
  onClose,
  title,
  iconName,
  children,
  footer,
  className = '',
  maxWidth,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalFocus(dialogRef,open);
  const onCloseRef=useRef(onClose);
  onCloseRef.current=onClose;

  useEffect(() => {
    if (open) {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onCloseRef.current();
        }
      };

      document.addEventListener('keydown', handleKeyDown);
      const oldOverflow=document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        document.body.style.overflow = oldOverflow;
      };
    }
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="ui-dialog-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ui-dialog-title"
        tabIndex={-1}
        className={`ui-dialog ${className}`}
        style={maxWidth ? { maxWidth } : undefined}
      >
        <header className="ui-dialog-header">
          <h2 id="ui-dialog-title" className="ui-dialog-title">
            {iconName && <Icon name={iconName} size={24} aria-hidden />}
            <span>{title}</span>
          </h2>
          <IconButton
            name="cross"
            ariaLabel="Đóng hộp thoại"
            size={18}
            onClick={onClose}
          />
        </header>

        <div className="ui-dialog-body">{children}</div>

        {footer && <footer className="ui-dialog-footer">{footer}</footer>}
      </div>
    </div>
  );
};

export default Dialog;
