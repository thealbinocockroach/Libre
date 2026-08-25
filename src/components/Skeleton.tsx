import React from 'react';

export const Skeleton: React.FC = () => {
  return (
    <div className="max-w-6xl mx-auto w-full p-4 md:p-8 animate-pulse space-y-8">
      <div className="h-8 w-64 bg-[var(--surface-raised)] rounded-lg" />
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
        {[...Array(10)].map((_, i) => (
          <div key={i} className="aspect-[3/4] w-full rounded-2xl bg-[var(--surface-raised)]" />
        ))}
      </div>
    </div>
  );
};
