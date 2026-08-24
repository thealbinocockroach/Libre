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
      className={`rounded-2xl bg-gradient-to-br from-[#C5A059] to-[#8C6D2B] flex items-center justify-center text-black shadow-lg shadow-[#C5A059]/20 shrink-0 ${className}`}
    >
      <Headphones className="w-5 h-5" />
    </div>
  );
};

