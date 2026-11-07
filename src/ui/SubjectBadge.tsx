import React from 'react';
import { Icon, type IconName } from './Icon';

export type SubjectCode = 'toan' | 'tieng-viet' | 'tieng-anh' | 'tin-hoc' | 'math' | 'vietnamese' | 'english' | 'computing';

const SUBJECT_CONFIG: Record<string, { label: string; icon: IconName }> = {
  toan: { label: 'Toán', icon: 'sparkles' },
  math: { label: 'Toán', icon: 'sparkles' },
  'tieng-viet': { label: 'Tiếng Việt', icon: 'book' },
  vietnamese: { label: 'Tiếng Việt', icon: 'book' },
  'tieng-anh': { label: 'Tiếng Anh', icon: 'compass' },
  english: { label: 'Tiếng Anh', icon: 'compass' },
  'tin-hoc': { label: 'Tin học', icon: 'settings' },
  computing: { label: 'Tin học', icon: 'settings' },
};

export interface SubjectBadgeProps {
  subject: SubjectCode | string;
  label?: string;
  className?: string;
}

export const SubjectBadge: React.FC<SubjectBadgeProps> = ({
  subject,
  label,
  className = '',
}) => {
  const code = subject.toLowerCase();
  const config = SUBJECT_CONFIG[code] || { label: label || subject, icon: 'book' };
  const displayLabel = label || config.label;

  return (
    <span className={`ui-subject-badge ui-subject-badge-${code} ${className}`}>
      <Icon name={config.icon} size={16} aria-hidden />
      <span>{displayLabel}</span>
    </span>
  );
};

export default SubjectBadge;
