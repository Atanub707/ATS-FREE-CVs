import React, { useState, useRef, useEffect } from 'react';
import { X, PaperPlaneTilt, Sparkle, ArrowSquareOut, ChatCircleDots, CheckCircle, FileCsv, ArrowSquareIn, DotsThree } from '@phosphor-icons/react';

interface JobCard {
  id: string;
  title?: string;
  company?: string;
  location?: string;
  source?: string;
  url?: string;
  score?: number;
  reason?: string;
}

interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
  jobs?: JobCard[];
}

interface ChatPanelProps {
  onClose: () => void;
}

const SUGGESTIONS = [
  'Show me 5 remote DevOps jobs',
  'Which jobs fit my skills best?',
  'Find jobs in Bengaluru',
  'What should I add to my CV?',
];

const THINKING_STEPS = ['Searching your scraped jobs…', 'Scoring the best matches…', 'Writing your reasons…'];

const APPLY_STEPS = ['Opening all postings…', 'Building your tracking CSV…', 'Done — CSV downloaded'];

export const ChatPanel: React.FC<ChatPanelProps> = ({ onClose }) => {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [thinkStep, setThinkStep] = useState(0);
  const [applying, setApplying] = useState(false);
  const [applyStep, setApplyStep] = useState(-1);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, busy, thinkStep]);

  // rotate the "thinking" status line while busy
  useEffect(() => {
    if (!busy) return;
    setThinkStep(0);
    const id = setInterval(() => setThinkStep((s) => (s + 1) % THINKING_STEPS.length), 2600);
    return () => clearInterval(id);
  }, [busy]);

  const send = async (raw?: string) => {
    const text = (raw ?? input).trim();
    if (!text || busy) return;
    setError(null);
    const history: ChatMsg[] = [...messages, { role: 'user', content: text }];
    setMessages(history);
    setInput('');
    setBusy(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || 'Chat failed.');
        return;
      }
      setMessages((m) => [...m, { role: 'assistant', content: data.reply || '…', jobs: data.jobs || [] }]);
    } catch (e: any) {
      setError(e?.message || 'Could not reach the assistant.');
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = (jobs: JobCard[]) => {
    const esc = (v: string | null | undefined) => {
      const s = v ?? '';
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [
      'Title,Company,Location,Source,Score,Reason,URL',
      ...jobs.map((j) => [j.title, j.company, j.location, j.source, j.score ?? '', j.reason, j.url].map(esc).join(',')),
    ];
    const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'tailor-cv-applications.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const applyAll = (jobs: JobCard[]) => {
    if (applying) return;
    setApplying(true);
    setApplyStep(0);
    // Step 0: open each posting (staggered so the user sees them fly out)
    jobs.forEach((j, i) => {
      if (!j.url) return;
      setTimeout(() => window.open(j.url, '_blank', 'noopener'), i * 350);
    });
    setTimeout(() => setApplyStep(1), Math.max(1200, jobs.length * 350 + 300));
    setTimeout(() => {
      exportCsv(jobs);
      setApplyStep(2);
    }, Math.max(2200, jobs.length * 350 + 1200));
    setTimeout(() => {
      setApplying(false);
      setApplyStep(-1);
    }, 5200);
  };

  const hasChat = messages.length > 0;

  return (
    <div className="chat-screen">
      <header className="chat-hdr">
        <div className="chat-botmini"><ChatCircleDots size={16} weight="fill" /></div>
        <div className="chat-ttl">
          <b>AI Assistant</b>
          <span>Your job copilot — searches your scraped jobs via MCP tools</span>
        </div>
        <div className="chat-spacer" />
        <button className="chat-x" onClick={onClose} aria-label="Close chat"><X size={17} /></button>
      </header>

      <div className="chat-body">
        {!hasChat ? (
          <div className="chat-hero">
            <div className="chat-bot" aria-hidden="true">
              <span className="chat-bot-ant"><i></i></span>
              <span className="chat-bot-eye"></span>
              <span className="chat-bot-eye"></span>
              <span className="chat-bot-mouth"></span>
            </div>
            <h2>Your Job Copilot</h2>
            <p>Ask me anything about your scraped jobs — I'll search, score and explain why each one fits your CV.</p>
            <div className="chat-suggestions">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="chat-chip" onClick={() => send(s)}>
                  <Sparkle size={13} weight="fill" /> {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`chat-msg ${m.role}`}>
              {m.role === 'assistant' && <span className="chat-msg-av" aria-hidden="true"><ChatCircleDots size={13} weight="fill" /></span>}
              <div className="chat-bubble">
                {m.content}
                {m.jobs && m.jobs.length > 0 && (
                  <div className="chat-jobs">
                    <div className="chat-jobs-hdr">
                      <span className="chat-jobs-count">{m.jobs.length} results</span>
                      <button className="chat-applyall" onClick={() => applyAll(m.jobs!)} disabled={applying}>
                        {applying ? <DotsThree size={13} weight="bold" /> : <Sparkle size={12} weight="bold" />} Apply All
                      </button>
                    </div>
                    {m.jobs.map((j, idx) => (
                      <div key={j.id} className="chat-job" style={{ animationDelay: `${idx * 90}ms` }}>
                        <div className="chat-job-top">
                          <span className="chat-job-title">{j.title || j.id}</span>
                          {j.score != null && (
                            <span className="chat-job-score">
                              <span className="chat-job-ring" style={{ '--p': `${j.score}%` } as React.CSSProperties}></span>
                              {j.score}%
                            </span>
                          )}
                        </div>
                        <div className="chat-job-meta">
                          {j.company} {j.location ? `· ${j.location}` : ''} {j.source ? `· ${j.source}` : ''}
                        </div>
                        {j.reason && <div className="chat-job-reason">{j.reason}</div>}
                        {j.url && (
                          <a className="chat-job-open" href={j.url} target="_blank" rel="noreferrer">
                            Open posting <ArrowSquareOut size={11} />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))
        )}

        {busy && (
          <div className="chat-msg assistant">
            <span className="chat-msg-av" aria-hidden="true"><ChatCircleDots size={13} weight="fill" /></span>
            <div className="chat-bubble chat-typing">
              <span className="chat-typing-dots" aria-hidden="true"><i></i><i></i><i></i></span>
              <span className="chat-typing-label">{THINKING_STEPS[thinkStep]}</span>
            </div>
          </div>
        )}

        {applying && (
          <div className="chat-pipeline" role="status">
            <div className="chat-pipe-title">
              <Sparkle size={14} weight="fill" /> Applying — watch the steps
            </div>
            {APPLY_STEPS.map((label, i) => (
              <div key={i} className={`chat-pipe-step ${i === applyStep ? 'active' : i < applyStep ? 'done' : ''}`}>
                <span className="chat-pipe-ico">
                  {i < applyStep ? <CheckCircle size={14} weight="fill" /> : i === 0 ? <ArrowSquareIn size={14} /> : i === 1 ? <FileCsv size={14} /> : <CheckCircle size={14} />}
                </span>
                <span className="chat-pipe-label">{label}</span>
                {i === applyStep && <span className="chat-pipe-spin" aria-hidden="true"></span>}
              </div>
            ))}
          </div>
        )}

        {error && <div className="chat-error">{error}</div>}
        <div ref={endRef} />
      </div>

      <div className="chat-inputrow">
        <div className="chat-inputwrap">
          <input
            className="chat-input"
            placeholder={hasChat ? 'Ask anything about your jobs…' : 'Ask for jobs — e.g. 5 remote DevOps roles from LinkedIn'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); send(); } }}
            disabled={busy}
            aria-label="Ask the AI assistant"
          />
          <button className="chat-send" onClick={() => send()} disabled={busy || !input.trim()} aria-label="Send">
            <PaperPlaneTilt size={15} weight="bold" />
          </button>
        </div>
      </div>

      <style>{`
        .chat-screen {
          position: fixed; inset: 0; z-index: 55; background: var(--bg, #F9FAFB); color: var(--ink, #0F172A);
          display: flex; flex-direction: column; font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
        }
        .chat-hdr { display: flex; align-items: center; gap: 12px; padding: 0 24px; height: 60px; border-bottom: 1px solid var(--line, #E2E8F0); background: var(--card, #fff); flex-shrink: 0; }
        .chat-botmini { width: 32px; height: 32px; border-radius: 10px; background: linear-gradient(135deg, var(--brand, #2563EB), #7C3AED); color: #fff; display: flex; align-items: center; justify-content: center; }
        .chat-ttl b { font-size: 14.5px; font-weight: 800; display: block; line-height: 1.2; }
        .chat-ttl span { font-size: 11px; color: var(--faint, #64748B); font-weight: 500; }
        .chat-spacer { flex: 1; }
        .chat-x { border: 0; background: none; color: var(--faint, #64748B); cursor: pointer; padding: 6px; border-radius: 8px; display: inline-flex; }
        .chat-x:hover { background: #F1F5F9; color: var(--ink, #0F172A); }

        .chat-body { flex: 1; overflow-y: auto; padding: 26px 24px 18px; display: flex; flex-direction: column; gap: 14px; max-width: 820px; width: 100%; margin: 0 auto; }
        .chat-hero { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 6px; padding-bottom: 30px; }
        .chat-bot { position: relative; width: 96px; height: 96px; border-radius: 50%; background: linear-gradient(135deg, var(--brand, #2563EB), #7C3AED); box-shadow: 0 18px 50px -12px rgba(37,99,235,.55), inset 0 2px 0 rgba(255,255,255,.35); display: flex; align-items: center; justify-content: center; gap: 16px; margin-bottom: 20px; animation: botIn .5s ease-out both; }
        .chat-bot-ant { position: absolute; top: -14px; left: 50%; transform: translateX(-50%); width: 4px; height: 14px; border-radius: 2px; background: rgba(37,99,235,.4); }
        .chat-bot-ant i { display: block; width: 8px; height: 8px; border-radius: 50%; background: #7C3AED; margin: -10px auto 0; animation: botPulse 2s ease-in-out infinite; }
        .chat-bot-eye { width: 14px; height: 16px; border-radius: 50%; background: #fff; position: relative; animation: botBlink 4.5s infinite; }
        .chat-bot-eye::after { content: ''; position: absolute; left: 3px; bottom: 3px; width: 8px; height: 9px; border-radius: 50%; background: var(--ink, #0F172A); }
        .chat-bot-mouth { position: absolute; bottom: 26px; width: 22px; height: 9px; border-bottom: 3px solid #fff; border-radius: 0 0 14px 14px; }
        @keyframes botIn { from { opacity: 0; transform: scale(.7); } to { opacity: 1; transform: scale(1); } }
        @keyframes botBlink { 0%, 92%, 100% { transform: scaleY(1); } 95% { transform: scaleY(.1); } }
        @keyframes botPulse { 0%, 100% { opacity: .5; transform: scale(1); } 50% { opacity: 1; transform: scale(1.4); } }
        .chat-hero h2 { font-size: 24px; font-weight: 800; letter-spacing: -.03em; }
        .chat-hero p { font-size: 13.5px; color: var(--muted, #475569); max-width: 440px; line-height: 1.65; margin-bottom: 22px; }
        .chat-suggestions { display: flex; flex-wrap: wrap; gap: 9px; justify-content: center; max-width: 520px; }
        .chat-chip { display: inline-flex; align-items: center; gap: 7px; font-size: 12.5px; font-weight: 700; color: var(--muted, #475569); background: var(--card, #fff); border: 1px solid var(--line, #E2E8F0); border-radius: 999px; padding: 9px 16px; cursor: pointer; transition: all .2s ease; }
        .chat-chip:hover { border-color: var(--brand, #2563EB); color: var(--brand, #2563EB); box-shadow: 0 4px 14px -6px rgba(37,99,235,.25); }

        .chat-msg { display: flex; gap: 10px; align-items: flex-start; animation: msgIn .35s ease-out both; }
        .chat-msg.user { justify-content: flex-end; }
        @keyframes msgIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        .chat-msg-av { width: 28px; height: 28px; border-radius: 9px; background: linear-gradient(135deg, var(--brand, #2563EB), #7C3AED); color: #fff; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px; }
        .chat-bubble { max-width: 82%; padding: 12px 16px; border-radius: 14px; font-size: 13.5px; line-height: 1.65; white-space: pre-wrap; }
        .chat-msg.user .chat-bubble { background: var(--brand, #2563EB); color: #fff; border-bottom-right-radius: 4px; }
        .chat-msg.assistant .chat-bubble { background: var(--card, #fff); border: 1px solid var(--line, #E2E8F0); border-bottom-left-radius: 4px; }

        .chat-typing { color: var(--faint, #64748B); display: inline-flex; align-items: center; gap: 10px; }
        .chat-typing-dots { display: inline-flex; gap: 4px; }
        .chat-typing-dots i { width: 6px; height: 6px; border-radius: 50%; background: var(--brand, #2563EB); animation: chatdot 1.2s ease-in-out infinite; }
        .chat-typing-dots i:nth-child(2) { animation-delay: .18s; }
        .chat-typing-dots i:nth-child(3) { animation-delay: .36s; }
        @keyframes chatdot { 0%, 100% { opacity: .25; transform: translateY(0); } 50% { opacity: 1; transform: translateY(-3px); } }
        .chat-typing-label { font-size: 12px; font-weight: 600; }

        .chat-error { align-self: center; font-size: 12px; font-weight: 700; color: var(--danger, #DC2626); background: #FEF2F2; border: 1px solid #FECACA; border-radius: 10px; padding: 9px 14px; }

        .chat-jobs { margin-top: 13px; display: flex; flex-direction: column; gap: 9px; }
        .chat-jobs-hdr { display: flex; align-items: center; justify-content: space-between; margin-bottom: 2px; }
        .chat-jobs-count { font-size: 11px; font-weight: 800; color: var(--faint, #64748B); text-transform: uppercase; letter-spacing: .08em; }
        .chat-applyall { display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; font-weight: 800; color: #fff; background: linear-gradient(135deg, var(--brand, #2563EB), var(--brand-strong, #1D4ED8)); border: 0; border-radius: 8px; padding: 6px 13px; cursor: pointer; transition: filter .2s ease; }
        .chat-applyall:hover { filter: brightness(1.08); }
        .chat-applyall:disabled { opacity: .55; cursor: not-allowed; }
        .chat-job { border: 1px solid var(--line, #E2E8F0); border-radius: 11px; padding: 11px 13px; background: #FAFAF9; animation: jobIn .4s ease-out both; }
        @keyframes jobIn { from { opacity: 0; transform: translateY(10px) scale(.98); } to { opacity: 1; transform: none; } }
        .chat-job-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .chat-job-title { font-size: 12.5px; font-weight: 800; color: var(--ink, #0F172A); }
        .chat-job-score { display: inline-flex; align-items: center; gap: 6px; font-size: 10.5px; font-weight: 800; color: #047857; background: #ECFDF5; border: 1px solid #A7F3D0; border-radius: 999px; padding: 2px 9px 2px 4px; flex-shrink: 0; }
        .chat-job-ring { width: 18px; height: 18px; border-radius: 50%; background: conic-gradient(#059669 var(--p), #E2E8F0 0); display: inline-flex; align-items: center; justify-content: center; }
        .chat-job-ring::after { content: ''; width: 12px; height: 12px; border-radius: 50%; background: #FAFAF9; }
        .chat-job-meta { font-size: 11px; color: var(--faint, #64748B); margin-top: 2px; }
        .chat-job-reason { font-size: 11.5px; color: var(--muted, #475569); margin-top: 5px; line-height: 1.5; }
        .chat-job-open { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 700; color: var(--brand, #2563EB); text-decoration: none; margin-top: 6px; }

        .chat-pipeline { align-self: center; width: 100%; max-width: 380px; background: var(--card, #fff); border: 1px solid var(--line, #E2E8F0); border-radius: 14px; padding: 14px 16px; box-shadow: 0 10px 30px -12px rgba(15,23,42,.15); animation: jobIn .35s ease-out both; }
        .chat-pipe-title { font-size: 12px; font-weight: 800; display: flex; align-items: center; gap: 7px; margin-bottom: 11px; color: var(--ink, #0F172A); }
        .chat-pipe-title svg { color: var(--brand, #2563EB); }
        .chat-pipe-step { display: flex; align-items: center; gap: 10px; padding: 7px 0; font-size: 12.5px; font-weight: 600; color: var(--faint, #64748B); transition: color .2s ease; }
        .chat-pipe-step.active { color: var(--ink, #0F172A); }
        .chat-pipe-step.done { color: #047857; }
        .chat-pipe-ico { display: inline-flex; width: 22px; }
        .chat-pipe-step.done .chat-pipe-ico svg { color: #059669; animation: popIn .3s ease-out both; }
        @keyframes popIn { from { transform: scale(0); } to { transform: scale(1); } }
        .chat-pipe-spin { width: 14px; height: 14px; margin-left: auto; border-radius: 50%; border: 2px solid var(--brand-line, #BFDBFE); border-top-color: var(--brand, #2563EB); animation: chatspin .8s linear infinite; }
        @keyframes chatspin { to { transform: rotate(360deg); } }

        .chat-inputrow { display: flex; justify-content: center; padding: 14px 24px 20px; border-top: 1px solid var(--line, #E2E8F0); background: var(--card, #fff); flex-shrink: 0; }
        .chat-inputwrap { position: relative; width: 100%; max-width: 720px; }
        .chat-input { width: 100%; border: 1.5px solid var(--line2, #CBD5E1); border-radius: 14px; padding: 13px 52px 13px 16px; font-size: 13.5px; font-family: inherit; color: var(--ink, #0F172A); outline: none; transition: border-color .2s ease, box-shadow .2s ease; background: var(--bg, #F9FAFB); }
        .chat-input:focus { border-color: var(--brand, #2563EB); box-shadow: 0 0 0 4px rgba(37,99,235,.1); background: #fff; }
        .chat-send { position: absolute; right: 6px; top: 50%; transform: translateY(-50%); width: 38px; height: 38px; border-radius: 11px; border: 0; background: linear-gradient(135deg, var(--brand, #2563EB), var(--brand-strong, #1D4ED8)); color: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: filter .2s ease; }
        .chat-send:hover { filter: brightness(1.08); }
        .chat-send:disabled { opacity: .5; cursor: not-allowed; }
      `}</style>
    </div>
  );
};
