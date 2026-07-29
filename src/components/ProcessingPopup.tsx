import React, { useEffect } from 'react';
import { Loader2, CheckCircle2 } from 'lucide-react';

export interface ProcessingStep {
  label: string;
}

export interface ProcessingConfig {
  title: string;
  steps: ProcessingStep[];
}

interface ProcessingPopupProps {
  config: ProcessingConfig | null;
  currentStep: number;
  onClose: () => void;
}

export const ProcessingPopup: React.FC<ProcessingPopupProps> = ({ config, currentStep, onClose }) => {
  if (!config) return null;

  const isDone = currentStep >= config.steps.length;

  useEffect(() => {
    if (isDone) {
      const t = setTimeout(onClose, 1500);
      return () => clearTimeout(t);
    }
  }, [isDone, onClose]);

  if (!config) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl px-7 py-6 w-[340px] max-w-[90vw] animate-[popIn_0.2s_ease]">
        <style>{`
          @keyframes popIn { from { opacity:0; transform:scale(0.92); } to { opacity:1; transform:scale(1); } }
        `}</style>

        <div className="flex items-center gap-2.5 mb-4">
          {isDone ? (
            <CheckCircle2 className="w-4.5 h-4.5 text-emerald-500" />
          ) : (
            <Loader2 className="w-4.5 h-4.5 text-indigo-500 animate-spin" />
          )}
          <span className="text-sm font-bold text-slate-900">{isDone ? 'Complete' : config.title}</span>
        </div>

        <div className="space-y-1 mb-4">
          {config.steps.map((step, i) => {
            let stateClass = 'text-slate-300';
            if (i < currentStep) stateClass = 'text-emerald-600 bg-emerald-50';
            else if (i === currentStep && !isDone) stateClass = 'text-indigo-600 bg-indigo-50';
            else stateClass = 'text-slate-300';

            return (
              <div key={i} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${stateClass}`}>
                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${
                  i < currentStep
                    ? 'bg-emerald-500 text-white'
                    : i === currentStep && !isDone
                      ? 'border-2 border-indigo-400 text-indigo-500'
                      : 'border-2 border-slate-200 text-slate-300'
                }`}>
                  {i < currentStep ? '✓' : i === currentStep && !isDone ? '⟳' : '○'}
                </span>
                <span>{step.label}</span>
              </div>
            );
          })}
        </div>

        <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, (currentStep / config.steps.length) * 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
};
