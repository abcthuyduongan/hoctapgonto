import React from 'react';
import { Icon, type IconName } from './Icon';
import { Button } from './Button';

export interface EmptyStateProps {
  icon?: IconName;
  title?: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
  children?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = 'info',
  title,
  message,
  actionLabel,
  onAction,
  className = '',
  children,
}) => {
  return (
    <div className={`ui-empty-state ${className}`.trim()}>
      <div className="ui-empty-state-icon">
        <Icon name={icon} size={48} aria-hidden />
      </div>
      {title && <h3 className="ui-empty-state-title">{title}</h3>}
      <p className="ui-empty-state-text">{message}</p>
      {children}
      {actionLabel && onAction && (
        <Button variant="secondary" size={44} onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
};

export default EmptyState;
