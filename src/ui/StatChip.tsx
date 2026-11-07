import React from 'react';
import { Icon, type IconName } from './Icon';

export interface StatChipProps {
  icon?: IconName;
  customIcon?: React.ReactNode;
  label: string | number;
  value?: string | number;
  title?: string;
  className?: string;
}

export const StatChip: React.FC<StatChipProps> = ({
  icon,
  customIcon,
  label,
  value,
  title,
  className = '',
}) => {
  return (
    <div
      className={`ui-stat-chip ${className}`.trim()}
      title={title}
      aria-label={title || (value !== undefined ? `${label} ${value}` : String(label))}
    >
      {icon && <Icon name={icon} size={18} aria-hidden />}
      {customIcon && <span className="material-icon" aria-hidden="true">{customIcon}</span>}
      {value !== undefined ? (
        <>
          <span className="material-label">{label}</span>
          <span className="material-count">{value}</span>
        </>
      ) : (
        <span>{label}</span>
      )}
    </div>
  );
};

export default StatChip;
