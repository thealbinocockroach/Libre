import React from 'react';

interface AppLogoProps {
  className?: string;
  size?: number;
}

export const AppLogo: React.FC<AppLogoProps> = ({ className = 'w-10 h-10' }) => {
  return (
    <img
      id="app-logo"
      src="/logo.png"
      alt="LibriAudio"
      className={`rounded-2xl object-cover shadow-lg shadow-[rgba(var(--accent-rgb),0.3)] shrink-0 ${className}`}
      draggable={false}
    />
  );
};
