import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  interactive?: boolean;
  className?: string;
}

export const Card: React.FC<CardProps> = ({
  children,
  interactive = false,
  className = '',
  ...props
}) => {
  return (
    <div
      className={`ui-card ${interactive ? 'ui-card-interactive' : ''} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export default Card;
