import React, { useCallback, useEffect, useState } from 'react';
import { X, Search, CheckCircle2, Copy, Trash2, Mail, ExternalLink, Linkedin, Camera, Phone } from 'lucide-react';

interface Contact {
  id: string;
  email: string | null;
  phone: string | null;
  whatsapp: boolean;
  recruiterName: string | null;
  recruiterUrl: string | null;
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

  const copyValue = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      showToast(`${value} copied`);
    } catch { showToast('Could not copy'); }
  };

  const copyEmail = async (c: Contact) => {
    const value = c.email || c.phone || c.recruiterUrl || '';
    try {
      await navigator.clipboard.writeText(value);
      setCopiedId(c.id);
      setTimeout(() => setCopiedId(null), 1400);
      showToast(`${value} copied`);
    } catch { showToast('Could not copy — select manually'); }
  };

  const copyAll = async () => {
    const emails = contacts.map((c) => c.email).filter((e): e is string => !!e);
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
      (!ql || (c.name || '').toLowerCase().includes(ql) || (c.recruiterName || '').toLowerCase().includes(ql) || (c.email || '').toLowerCase().includes(ql) || (c.phone || '').includes(ql) || c.company.toLowerCase().includes(ql))
  );

  return (
    <div className="rc-screen">
      {/* Header */}
      <header className="rc-hdr">
        <button className="rc-back" onClick={onClose}>← Back</button>
        <div className="rc-ttl">
          <b>Recruiters</b>
          <span>Identity cards — emails, phones & LinkedIn from job descriptions.</span>
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
          Cards fill the screen — no long scrolling. Click any chip to copy.
        </div>

        {loading ? (
          <p className="rc-empty-text">Loading contacts…</p>
        ) : visible.length === 0 ? (
          <div className="rc-empty">
            <div className="rc-empty-ico"><Mail size={24} /></div>
            <b>{contacts.length === 0 ? 'No emails found yet' : 'No contacts match'}</b>
            <p>{contacts.length === 0
              ? 'Emails and phone numbers appear here automatically as jobs are scraped — HR, recruiting and company contacts found in descriptions.'
              : 'Try a different search or clear the filters.'}</p>
          </div>
        ) : (
          <div className="rc-grid">
            {visible.map((c, i) => {
              const displayName = c.name || c.recruiterName || '';
              const hasPhoto = !!displayName;
              return (
                <div key={c.id} className="rc-idcard">
                  <div className="rc-namerow">
                    <div className={`rc-photo ${hasPhoto ? `has ${i % 3 === 1 ? 'alt1' : i % 3 === 2 ? 'alt2' : ''}` : ''}`}>
                      {hasPhoto ? displayName.charAt(0).toUpperCase() : <Camera size={20} />}
                    </div>
                    <div className="rc-namefield">
                      <div className="rc-nm">
                        {displayName ? <b>{displayName}</b> : <span className="rc-notscraped">Not scraped</span>}
                        <span className={`rc-tag rc-tag-${c.type}`}>{c.typeLabel}</span>
                      </div>
                      <div className="rc-co-line">{c.company}</div>
                    </div>
                  </div>
                  <div className="rc-fields">
                    <div className="rc-frow">
                      <span className="rc-fl">Phone</span>
                      <span className="rc-fv">
                        {c.phone ? (
                          <>
                            <button className="rc-copyi" title="Copy phone" onClick={() => copyValue(c.phone!)}><Phone size={11} /></button>
                            <code>{c.phone}</code>
                            {c.whatsapp && <span className="rc-wabadge">WhatsApp</span>}
                          </>
                        ) : (
                          <span className="rc-notscraped">Not scraped</span>
                        )}
                      </span>
                    </div>
                    <div className="rc-frow">
                      <span className="rc-fl">Email</span>
                      <span className="rc-fv">
                        {c.email ? (
                          <>
                            <button className="rc-copyi" title="Copy email" onClick={() => copyValue(c.email!)}><Mail size={11} /></button>
                            <code>{c.email}</code>
                          </>
                        ) : (
                          <span className="rc-notscraped">Not scraped</span>
                        )}
                      </span>
                    </div>
                    <div className="rc-frow">
                      <span className="rc-fl">Social</span>
                      <span className="rc-fv">
                        {c.recruiterUrl ? (
                          <>
                            <Linkedin size={11} />
                            <a href={c.recruiterUrl} target="_blank" rel="noreferrer">LinkedIn profile ↗</a>
                          </>
                        ) : (
                          <span className="rc-notscraped">Not scraped</span>
                        )}
                      </span>
                    </div>
                  </div>
                  <div className="rc-idmeta">
                    <span className="rc-co">{c.company}</span>
                    <span className="rc-sep">·</span>
                    <span className="rc-role">{c.jobRole}</span>
                    {c.jobCount > 1 && <span className="rc-jobs">{c.jobCount} jobs</span>}
                  </div>
                  {c.context && <div className="rc-ctx">"{c.context}"</div>}
                  <div className="rc-cact">
                    <button className={`rc-btn ${copiedId === c.id ? 'copied' : ''}`} onClick={() => copyEmail(c)}>
                      {copiedId === c.id ? <><CheckCircle2 size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
                    </button>
                    <button className="rc-ghost" title="Dismiss" onClick={() => hideContact(c.id)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Sticky action bar */}
      <div className="rc-actbar">
        <span className="rc-note-text">Emails are pulled from job descriptions you already scrape.</span>
        <div className="rc-spacer" />
        <button className="rc-btn2" onClick={onClose}>Close</button>
        <button className={`rc-btn2 primary ${copiedAll ? 'copied' : ''}`} onClick={copyAll} disabled={!contacts.some((c) => c.email)}>
          {copiedAll ? <><CheckCircle2 size={14} /> Emails copied ✓</> : <><Copy size={14} /> Copy all emails</>}
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
          --blue-border: #BFDBFE; --linkedin: #0A66C2; --green: #059669; --green-soft: #ECFDF5; --green-border: #A7F3D0;
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
        .rc-phone code { color: #7C3AED; background: #FAF5FF; border-color: #E9D5FF; }
        .rc-email code { font-family: ui-monospace, 'SF Mono', Menlo, monospace; color: var(--text); background: var(--bg); border: 1px solid var(--border); border-radius: 6px; padding: 2px 7px; font-size: 12px; }
        .rc-meta { display: flex; align-items: center; gap: 8px; font-size: 11px; color: var(--faint); margin-top: 6px; flex-wrap: wrap; }
        .rc-sep { color: #CBD5E1; }
        .rc-jobs { color: var(--green); font-weight: 600; background: var(--green-soft); border: 1px solid var(--green-border); padding: 2px 8px; border-radius: 20px; }
        .rc-context { font-size: 11px; color: var(--faint); font-style: italic; margin-top: 5px; max-width: 520px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .rc-acts { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
        .rc-btn { display: inline-flex; align-items: center; gap: 6px; height: 34px; padding: 0 12px; border-radius: 9px; border: 1px solid var(--border); background: #fff; color: var(--muted); font-size: 12px; font-weight: 600; cursor: pointer; font-family: inherit; transition: all .15s ease; }
        .rc-btn:hover { border-color: var(--blue-border); color: var(--blue); }
        .rc-btn.copied { border-color: var(--green-border); color: var(--green); background: var(--green-soft); }
        .rc-linkedin { border-color: #B3C7F0; color: #0A66C2; background: #F5F8FE; }
        .rc-linkedin:hover { background: #E9F0FC; border-color: #0A66C2; }
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
        .rc-wrap { max-width: 1360px; }
        .rc-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 12px; align-content: start; }
        .rc-idcard { background: var(--card); border: 1px solid var(--border); border-radius: 14px; box-shadow: 0 1px 2px rgba(11,18,32,.05); padding: 14px; display: flex; flex-direction: column; gap: 10px; transition: box-shadow .15s ease, transform .15s ease; }
        .rc-idcard:hover { box-shadow: 0 6px 18px -6px rgba(11,18,32,.14); transform: translateY(-1px); }
        .rc-namerow { display: flex; align-items: center; gap: 12px; }
        .rc-namefield { flex: 1; min-width: 0; }
        .rc-nm { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
        .rc-nm b { font-size: 14px; font-weight: 700; letter-spacing: -.01em; }
        .rc-co-line { font-size: 10.5px; color: var(--faint); margin-top: 2px; }
        .rc-notscraped { font-size: 11px; font-weight: 500; font-style: italic; color: var(--faint); }
        .rc-fields { display: flex; flex-direction: column; }
        .rc-frow { display: flex; align-items: baseline; gap: 8px; padding: 5px 0; border-bottom: 1px dashed #EDF0F5; }
        .rc-frow:last-child { border-bottom: 0; }
        .rc-fl { width: 54px; flex-shrink: 0; font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; color: var(--faint); }
        .rc-fv { font-size: 12px; font-weight: 600; color: var(--text); min-width: 0; overflow-wrap: anywhere; display: flex; align-items: center; gap: 6px; }
        .rc-fv a { color: var(--linkedin); text-decoration: none; }
        .rc-fv a:hover { text-decoration: underline; }
        .rc-fv svg { width: 11px; height: 11px; flex-shrink: 0; }
        .rc-fv code { font-family: ui-monospace, Menlo, monospace; font-size: 11.5px; background: var(--bg); border: 1px solid var(--border); border-radius: 6px; padding: 1px 6px; }
        .rc-wabadge { font-size: 9px; font-weight: 700; color: #15803D; background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 20px; padding: 1px 6px; }
        .rc-copyi { border: 0; background: none; color: var(--faint); cursor: pointer; padding: 0; display: inline-flex; }
        .rc-copyi:hover { color: var(--blue); }
        .rc-idrow { display: flex; align-items: center; gap: 12px; }
        .rc-photo { width: 58px; height: 58px; border-radius: 12px; background: linear-gradient(135deg, #E2E8F0, #CBD5E1); border: 1px solid var(--border); display: flex; align-items: center; justify-content: center; color: #64748B; flex-shrink: 0; overflow: hidden; }
        .rc-photo svg { width: 20px; height: 20px; opacity: .55; }
        .rc-photo.has { background: linear-gradient(135deg, #2563EB, #7C3AED); color: #fff; font-weight: 800; font-size: 22px; border: 0; }
        .rc-photo.has.alt1 { background: linear-gradient(135deg, #F59E0B, #EF4444); }
        .rc-photo.has.alt2 { background: linear-gradient(135deg, #10B981, #0EA5E9); }
        .rc-idmain { min-width: 0; flex: 1; }
        .rc-idnm { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
        .rc-idnm b { font-size: 13.5px; font-weight: 700; letter-spacing: -.01em; }
        .rc-idmail { font-size: 11.5px; color: var(--muted); margin-top: 3px; display: flex; align-items: center; gap: 6px; min-width: 0; }
        .rc-idmail code { font-family: ui-monospace, Menlo, monospace; background: var(--bg); border: 1px solid var(--border); border-radius: 6px; padding: 1px 6px; font-size: 10.5px; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
        .rc-none { color: var(--faint); font-size: 10.5px; font-style: italic; }
        .rc-chips { display: flex; flex-wrap: wrap; gap: 6px; }
        .rc-chip { display: inline-flex; align-items: center; gap: 5px; font-size: 10.5px; font-weight: 600; border-radius: 7px; padding: 3px 8px; border: 1px solid var(--border); color: var(--muted); background: #fff; cursor: pointer; text-decoration: none; transition: all .15s ease; }
        .rc-chip:hover { border-color: var(--blue-border); color: var(--blue); }
        .rc-chip-phone { color: #7C3AED; border-color: #E9D5FF; background: #FAF5FF; }
        .rc-chip-wa { color: #15803D; border-color: #BBF7D0; background: #F0FDF4; }
        .rc-chip-li { color: #0A66C2; border-color: #B9D0EF; background: #F0F6FD; }
        .rc-idmeta { display: flex; align-items: center; gap: 8px; font-size: 11px; color: var(--faint); min-width: 0; flex-wrap: wrap; }
        .rc-co { font-weight: 600; color: var(--muted); }
        .rc-role { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
        .rc-ctx { font-size: 10.5px; color: var(--faint); font-style: italic; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; min-height: 31px; }
        .rc-cact { display: flex; align-items: center; gap: 7px; margin-top: auto; padding-top: 9px; border-top: 1px dashed var(--border); }
        .rc-cact .rc-btn { height: 30px; padding: 0 11px; font-size: 11px; }
        .rc-cact .rc-ghost { margin-left: auto; }
      `}</style>
    </div>
  );
};
