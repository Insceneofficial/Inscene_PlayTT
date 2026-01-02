
import React from 'react';

interface LogoProps {
  size?: number;
  className?: string;
  isPulsing?: boolean;
}

const Logo: React.FC<LogoProps> = ({ size = 100, className = "", isPulsing = true }) => {
  return (
    <div 
      className={`relative flex items-center justify-center ${isPulsing ? 'logo-pulse' : ''} ${className}`} 
      style={{ width: `${size}px`, height: `${size}px` }}
    >
      <svg
        viewBox="0 0 500 500"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        {/* Shadow layer for depth */}
        <path
          d="M100 150 C 100 120, 120 100, 150 100 H 350 C 380 100, 400 120, 400 150 V 300 C 400 330, 380 350, 350 350 H 330 L 355 390 L 310 350 H 150 C 120 350, 100 330, 100 300 V 150 Z"
          fill="rgba(139,92,246,0.2)"
          transform="translate(12, 12)"
        />

        {/* Main White Bubble */}
        <path
          d="M100 150 C 100 120, 120 100, 150 100 H 350 C 380 100, 400 120, 400 150 V 300 C 400 330, 380 350, 350 350 H 330 L 355 390 L 310 350 H 150 C 120 350, 100 330, 100 300 V 150 Z"
          fill="white"
          stroke="#1a1a24"
          strokeWidth="12"
          strokeLinejoin="round"
        />

        {/* The Play Triangle (Violet Gradient) */}
        <defs>
          <linearGradient id="playGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#3b82f6" />
          </linearGradient>
        </defs>
        <path
          d="M215 185 L 305 240 L 215 295 Z"
          fill="url(#playGradient)"
          stroke="#6366f1"
          strokeWidth="8"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};

export default Logo;
