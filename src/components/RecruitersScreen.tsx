import React, { useCallback, useEffect, useState } from 'react';
import { X, Search, CheckCircle2, Copy, Trash2, Mail, ExternalLink } from 'lucide-react';

interface Contact {
  id: string;
  email: string;
  name: string | null;
  type: string;
  typeLabel: string;
  company: string;
  jobRole: string;
  sourceJobId: string;
  sourceJobUrl: string;
  jobCount: number;
  context: string;
  firstSeen: string;
  lastSeen: string;
}

interface RecruitersScreenProps {
  isOpen: boolean;
  onClose: () => void;
}

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg,#2563EB,#7C3AED)',
  'linear-gradient(135deg,#F59E0B,#EF4444)',
  'linear-gradient(135deg,#10B981,#0EA5E9)',
];

export const RecruitersScreen: React.FC<RecruitersScreenProps> = ({ isOpen, onClose }) => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [companies, setCompanies] = useState<string[]>([]);
  const [q, setQ] = useState('');
  const [company, setCompany] = useState('');
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/contacts');
      const data = await res.json();
      if (res.ok) {
        setContacts(data.contacts || []);
        setCompanies(data.companies || []);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!isOpen) return null;

  const showToast = (text: string) => {
    setToast(text);
    setTimeout(() => setToast(null), 2000);
  };

  const copyEmail = async (c: Contact) => {
    try {
      await navigator.clipboard.writeText(c.email);
      setCopiedId(c.id);
      setTimeout(() => setCopiedId(null), 1400);
      showToast(`${c.email} copied`);
    } catch { showToast('Could not copy — select manually'); }
  };

  const copyAll = async () => {
    const emails = contacts.map((c) => c.email);
    if (emails.length === 0) return;
    try {
      await navigator.clipboard.writeText(emails.join('\n'));
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 1800);
      showToast(`${emails.length} emails copied to clipboard`);
    } catch { showToast('Could not copy'); }
  };

  const hideContact = async (id: string) => {
    const prev = contacts;
    setContacts((c) => c.filter((x) => x.id !== id));
    try {
      await fetch(`/api/contacts/${id}/hide`, { method: 'POST' });
      showToast('Contact dismissed');
    } catch {
      setContacts(prev);
      showToast('Could not dismiss');
    }
  };

  const ql = q.trim().toLowerCase();
  const visible = contacts.filter(
    (c) =>
      (!company || c.company === company) &&
      (!ql || (c.name || '').toLowerCase().includes(ql) || c.email.toLowerCase().includes(ql) || c.company.toLowerCase().includes(ql))
  );

  return (
    <div className="rc-screen">
      {/* Header */}
      <header className="rc-hdr">
        <button className="rc-back" onClick={onClose}>← Back</button>
        <div className="rc-ttl">
          <b>Recruiters</b>
          <span>Emails found in job descriptions — no extra scraping.</span>
        </div>
        <div className="rc-spacer" />
        <span className="rc-count">{visible.length} contact{visible.length === 1 ? '' : 's'}</span>
      </header>

      {/* Content */}
      <div className="rc-wrap">
        <div className="rc-toolbar">
          <div className="rc-search">
            <Search size={14} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, or company…" />
          </div>
          <select className="rc-select" value={company} onChange={(e) => setCompany(e.target.value)}>
            <option value="">All companies</option>
            {companies.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="rc-note">
          <Mail size={13} />
          Extracted automatically from scraped job descriptions. <b>Copy all</b> to build your outreach list.
        </div>

        {loading ? (
          <p className="rc-empty-text">Loading contacts…</p>
        ) : visible.length === 0 ? (
          <div className="rc-empty">
            <div className="rc-empty-ico"><Mail size={24} /></div>
            <b>{contacts.length === 0 ? 'No emails found yet' : 'No contacts match'}</b>
            <p>{contacts.length === 0
              ? 'Emails appear here automatically as jobs are scraped — HR, recruiting and company addresses found in descriptions.'
              : 'Try a different search or clear the filters.'}</p>
          </div>
        ) : (
          <div className="rc-list">
            {visible.map((c, i) => (
              <div key={c.id} className="rc-contact">
                <div className="rc-avatar" style={{ background: AVATAR_GRADIENTS[i % 3] }}>
                  {(c.name || c.email[0]).charAt(0).toUpperCase()}
                </div>
                <div className="rc-cinfo">
                  <div className="rc-name">
                    {c.name || c.email.split('@')[0]}
                    <span className={`rc-tag rc-tag-${c.type}`}>{c.typeLabel}</span>
                  </div>
                  <div className="rc-email"><code>{c.email}</code></div>
                  <div className="rc-meta">
                    <span>{c.company}</span>
                    <span className="rc-sep">·</span>
                    <span>{c.jobRole}</span>
                    {c.jobCount > 1 && <span className="rc-jobs">{c.jobCount} jobs</span>}
                  </div>
                  {c.context && <div className="rc-context">"{c.context}…"</div>}
                </div>
                <div className="rc-acts">
                  <button className={`rc-btn ${copiedId === c.id ? 'copied' : ''}`} onClick={() => copyEmail(c)}>
                    {copiedId === c.id ? <><CheckCircle2 size={13} /> Copied</> : <><Copy size={13} /> Copy</>}
                  </button>
                  {c.sourceJobUrl && (
                    <a className="rc-open" href={c.sourceJobUrl} target="_blank" rel="noreferrer">
                      Open job <ExternalLink size={11} />
                    </a>
                  )}
                  <button className="rc-ghost" title="Dismiss" onClick={() => hideContact(c.id)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sticky action bar */}
      <div className="rc-actbar">
        <span className="rc-note-text">Emails are pulled from job descriptions you already scrape.</span>
        <div className="rc-spacer" />
        <button className="rc-btn2" onClick={onClose}>Close</button>
        <button className={`rc-btn2 primary ${copiedAll ? 'copied' : ''}`} onClick={copyAll} disabled={contacts.length === 0}>
          {copiedAll ? <><CheckCircle2 size={14} /> {contacts.length} emails copied ✓</> : <><Copy size={14} /> Copy all emails</>}
        </button>
      </div>

      {toast && (
        <div className="rc-toast">
          <CheckCircle2 size={14} /> {toast}
        </div>
      )}

      <style>{`
        .rc-screen {
          --bg: #F8FAFC; --card: #FFFFFF; --border: #E2E8F0; --text: #0F172A;
          --muted: #64748B; --faint: #94A3B8; --blue: #2563EB; --blue-soft: #EFF6FF;
          --blue-border: #BFDBFE; --green: #059669; --green-soft: #ECFDF5; --green-border: #A7F3D0;
          --amber: #D97706; --amber-soft: #FFFBEB; --amber-border: #FDE68A; --red: #DC2626;
          --shadow: 0 1px 3px rgba(15,23,42,.06);
          position: fixed; inset: 0; z-index: 60; background: var(--bg); color: var(--text);
          display: flex; flex-direction: column; font-family: 'Inter', system-ui, -apple-system, sans-serif;
          -webkit-font-smoothing: antialiased;
        }
        .rc-hdr { display: flex; align-items: center; gap: 12px; padding: 0 28px; height: 60px; border-bottom: 1px solid var(--border); background: var(--card); flex-shrink: 0; }
        .rc-back { display: inline-flex; align-items: center; gap: 6px; padding: 7px 13px; border-radius: 8px; border: 1px solid var(--border); background: var(--card); color: var(--muted); font-size: 12.5px; font-weight: 600; cursor: pointer; font-family: inherit; transition: all .15s ease; }
        .rc-back:hover { color: var(--text); border-color: var(--blue-border); background: var(--blue-soft); }
        .rc-ttl b { font-size: 15px; font-weight: 700; display: block; line-height: 1.2; }
        .rc-ttl span { font-size: 11px; color: var(--faint); font-weight: 500; }
        .rc-spacer { flex: 1; }
        .rc-count { display: inline-flex; align-items: center; font-size: 12px; font-weight: 700; color: var(--blue); background: var(--blue-soft); border: 1px solid var(--blue-border); padding: 6px 13px; border-radius: 20px; flex-shrink: 0; }
        .rc-wrap { max-width: 920px; width: 100%; margin: 0 auto; padding: 26px 28px 40px; flex: 1; overflow-y: auto; }
        .rc-toolbar { display: flex; gap: 10px; align-items: center; margin-bottom: 16px; }
        .rc-search { flex: 1; display: flex; align-items: center; gap: 9px; height: 40px; background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 0 13px; color: var(--faint); }
        .rc-search:focus-within { border-color: var(--blue); box-shadow: 0 0 0 3px rgba(37,99,235,.09); }
        .rc-search input { flex: 1; border: 0; outline: none; background: none; font-size: 13px; font-family: inherit; color: var(--text); }
        .rc-search input::placeholder { color: var(--faint); }
        .rc-select { height: 40px; border: 1px solid var(--border); border-radius: 10px; background: var(--card); color: var(--muted); font-size: 12.5px; font-weight: 600; font-family: inherit; padding: 0 10px; outline: none; cursor: pointer; }
        .rc-select:focus { border-color: var(--blue); }
        .rc-note { display: flex; align-items: center; gap: 8px; font-size: 11.5px; color: var(--faint); margin-bottom: 14px; }
        .rc-note b { color: var(--muted); font-weight: 600; }
        .rc-empty-text { color: var(--faint); font-size: 13px; padding: 30px 0; }
        .rc-empty { text-align: center; padding: 60px 20px; }
        .rc-empty-ico { width: 56px; height: 56px; border-radius: 16px; background: var(--blue-soft); border: 1px solid var(--blue-border); color: var(--blue); display: flex; align-items: center; justify-content: center; margin: 0 auto 14px; }
        .rc-empty b { font-size: 14px; }
        .rc-empty p { font-size: 12.5px; color: var(--muted); margin-top: 5px; line-height: 1.6; max-width: 380px; margin-left: auto; margin-right: auto; }
        .rc-list { display: flex; flex-direction: column; gap: 10px; }
        .rc-contact { display: flex; align-items: center; gap: 14px; background: var(--card); border: 1px solid var(--border); border-radius: 13px; padding: 14px 16px; box-shadow: var(--shadow); }
        .rc-avatar { width: 40px; height: 40px; border-radius: 11px; color: #fff; font-weight: 700; font-size: 15px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .rc-cinfo { flex: 1; min-width: 0; }
        .rc-name { display: flex; align-items: center; gap: 8px; font-size: 13.5px; font-weight: 700; flex-wrap: wrap; }
        .rc-tag { font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; padding: 2px 7px; border-radius: 20px; }
        .rc-tag-recruit { background: var(--blue-soft); color: var(--blue); border: 1px solid var(--blue-border); }
        .rc-tag-hr { background: var(--amber-soft); color: var(--amber); border: 1px solid var(--amber-border); }
        .rc-tag-careers { background: #F0FDF4; color: var(--green); border: 1px solid var(--green-border); }
        .rc-tag-company { background: #F1F5F9; color: var(--muted); border: 1px solid var(--border); }
        .rc-email { display: flex; align-items: center; gap: 7px; font-size: 12.5px; color: var(--muted); margin-top: 4px; }
        .rc-email code { font-family: ui-monospace, 'SF Mono', Menlo, monospace; color: var(--text); background: var(--bg); border: 1px solid var(--border); border-radius: 6px; padding: 2px 7px; font-size: 12px; }
        .rc-meta { display: flex; align-items: center; gap: 8px; font-size: 11px; color: var(--faint); margin-top: 6px; flex-wrap: wrap; }
        .rc-sep { color: #CBD5E1; }
        .rc-jobs { color: var(--green); font-weight: 600; background: var(--green-soft); border: 1px solid var(--green-border); padding: 2px 8px; border-radius: 20px; }
        .rc-context { font-size: 11px; color: var(--faint); font-style: italic; margin-top: 5px; max-width: 520px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .rc-acts { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
        .rc-btn { display: inline-flex; align-items: center; gap: 6px; height: 34px; padding: 0 12px; border-radius: 9px; border: 1px solid var(--border); background: #fff; color: var(--muted); font-size: 12px; font-weight: 600; cursor: pointer; font-family: inherit; transition: all .15s ease; }
        .rc-btn:hover { border-color: var(--blue-border); color: var(--blue); }
        .rc-btn.copied { border-color: var(--green-border); color: var(--green); background: var(--green-soft); }
        .rc-open { display: inline-flex; align-items: center; gap: 5px; font-size: 11.5px; font-weight: 600; color: var(--blue); text-decoration: none; padding: 4px 6px; border-radius: 7px; }
        .rc-open:hover { background: var(--blue-soft); }
        .rc-ghost { width: 32px; height: 32px; border: 0; border-radius: 8px; background: transparent; color: var(--faint); cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .rc-ghost:hover { color: var(--red); background: #FEF2F2; }
        .rc-actbar { position: sticky; bottom: 0; background: rgba(255,255,255,.92); backdrop-filter: blur(10px); border-top: 1px solid var(--border); padding: 12px 28px; display: flex; align-items: center; gap: 12px; flex-shrink: 0; }
        .rc-note-text { font-size: 11.5px; color: var(--faint); }
        .rc-btn2 { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 10px 18px; border-radius: 10px; border: 1px solid var(--border); background: var(--card); color: var(--text); font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; transition: all .15s ease; }
        .rc-btn2:hover { border-color: var(--blue-border); }
        .rc-btn2.primary { background: linear-gradient(135deg, #2563EB, #1D4ED8); border-color: transparent; color: #fff; box-shadow: 0 2px 6px rgba(37,99,235,.3); }
        .rc-btn2.primary:hover { filter: brightness(1.07); }
        .rc-btn2.copied { background: var(--green-soft); border-color: var(--green-border); color: var(--green); }
        .rc-btn2:disabled { opacity: .55; cursor: not-allowed; }
        .rc-toast { position: fixed; bottom: 82px; left: 50%; transform: translateX(-50%); background: var(--text); color: #F8FAFC; font-size: 12.5px; font-weight: 600; padding: 11px 18px; border-radius: 12px; display: flex; align-items: center; gap: 8px; box-shadow: 0 10px 30px rgba(0,0,0,.3); z-index: 70; }
      `}</style>
    </div>
  );
};
