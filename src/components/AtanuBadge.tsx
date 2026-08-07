import React from 'react';

// "by Atanu" creator credit — typographic, restrained, like a book
// colophon. No boxes, no icons, no gradients: just a quiet credit line
// that lets the product name carry the visual weight.
export const AtanuBadge: React.FC<{ tone?: 'light' | 'dark' }> = ({ tone = 'light' }) => {
  return (
    <span
      title="Created by Atanu"
      className={`inline-flex items-baseline gap-1.5 text-[10px] font-normal tracking-wide ${
        tone === 'dark' ? 'text-slate-500' : 'text-slate-400'
      }`}
    >
      by
      <span
        className={`font-serif italic font-semibold ${
          tone === 'dark' ? 'text-slate-200' : 'text-slate-700'
        }`}
      >
        Atanu
      </span>
    </span>
  );
};
