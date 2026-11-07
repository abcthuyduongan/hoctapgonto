import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'subtle' | 'danger';
export type ButtonSize = 44 | 56 | 64;

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: React.ReactNode;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 44,
  children,
  icon,
  className = '',
  ...props
}) => {
  return (
    <button
      className={`ui-btn ui-btn-${variant} ui-btn-size-${size} ${className}`}
      {...props}
    >
      {icon && <span className="ui-btn-icon">{icon}</span>}
      <span className="ui-btn-text">{children}</span>
    </button>
  );
};

export default Button;
