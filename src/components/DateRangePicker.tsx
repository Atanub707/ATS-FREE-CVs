import React, { useMemo, useRef, useState } from 'react';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/style.css';
import { X, CalendarDays, Check } from 'lucide-react';

// One calendar — the user picks the START and END date on the same month
// grid (range mode), or marks the end as "Present". Dates are stored as
// display strings like "August 2024 – Present" (the format the CV renderers
// already consume), so no data model changes are needed.

const MONTHS: Record<string, string> = {
  jan: 'January', january: 'January',
  feb: 'February', february: 'February',
  mar: 'March', march: 'March',
  apr: 'April', april: 'April',
  may: 'May',
  jun: 'June', june: 'June',
  jul: 'July', july: 'July',
  aug: 'August', august: 'August',
  sep: 'September', sept: 'September', september: 'September',
  oct: 'October', october: 'October',
  nov: 'November', november: 'November',
  dec: 'December', december: 'December',
};

function parseMonthYear(token: string): Date | null {
  const m = token.trim().match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (!m) return null;
  const month = MONTHS[m[1].toLowerCase()];
  if (!month) return null;
  return new Date(Number(m[2]), Object.values(MONTHS).indexOf(month), 1);
}

interface ParsedRange {
  from: Date | null;
  to: Date | null;
  present: boolean;
}

function parseValue(value: string): ParsedRange {
  const match = String(value || '').trim().match(/^(.+?)\s*[-–]\s*(.+)$/);
  if (!match) return { from: null, to: null, present: false };
  const from = parseMonthYear(match[1]);
  const endRaw = match[2].trim();
  if (/^present$/i.test(endRaw)) return { from, to: null, present: true };
  return { from, to: parseMonthYear(endRaw), present: false };
}

function formatRange(range: ParsedRange): string {
  const fmt = (d: Date | null) => (d ? `${MONTHS[Object.keys(MONTHS).find((k) => MONTHS[k] === d.toLocaleString('en', { month: 'long' }))!] || d.toLocaleString('en', { month: 'long' })} ${d.getFullYear()}` : '');
  if (!range.from) return '';
  return `${fmt(range.from)} – ${range.present ? 'Present' : fmt(range.to) || ''}`.trim();
}

interface DateRangePickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({ value, onChange, placeholder = 'Pick start & end date' }) => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const parsed = useMemo(() => parseValue(value), [value]);
  const [draft, setDraft] = useState<ParsedRange>(parsed);
  const [draftPresent, setDraftPresent] = useState(parsed.present);

  const openPicker = () => {
    setDraft(parsed);
    setDraftPresent(parsed.present);
    setOpen(true);
  };

  const apply = () => {
    onChange(formatRange({ ...draft, present: draftPresent }));
    setOpen(false);
  };

  const clear = () => {
    onChange('');
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={openPicker}
        className="w-full flex items-center justify-between gap-2 border border-slate-200 rounded px-2 py-1 text-slate-900 text-left cursor-pointer hover:border-blue-300 transition-colors"
      >
        <span className={value ? 'text-slate-900' : 'text-slate-400'}>{value || placeholder}</span>
        <CalendarDays className="w-3.5 h-3.5 text-slate-400 shrink-0" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1.5 z-50 bg-white border border-slate-200 rounded-xl shadow-xl p-3 w-[300px]">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
              Pick start date, then end date
            </p>
            <DayPicker
              mode="range"
              selected={draft.from && draft.to ? { from: draft.from, to: draft.to } : draft.from ? { from: draft.from, to: draft.from } : undefined}
              onSelect={(range) => {
                setDraft({ from: range?.from ?? null, to: range?.to ?? null, present: false });
                if (range?.to) setDraftPresent(false);
              }}
              defaultMonth={draft.from || undefined}
            />
            <label className="flex items-center gap-2 mt-2 text-[12px] font-semibold text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={draftPresent}
                onChange={(e) => setDraftPresent(e.target.checked)}
                className="accent-blue-600 w-3.5 h-3.5 cursor-pointer"
              />
              Currently working here (Present)
            </label>
            <div className="flex items-center gap-2 mt-3">
              <button
                type="button"
                onClick={apply}
                className="flex-1 inline-flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg px-3 py-1.5 text-[12px] font-bold cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" /> Apply
              </button>
              <button
                type="button"
                onClick={clear}
                className="inline-flex items-center justify-center gap-1 text-slate-500 hover:text-red-600 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold cursor-pointer"
              >
                <X className="w-3.5 h-3.5" /> Clear
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
