import React from 'react';

const LINKEDIN_URL = 'https://www.linkedin.com/in/atanu-biswas-006796239/';

const SCRIPT_FONT = '"Snell Roundhand", "Brush Script MT", "Apple Chancery", cursive';

// Two-line creator credit: tiny uppercase "created by" over a large
// handwritten signature, linking to the creator's LinkedIn.
export const AtanuBadge: React.FC<{ tone?: 'light' | 'dark' }> = ({ tone = 'light' }) => {
  return (
    <a
      href={LINKEDIN_URL}
      target="_blank"
      rel="noopener noreferrer"
      title="Atanu on LinkedIn"
      className="flex flex-col items-start leading-none no-underline transition-opacity hover:opacity-70"
    >
      <span
        className={`text-[8px] font-semibold uppercase tracking-[0.14em] ${
          tone === 'dark' ? 'text-slate-500' : 'text-slate-400'
        }`}
      >
        created by
      </span>
      <span
        style={{ fontFamily: SCRIPT_FONT }}
        className={`text-[22px] font-semibold leading-none mt-0.5 ${
          tone === 'dark' ? 'text-slate-100' : 'text-slate-800'
        }`}
      >
        Atanu
      </span>
    </a>
  );
};
