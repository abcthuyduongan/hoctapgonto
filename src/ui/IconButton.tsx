import React from 'react';
import { Icon, type IconName } from './Icon';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  name: IconName;
  ariaLabel: string;
  size?: number | string;
  bordered?: boolean;
  className?: string;
}

export const IconButton: React.FC<IconButtonProps> = ({
  name,
  ariaLabel,
  size = 20,
  bordered = false,
  className = '',
  ...props
}) => {
  return (
    <button
      type="button"
      className={`ui-icon-btn ${bordered ? 'ui-icon-btn-bordered' : ''} ${className}`}
      aria-label={ariaLabel}
      title={ariaLabel}
      {...props}
    >
      <Icon name={name} size={size} aria-hidden />
    </button>
  );
};

export default IconButton;
