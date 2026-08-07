import React from 'react';
import { Sparkles } from 'lucide-react';

// "by Atanu" creator badge — a designed pill with gradient, avatar dot and
// sparkle so the attribution feels like a real brand mark, not plain text.
export const AtanuBadge: React.FC<{ size?: 'sm' | 'md' }> = ({ size = 'sm' }) => {
  const sm = size === 'sm';
  return (
    <span
      title="Created by Atanu"
      className={`inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white font-bold shadow-sm ring-1 ring-white/40 ${
        sm ? 'px-2.5 py-1 text-[10px]' : 'px-3.5 py-1.5 text-xs'
      }`}
    >
      <span
        className={`flex items-center justify-center rounded-full bg-white/25 font-extrabold ${
          sm ? 'w-3.5 h-3.5 text-[9px]' : 'w-5 h-5 text-[11px]'
        }`}
      >
        @
      </span>
      Atanu
      <Sparkles className={`${sm ? 'w-3 h-3' : 'w-3.5 h-3.5'} text-amber-300`} />
    </span>
  );
};
