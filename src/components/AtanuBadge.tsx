import React from 'react';

const LINKEDIN_URL = 'https://www.linkedin.com/in/atanu-biswas-006796239/';

// "— Atanu" signature credit, handwritten style, linking to the creator's
// LinkedIn profile. Quiet, personal, no boxes or icons.
export const AtanuBadge: React.FC<{ tone?: 'light' | 'dark' }> = ({ tone = 'light' }) => {
  return (
    <a
      href={LINKEDIN_URL}
      target="_blank"
      rel="noopener noreferrer"
      title="Atanu on LinkedIn"
      className={`font-['Snell_Roundhand','Brush_Script_MT','Apple_Chancery',cursive] text-[13px] leading-none no-underline transition-opacity hover:opacity-70 ${
        tone === 'dark' ? 'text-slate-300' : 'text-slate-500'
      }`}
    >
      — Atanu
    </a>
  );
};
