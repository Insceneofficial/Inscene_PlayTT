
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
      <img 
        src="/icon.png" 
        alt="Inscene Logo" 
        className="w-full h-full object-contain"
      />
    </div>
  );
};

export default Logo;
