import React, { useState, useRef, useEffect } from 'react';
import { Download, ChevronDown, FileText, FileCode } from 'lucide-react';

interface DownloadCvDropdownProps {
  jobId: string;
  size?: 'sm' | 'md';
  buttonText?: string;
  className?: string;
}

export const DownloadCvDropdown: React.FC<DownloadCvDropdownProps> = ({
  jobId,
  size = 'sm',
  buttonText = 'Download CV',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isSmall = size === 'sm';

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        className={`rounded-md font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-all flex items-center space-x-1.5 shadow-xs cursor-pointer ${
          isSmall ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2 text-xs'
        }`}
        title="Download Tailored ATS CV"
      >
        <Download className={isSmall ? 'w-3.5 h-3.5 text-white' : 'w-4 h-4 text-white'} />
        <span>{buttonText}</span>
        <ChevronDown
          className={`transition-transform duration-200 ${isSmall ? 'w-3 h-3' : 'w-3.5 h-3.5'} ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div
          className="absolute right-0 mt-1 w-48 rounded-lg bg-white shadow-xl border border-slate-200 py-1 z-50 text-xs font-medium text-slate-800 animate-in fade-in zoom-in-95 duration-100"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-1.5 border-b border-slate-100 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            Download Format
          </div>

          <a
            href={`/api/jobs/${jobId}/download-docx`}
            download
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setIsOpen(false)}
            className="flex items-center space-x-2.5 px-3 py-2 hover:bg-slate-50 text-slate-800 hover:text-slate-900 transition-colors"
          >
            <FileText className="w-4 h-4 text-blue-600 shrink-0" />
            <div>
              <span className="font-bold block text-slate-900">Word (.DOCX)</span>
              <span className="text-[10px] text-slate-500 font-normal">Editable ATS Calibri</span>
            </div>
          </a>

          <a
            href={`/api/jobs/${jobId}/download-pdf`}
            download
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setIsOpen(false)}
            className="flex items-center space-x-2.5 px-3 py-2 hover:bg-slate-50 text-slate-800 hover:text-slate-900 transition-colors border-t border-slate-100"
          >
            <FileCode className="w-4 h-4 text-red-600 shrink-0" />
            <div>
              <span className="font-bold block text-slate-900">PDF (.PDF)</span>
              <span className="text-[10px] text-slate-500 font-normal">ATS Vector Document</span>
            </div>
          </a>
        </div>
      )}
    </div>
  );
};
