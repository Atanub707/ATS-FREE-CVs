import React, { useState, useRef, useEffect } from 'react';
import { X, PaperPlaneTilt, Sparkle, ArrowSquareOut, CircleNotch, ChatCircleDots } from '@phosphor-icons/react';

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

export const ChatPanel: React.FC<ChatPanelProps> = ({ onClose }) => {
  const [messages, setMessages] = useState<ChatMsg[]>([
    { role: 'assistant', content: "Hi! I'm your job copilot. Ask me things like: \"Show me 5 remote DevOps jobs from LinkedIn\" — I'll search your scraped jobs and explain why each fits." },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, busy]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setError(null);
    const history = [...messages, { role: 'user' as const, content: text }];
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

  const applyAll = (jobs: JobCard[]) => {
    jobs.forEach((j) => {
      if (j.url) window.open(j.url, '_blank', 'noopener');
    });
  };

  return (
    <div className="chat-screen">
      <header className="chat-hdr">
        <span className="chat-ico"><ChatCircleDots size={18} weight="duotone" /></span>
        <div className="chat-ttl">
          <b>AI Assistant</b>
          <span>Your job copilot — searches your scraped jobs via MCP tools</span>
        </div>
        <div className="chat-spacer" />
        <button className="chat-x" onClick={onClose} aria-label="Close chat"><X size={17} /></button>
      </header>

      <div className="chat-body">
        {messages.map((m, i) => (
          <div key={i} className={`chat-msg ${m.role}`}>
            <div className="chat-bubble">
              {m.content}
              {m.jobs && m.jobs.length > 0 && (
                <div className="chat-jobs">
                  <div className="chat-jobs-hdr">
                    <span className="chat-jobs-count">{m.jobs.length} results</span>
                    <button className="chat-applyall" onClick={() => applyAll(m.jobs!)} disabled={busy}>
                      <Sparkle size={12} weight="bold" /> Apply All
                    </button>
                  </div>
                  {m.jobs.map((j) => (
                    <div key={j.id} className="chat-job">
                      <div className="chat-job-top">
                        <span className="chat-job-title">{j.title || j.id}</span>
                        {j.score != null && <span className="chat-job-score">{j.score}%</span>}
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
        ))}
        {busy && (
          <div className="chat-msg assistant">
            <div className="chat-bubble chat-typing">
              <CircleNotch size={14} className="spin" /> Thinking…
            </div>
          </div>
        )}
        {error && <div className="chat-error">{error}</div>}
        <div ref={endRef} />
      </div>

      <div className="chat-inputrow">
        <input
          className="chat-input"
          placeholder="Ask for jobs — e.g. 5 remote DevOps roles from LinkedIn"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); send(); } }}
          disabled={busy}
        />
        <button className="chat-send" onClick={send} disabled={busy || !input.trim()} aria-label="Send">
          <PaperPlaneTilt size={15} weight="bold" />
        </button>
      </div>

      <style>{`
        .chat-screen {
          position: fixed; inset: 0; z-index: 55; background: var(--bg, #F9FAFB); color: var(--ink, #0F172A);
          display: flex; flex-direction: column; font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
        }
        .chat-hdr { display: flex; align-items: center; gap: 12px; padding: 0 24px; height: 60px; border-bottom: 1px solid var(--line, #E2E8F0); background: var(--card, #fff); flex-shrink: 0; }
        .chat-ico { width: 34px; height: 34px; border-radius: 10px; background: linear-gradient(135deg, var(--brand, #2563EB), #7C3AED); color: #fff; display: flex; align-items: center; justify-content: center; }
        .chat-ttl b { font-size: 14.5px; font-weight: 800; display: block; line-height: 1.2; }
        .chat-ttl span { font-size: 11px; color: var(--faint, #64748B); font-weight: 500; }
        .chat-spacer { flex: 1; }
        .chat-x { border: 0; background: none; color: var(--faint, #64748B); cursor: pointer; padding: 6px; border-radius: 8px; display: inline-flex; }
        .chat-x:hover { background: #F1F5F9; color: var(--ink, #0F172A); }
        .chat-body { flex: 1; overflow-y: auto; padding: 22px 24px; display: flex; flex-direction: column; gap: 12px; max-width: 860px; width: 100%; margin: 0 auto; }
        .chat-msg { display: flex; }
        .chat-msg.user { justify-content: flex-end; }
        .chat-bubble { max-width: 78%; padding: 11px 15px; border-radius: 14px; font-size: 13.5px; line-height: 1.6; white-space: pre-wrap; }
        .chat-msg.user .chat-bubble { background: var(--brand, #2563EB); color: #fff; border-bottom-right-radius: 4px; }
        .chat-msg.assistant .chat-bubble { background: var(--card, #fff); border: 1px solid var(--line, #E2E8F0); border-bottom-left-radius: 4px; }
        .chat-typing { color: var(--faint, #64748B); display: inline-flex; align-items: center; gap: 8px; }
        .spin { animation: chatspin .8s linear infinite; }
        @keyframes chatspin { to { transform: rotate(360deg); } }
        .chat-error { align-self: center; font-size: 12px; font-weight: 700; color: var(--danger, #DC2626); background: #FEF2F2; border: 1px solid #FECACA; border-radius: 10px; padding: 9px 14px; }
        .chat-jobs { margin-top: 12px; display: flex; flex-direction: column; gap: 9px; }
        .chat-jobs-hdr { display: flex; align-items: center; justify-content: space-between; margin-bottom: 2px; }
        .chat-jobs-count { font-size: 11px; font-weight: 800; color: var(--faint, #64748B); text-transform: uppercase; letter-spacing: .08em; }
        .chat-applyall { display: inline-flex; align-items: center; gap: 5px; font-size: 11.5px; font-weight: 800; color: #fff; background: linear-gradient(135deg, var(--brand, #2563EB), var(--brand-strong, #1D4ED8)); border: 0; border-radius: 8px; padding: 6px 12px; cursor: pointer; }
        .chat-applyall:disabled { opacity: .5; cursor: not-allowed; }
        .chat-job { border: 1px solid var(--line, #E2E8F0); border-radius: 11px; padding: 10px 12px; background: #FAFAF9; }
        .chat-job-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .chat-job-title { font-size: 12.5px; font-weight: 800; color: var(--ink, #0F172A); }
        .chat-job-score { font-size: 10.5px; font-weight: 800; color: #047857; background: #ECFDF5; border: 1px solid #A7F3D0; border-radius: 999px; padding: 1px 8px; flex-shrink: 0; }
        .chat-job-meta { font-size: 11px; color: var(--faint, #64748B); margin-top: 2px; }
        .chat-job-reason { font-size: 11.5px; color: var(--muted, #475569); margin-top: 5px; line-height: 1.5; }
        .chat-job-open { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 700; color: var(--brand, #2563EB); text-decoration: none; margin-top: 6px; }
        .chat-inputrow { display: flex; gap: 10px; padding: 14px 24px 18px; border-top: 1px solid var(--line, #E2E8F0); background: var(--card, #fff); max-width: 860px; width: 100%; margin: 0 auto; flex-shrink: 0; }
        .chat-input { flex: 1; border: 1.5px solid var(--line2, #CBD5E1); border-radius: 11px; padding: 11px 14px; font-size: 13.5px; font-family: inherit; color: var(--ink, #0F172A); outline: none; }
        .chat-input:focus { border-color: var(--brand, #2563EB); box-shadow: 0 0 0 3px rgba(37,99,235,.12); }
        .chat-send { width: 44px; height: 44px; border-radius: 11px; border: 0; background: linear-gradient(135deg, var(--brand, #2563EB), var(--brand-strong, #1D4ED8)); color: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; }
        .chat-send:disabled { opacity: .5; cursor: not-allowed; }
      `}</style>
    </div>
  );
};
