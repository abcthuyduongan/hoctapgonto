import React from 'react';
import { Icon } from './Icon';

export interface StarMeterProps {
  stars: number; // 0..3
  maxStars?: number; // mặc định 3
  size?: number;
  className?: string;
}

export const StarMeter: React.FC<StarMeterProps> = ({
  stars,
  maxStars = 3,
  size = 20,
  className = '',
}) => {
  return (
    <div
      className={`ui-star-meter ${className}`}
      aria-label={`${stars} trên ${maxStars} sao`}
    >
      {Array.from({ length: maxStars }, (_, i) => {
        const isFilled = i < stars;
        return (
          <span
            key={i}
            className={`ui-star-slot ${isFilled ? 'ui-star-active' : ''}`}
          >
            <Icon name="star" size={size} aria-hidden />
          </span>
        );
      })}
    </div>
  );
};

export default StarMeter;
