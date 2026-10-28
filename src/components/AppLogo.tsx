import React from 'react';
import { Headphones } from 'lucide-react';

interface AppLogoProps {
  className?: string;
  size?: number;
}

export const AppLogo: React.FC<AppLogoProps> = ({ className = 'w-10 h-10' }) => {
  return (
    <div
      id="app-logo"
      className={`rounded-2xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-hover)] flex items-center justify-center text-[var(--on-accent)] shadow-lg shadow-[rgba(var(--accent-rgb),0.3)] shrink-0 ${className}`}
    >
      <Headphones className="w-5 h-5" />
    </div>
  );
};
