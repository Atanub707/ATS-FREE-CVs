import React, { useRef, useState } from 'react';
import { X, Plus } from 'lucide-react';
import { SKILLS } from '../constants/suggestions';

// Chip-based skill input: typing a skill and pressing comma (or Enter)
// converts it into a boxed tag with a × to remove it. While typing, the
// bundled skill dataset (src/constants/suggestions.ts — 1,500+ predefined
// skills) powers the suggestion dropdown.

interface TagInputProps {
  value: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
}

export const TagInput: React.FC<TagInputProps> = ({ value, onChange, placeholder = 'Type a skill and press comma (,) or Enter…' }) => {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = (raw: string) => {
    const item = raw.trim();
    if (!item) return;
    const existing = value.some((v) => v.toLowerCase() === item.toLowerCase());
    if (existing) { setText(''); return; }
    onChange([...value, item]);
    setText('');
    setOpen(false);
    inputRef.current?.focus();
  };

  const remove = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx));
  };

  const suggestions = text.trim().length > 0
    ? SKILLS.filter((s) => s.toLowerCase().includes(text.trim().toLowerCase())).slice(0, 8)
    : [];

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === ',' || e.key === 'Enter') {
      e.preventDefault();
      commit(text);
    } else if (e.key === 'Backspace' && text === '' && value.length > 0) {
      remove(value.length - 1);
    }
  };

  return (
    <div className="relative flex-1">
      <div
        onClick={() => inputRef.current?.focus()}
        className="flex flex-wrap items-center gap-1.5 border border-slate-200 rounded px-2 py-1 min-h-[32px] cursor-text"
      >
        {value.map((item, idx) => (
          <span
            key={`${item}-${idx}`}
            className="inline-flex items-center gap-1 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg px-2 py-0.5 text-[12px] font-semibold max-w-full"
          >
            <span className="truncate">{item}</span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); remove(idx); }}
              aria-label={`Remove ${item}`}
              className="text-blue-400 hover:text-red-600 cursor-pointer shrink-0"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => { setText(e.target.value); setOpen(true); }}
          onKeyDown={onKeyDown}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={value.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[120px] border-none outline-none text-[13px] text-slate-800 bg-transparent py-0.5"
        />
      </div>

      {open && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-white border border-slate-200 rounded-lg shadow-lg py-1 max-h-56 overflow-y-auto">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); commit(s); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-[12.5px] text-slate-700 hover:bg-blue-50 text-left cursor-pointer"
            >
              <Plus className="w-3 h-3 text-blue-500 shrink-0" />
              <span className="truncate">{s}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
