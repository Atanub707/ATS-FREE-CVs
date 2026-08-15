import React, { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight, ChatCircleText, Sparkle, CheckCircle, CalendarBlank, Clock, ListChecks, CaretRight, Target, SuitcaseSimple, Briefcase, FileText, X } from '@phosphor-icons/react';

interface RoleOption { label: string; count: number }
interface JobOption { id: string; title: string; company: string }
interface Question { question: string; jobTitle: string; company: string; questionIndex: number; total: number }
interface ScorecardRow { question: string; jobTitle: string; score: number; feedback: string }
interface Scorecard { overall: number; verdict: string; perQuestion: ScorecardRow[] }
interface StoredInterview {
  id: string;
  role: string;
  total: number;
  overall: number;
  verdict: string;
  perQuestion: ScorecardRow[];
  createdAt: string;
}

type View = 'landing' | 'interview';
type IvStep = 'intro' | 'qa' | 'scorecard';

const DIM_LABELS: Record<string, string> = { accuracy: 'Accuracy', depth: 'Depth', structure: 'Structure', examples: 'Examples' };

export const AiSystemScreen: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [view, setView] = useState<View>('landing');
  const [ivStep, setIvStep] = useState<IvStep>('intro');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // interview intro state
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [customRole, setCustomRole] = useState('');
  const [experience, setExperience] = useState('');
  const [jobOptions, setJobOptions] = useState<JobOption[]>([]);
  const [selectedJob, setSelectedJob] = useState<string>('');

  // interview session state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [answer, setAnswer] = useState('');
  const [lastResult, setLastResult] = useState<{ score: number; feedback: string; dims?: { accuracy: number; depth: number; structure: number; examples: number } } | null>(null);
  const [scorecard, setScorecard] = useState<Scorecard | null>(null);

  // interview history
  const [history, setHistory] = useState<StoredInterview[] | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const role = (selectedRole || customRole.trim());
  const answerWords = answer.trim() ? answer.trim().split(/\s+/).length : 0;

  useEffect(() => {
    if (view === 'landing') {
      fetch('/api/interview/history')
        .then((r) => r.json())
        .then((d) => setHistory(d.sessions || []))
        .catch(() => setHistory([]));
    }
  }, [view]);

  useEffect(() => {
    if (view === 'interview' && roles.length === 0) {
      fetch('/api/interview/roles')
        .then((r) => r.json())
        .then((d) => setRoles(d.roles || []))
        .catch(() => setError('Could not load roles from your dashboard.'));
    }
  }, [view, roles.length]);

  // load real jobs for the picked role (the question bank)
  useEffect(() => {
    if (!role || view !== 'interview' || ivStep !== 'intro') return;
    setJobOptions([]);
    setSelectedJob('');
    fetch(`/api/interview/jobs?role=${encodeURIComponent(role)}`)
      .then((r) => r.json())
      .then((d) => setJobOptions(d.jobs || []))
      .catch(() => setJobOptions([]));
  }, [role, view, ivStep]);

  const beginInterview = async () => {
    if (!role || busy) return;
    setBusy(true);
    setError(null);
    setLastResult(null);
    setScorecard(null);
    try {
      const res = await fetch('/api/interview/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, experienceYears: experience || 'not specified', jobId: selectedJob || undefined }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error || 'Could not start the interview.');
      setSessionId(d.sessionId);
      setQuestion({ question: d.question, jobTitle: d.jobTitle, company: d.company, questionIndex: d.questionIndex, total: d.total });
      setIvStep('qa');
    } catch (e: any) {
      setError(e?.message || 'Could not start the interview.');
    } finally {
      setBusy(false);
    }
  };

  const submitAnswer = async () => {
    if (!sessionId || !answer.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/interview/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, answer }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error || 'Could not evaluate your answer.');
      setAnswer('');
      if (d.done) {
        setScorecard(d.scorecard);
        setIvStep('scorecard');
      } else {
        setLastResult({ score: d.score, feedback: d.feedback, dims: d.dims });
        setQuestion({ question: d.question, jobTitle: d.jobTitle, company: d.company, questionIndex: d.questionIndex, total: d.total });
      }
    } catch (e: any) {
      setError(e?.message || 'Could not evaluate your answer.');
    } finally {
      setBusy(false);
    }
  };

  const resetInterview = () => {
    setSessionId(null);
    setQuestion(null);
    setAnswer('');
    setLastResult(null);
    setScorecard(null);
    setIvStep('intro');
  };

  const openInterview = () => { resetInterview(); setError(null); setView('interview'); };
  const backToLanding = () => { setView('landing'); setError(null); };

  const orbClass = busy ? 'orb orb-speaking' : 'orb orb-idle';
  const totalJobs = roles.reduce((s, r) => s + r.count, 0);

  return (
    <div className="ai-screen">
      <header className="ai-hdr">
        <div className="ai-hdr-logo"><span className="orb orb-sm orb-idle" aria-hidden="true"></span></div>
        <div className="ai-hdr-divider" aria-hidden="true"></div>
        <div className="ai-hdr-ttl">
          <b>AI Interview</b>
          <span>Mock interview grounded in your real job descriptions</span>
        </div>
        <div className="ai-spacer" />
        {view !== 'landing' && (
          <button className="ai-back" onClick={backToLanding} aria-label="Back to AI Interview">
            <ArrowLeft size={16} weight="bold" /> Back
          </button>
        )}
        <button className="ai-x" onClick={onClose} aria-label="Close"><X size={18} weight="bold" /></button>
      </header>

      {view === 'landing' && (
        <div className="ai-landing">
          <div className="ai-blob ai-blob-a" aria-hidden="true"></div>
          <div className="ai-blob ai-blob-b" aria-hidden="true"></div>

          <div className="ai-landing-inner">
            <div className="ai-lhead">
              <span className="ai-eyebrow"><Sparkle size={12} weight="fill" /> AI Interview</span>
              <h1>Ready for your interview?</h1>
              <p>A senior interviewer quizzes you on the real job descriptions in your dashboard — one question at a time, rubric-scored, with a final verdict.</p>
            </div>

            <div className="ai-choices">
              <button className="ai-choice iv" onClick={openInterview}>
                <div className="ai-choice-top">
                  <span className="ai-choice-ico"><ChatCircleText size={24} weight="duotone" /></span>
                  <span className="ai-choice-badge">AI Interviewer</span>
                </div>
                <div className="ai-choice-orbwrap"><span className={`orb orb-med ${orbClass}`} aria-hidden="true"></span></div>
                <h2>Interview with AI</h2>
                <p>Questions come from the <b>real job descriptions</b> in your dashboard — the interviewer reads the JDs you scraped and quizzes you on them.</p>
                <ul className="ai-feats">
                  <li><CheckCircle size={14} weight="fill" /> 7 questions, one at a time</li>
                  <li><CheckCircle size={14} weight="fill" /> Rubric-scored on 4 dimensions</li>
                  <li><CheckCircle size={14} weight="fill" /> Final verdict + full history</li>
                </ul>
                <div className="ai-cstats">
                  <span className="ai-cstat"><b>{totalJobs || '…'}</b> jobs in dashboard</span>
                  <span className="ai-cstat">Questions from real JDs</span>
                </div>
                <div className="ai-choice-foot">
                  <span className="ai-cgo">Start interview <ArrowRight size={15} weight="bold" /></span>
                </div>
              </button>
            </div>

            <div className="ai-history">
              <div className="ai-history-head">
                <div className="ai-history-title">
                  <span className="ai-history-ico"><ListChecks size={15} weight="duotone" /></span>
                  <b>Interview history</b>
                </div>
                <span className="ai-history-count">{history ? `${history.length} session${history.length === 1 ? '' : 's'}` : '…'}</span>
              </div>

              {history === null && (
                <div className="ai-history-empty"><span className="ai-empty-spin" aria-hidden="true"></span> Loading your sessions…</div>
              )}
              {history !== null && history.length === 0 && (
                <div className="ai-history-empty">
                  <span className="ai-empty-ico"><CalendarBlank size={20} weight="duotone" /></span>
                  <b>No interviews yet</b>
                  <p>Your completed sessions will appear here with scores, verdicts and full answers.</p>
                </div>
              )}
              {history !== null && history.length > 0 && (
                <div className="ai-history-list">
                  {history.map((h) => (
                    <div key={h.id} className={`ai-history-row ${expandedId === h.id ? 'open' : ''}`}>
                      <button className="ai-history-row-main" onClick={() => setExpandedId(expandedId === h.id ? null : h.id)}>
                        <span className="ai-h-ring" style={{ '--p': `${h.overall * 10}%` } as React.CSSProperties}><b>{h.overall}</b></span>
                        <span className="ai-h-meta">
                          <b>{h.role}</b>
                          <span><Clock size={11} weight="bold" /> {new Date(h.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })} · {new Date(h.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} · {h.total} questions</span>
                        </span>
                        <span className="ai-h-verdict">{h.verdict.slice(0, 80)}{h.verdict.length > 80 ? '…' : ''}</span>
                        <span className={`ai-h-chev ${expandedId === h.id ? 'open' : ''}`}><CaretRight size={14} weight="bold" /></span>
                      </button>
                      {expandedId === h.id && (
                        <div className="ai-h-detail">
                          <div className="ai-h-detail-head">Questions &amp; scores</div>
                          {h.perQuestion.map((q, i) => (
                            <div className="ai-h-q" key={i}>
                              <span className="ai-h-qtext">{i + 1}. {q.question}</span>
                              <span className={`ai-sc-score ${q.score < 7 ? 'low' : ''}`}>{q.score}/10</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {view === 'interview' && (
        <div className="ai-iv">
          {ivStep === 'intro' && (
            <div className="ai-iv-col">
              <div className="ai-card">
                <div className="ai-card-head">
                  <span className="ai-card-ico"><SuitcaseSimple size={18} weight="duotone" /></span>
                  <div>
                    <h3>Before we begin</h3>
                    <p className="ai-sub">The interviewer asks you 3 quick questions to personalize the session.</p>
                  </div>
                </div>
                <div className="ai-prog">
                  <span className="on"><i></i><b>Role</b></span>
                  <span><i></i><b>Experience</b></span>
                  <span><i></i><b>Posting</b></span>
                </div>

                <div className="ai-step">
                  <label className="ai-flabel"><span className="ai-step-n">1</span> Which role from your dashboard?</label>
                  <div className="ai-rolechips">
                    {roles.map((r) => (
                      <button key={r.label} className={`ai-chip ${selectedRole === r.label ? 'on' : ''}`} onClick={() => { setSelectedRole(r.label); setCustomRole(''); }}>
                        <span className="ai-chip-n"><CheckCircle size={12} weight="bold" /></span>
                        <span className="ai-chip-label">{r.label}</span>
                        <span className="ai-chip-cnt">{r.count} jobs</span>
                      </button>
                    ))}
                  </div>
                  <div className="ai-field"><input placeholder="Or type another role…" value={customRole} onChange={(e) => { setCustomRole(e.target.value); setSelectedRole(null); }} /></div>
                </div>

                <div className="ai-step">
                  <label className="ai-flabel"><span className="ai-step-n">2</span> Years of experience in this role</label>
                  <div className="ai-field"><input placeholder="e.g. 4+ years" value={experience} onChange={(e) => setExperience(e.target.value)} /></div>
                </div>

                <div className="ai-step">
                  <label className="ai-flabel"><span className="ai-step-n">3</span> Pick a real posting from your list <span className="ai-opt">optional</span></label>
                  <div className="ai-field">
                    <select value={selectedJob} onChange={(e) => setSelectedJob(e.target.value)} disabled={!jobOptions.length}>
                      <option value="">{jobOptions.length ? `Choose from ${jobOptions.length} postings…` : 'No matching postings with descriptions found'}</option>
                      {jobOptions.map((j) => (
                        <option key={j.id} value={j.id}>{j.title} — {j.company}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {error && <div className="ai-error">{error}</div>}
                <div className="ai-intro-nav">
                  <button className="ai-btn violet" onClick={beginInterview} disabled={busy || !role}>
                    {busy ? 'Setting up…' : 'Begin interview'} {!busy && <ArrowRight size={15} weight="bold" />}
                  </button>
                  <span className="ai-hint"><Clock size={12} weight="bold" /> 7 questions · scored per answer · final verdict</span>
                </div>
              </div>
            </div>
          )}

          {ivStep === 'qa' && question && (
            <div className="ai-iv-col">
              <div className="ai-qa-top">
                <span className="ai-qa-progress">Question <b>{question.questionIndex}</b> of {question.total}</span>
                <div className="ai-qa-dots">
                  {Array.from({ length: question.total }, (_, i) => <i key={i} className={i < question.questionIndex ? 'done' : i === question.questionIndex - 1 ? 'now' : ''}></i>)}
                </div>
              </div>
              <div className="ai-q">
                <span className="ai-qtag"><ChatCircleText size={11} weight="fill" /> Interviewer</span>
                <p className="ai-qtext">{question.question}</p>
                <div className="ai-qsrc">
                  <Briefcase size={12} weight="bold" /> From this JD:
                  <span className="ai-src-chip">{question.jobTitle}</span>
                  {question.company && <span className="ai-src-chip">{question.company}</span>}
                </div>
              </div>
              <div className="ai-answer-wrap">
                <textarea className="ai-answer" placeholder="Type your answer…" value={answer} onChange={(e) => setAnswer(e.target.value)} />
                <div className="ai-answer-meta">
                  <span>{answerWords > 0 ? `${answerWords} words` : 'Be specific — depth and examples count'}</span>
                  <span className={answerWords < 12 && answerWords > 0 ? 'warn' : ''}>{answerWords > 0 && answerWords < 12 ? 'Add more detail' : ''}</span>
                </div>
              </div>
              <div className="ai-iv-actions">
                <button className="ai-btn violet" onClick={submitAnswer} disabled={busy || !answer.trim()}>
                  {busy ? 'Scoring…' : 'Submit answer'} {!busy && <ArrowRight size={14} weight="bold" />}
                </button>
                <a className="ai-btn wispr" href="https://ref.wisprflow.ai/atanu-biswas" target="_blank" rel="noreferrer" title="Stop texting, start speaking — dictate your answers with Wispr Flow">
                  <span className="ai-w-logo">W</span> Stop texting, start speaking.
                </a>
                {lastResult && (
                  <span className="ai-score-pill">
                    <b>{lastResult.score}/10</b>
                    {lastResult.dims && (
                      <span className="ai-dims">
                        {Object.entries(lastResult.dims).map(([k, v]) => <em key={k}><b>{DIM_LABELS[k]}</b> {v}</em>)}
                      </span>
                    )}
                    <span className="ai-pill-fb">— {lastResult.feedback}</span>
                  </span>
                )}
              </div>
              {error && <div className="ai-error">{error}</div>}
            </div>
          )}

          {ivStep === 'scorecard' && scorecard && (
            <div className="ai-iv-col">
              <div className="ai-scorecard">
                <div className="ai-sc-head">
                  <div className="ai-sc-ring" style={{ '--p': `${scorecard.overall * 10}%` } as React.CSSProperties}><b>{scorecard.overall}</b><span>overall</span></div>
                  <div className="ai-sc-head-txt">
                    <span className="ai-sc-role"><Target size={12} weight="fill" /> {role}</span>
                    <h3>Interview complete</h3>
                    <p>{scorecard.verdict}</p>
                  </div>
                </div>
                <div className="ai-sc-list-head"><ListChecks size={13} weight="duotone" /> Question breakdown</div>
                {scorecard.perQuestion.map((row, i) => (
                  <div className="ai-sc-row" key={i}>
                    <span className="ai-sc-q"><i>{i + 1}</i> {row.question}</span>
                    <span className={`ai-sc-score ${row.score < 7 ? 'low' : ''}`}>{row.score}/10</span>
                  </div>
                ))}
                <div className="ai-intro-nav" style={{ marginTop: 20 }}>
                  <button className="ai-btn violet" onClick={backToLanding}>Done <CheckCircle size={14} weight="bold" /></button>
                  <button className="ai-btn ghost" onClick={resetInterview}>Take another interview</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <style>{`
        /* ── Tokens ── */
        .ai-screen{--ink:#0F172A; --muted:#475569; --faint:#64748B; --line:#E2E8F0; --line2:#CBD5E1;
          --brand:#2563EB; --violet:#7C3AED; --emerald:#059669;
          --shadow-sm:0 1px 2px rgba(15,23,42,.04), 0 1px 3px rgba(15,23,42,.06);
          --shadow-md:0 4px 12px -4px rgba(15,23,42,.08), 0 2px 6px -3px rgba(15,23,42,.05);
          --shadow-lg:0 20px 45px -18px rgba(15,23,42,.22);
          --r-lg:18px; --r-md:14px; --r-sm:11px;
          position:fixed; inset:0; z-index:55; background:#F7F8FA; color:var(--ink);
          display:flex; flex-direction:column; font-family:'Plus Jakarta Sans',system-ui,-apple-system,sans-serif;}
        :focus-visible{outline:2px solid var(--violet); outline-offset:2px; border-radius:6px;}
        *{box-sizing:border-box;}

        /* ── Header ── */
        .ai-hdr{display:flex; align-items:center; gap:13px; padding:0 28px; height:64px; border-bottom:1px solid var(--line);
          background:rgba(255,255,255,.82); backdrop-filter:blur(12px); flex-shrink:0; position:relative; z-index:5;}
        .ai-hdr-logo{display:inline-flex;}
        .ai-hdr-divider{width:1px; height:26px; background:var(--line);}
        .ai-hdr-ttl b{font-size:15px; font-weight:800; display:block; line-height:1.2; letter-spacing:-.01em;}
        .ai-hdr-ttl span{font-size:11px; color:var(--faint); font-weight:500;}
        .ai-spacer{flex:1;}
        .ai-back{display:inline-flex; align-items:center; gap:7px; border:1px solid var(--line2); background:#fff; color:var(--muted);
          font-size:12px; font-weight:800; border-radius:10px; padding:9px 15px; cursor:pointer; transition:all .2s ease; box-shadow:var(--shadow-sm);}
        .ai-back:hover{border-color:var(--violet); color:var(--violet); background:#FBF9FF;}
        .ai-x{border:0; background:none; color:var(--faint); cursor:pointer; padding:8px; border-radius:10px; display:inline-flex; transition:all .2s ease;}
        .ai-x:hover{background:#F1F5F9; color:var(--ink);}

        /* ── Orb ── */
        .orb{position:relative; border-radius:50%; flex-shrink:0;
          background:radial-gradient(circle at 32% 28%, #fff 0%, #DBEAFE 9%, var(--violet) 42%, var(--brand) 68%, #1E3A8A 100%);
          box-shadow:inset -14px -12px 26px rgba(30,58,138,.5), inset 8px 8px 18px rgba(255,255,255,.55), 0 22px 55px -14px rgba(37,99,235,.6);}
        .orb::before{content:''; position:absolute; top:9%; left:16%; width:36%; height:24%; border-radius:50%;
          background:radial-gradient(circle, rgba(255,255,255,.9), rgba(255,255,255,0) 70%); transform:rotate(-20deg);}
        .orb::after{content:''; position:absolute; inset:0; border-radius:50%;
          background:radial-gradient(circle at 50% 115%, rgba(124,58,237,.5), transparent 55%);}
        .orb-sm{width:30px; height:30px; margin:0; box-shadow:inset -6px -5px 10px rgba(30,58,138,.45), inset 4px 4px 8px rgba(255,255,255,.5), 0 6px 16px -6px rgba(37,99,235,.5);}
        .orb-med{width:84px; height:84px; box-shadow:inset -10px -9px 18px rgba(30,58,138,.5), inset 6px 6px 12px rgba(255,255,255,.55), 0 18px 45px -12px rgba(37,99,235,.55);}
        .orb-idle{animation:orbFloat 3.6s ease-in-out infinite;}
        .orb-speaking{animation:orbWobble .62s ease-in-out infinite;}
        @keyframes orbFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
        @keyframes orbWobble{0%{transform:rotate(-3deg) scaleX(1)}12%{transform:rotate(2.5deg) scaleX(1.04)}25%{transform:rotate(-2deg) scaleY(1.05)}37%{transform:rotate(3deg) scaleX(.96)}50%{transform:rotate(-2.5deg) scaleX(1.03)}62%{transform:rotate(2deg) scaleY(1.04)}75%{transform:rotate(-3deg) scaleX(.97)}87%{transform:rotate(1.5deg) scaleX(1.02)}100%{transform:rotate(-3deg) scaleX(1)}}

        /* ── Landing ── */
        .ai-landing{flex:1; overflow-y:auto; position:relative; display:flex; justify-content:center; padding:48px 30px 64px;}
        .ai-blob{position:absolute; border-radius:50%; filter:blur(70px); opacity:.5; pointer-events:none;}
        .ai-blob-a{width:460px; height:460px; background:radial-gradient(circle, rgba(124,58,237,.16), transparent 65%); top:-140px; left:-120px;}
        .ai-blob-b{width:520px; height:520px; background:radial-gradient(circle, rgba(37,99,235,.13), transparent 65%); bottom:-180px; right:-140px;}
        .ai-landing-inner{width:100%; max-width:640px; position:relative;}
        .ai-lhead{text-align:center; margin-bottom:34px;}
        .ai-eyebrow{display:inline-flex; align-items:center; gap:7px; font-size:11px; font-weight:800; letter-spacing:.14em; text-transform:uppercase;
          color:var(--violet); background:#fff; border:1px solid #E9D5FF; border-radius:999px; padding:7px 16px; margin-bottom:18px; box-shadow:var(--shadow-sm);}
        .ai-lhead h1{font-size:32px; font-weight:800; letter-spacing:-.045em; line-height:1.15;}
        .ai-lhead p{font-size:13.5px; color:var(--muted); margin-top:10px; max-width:520px; margin-left:auto; margin-right:auto; line-height:1.7;}

        .ai-choices{display:flex; justify-content:center;}
        .ai-choice{position:relative; max-width:560px; width:100%; background:#fff; border:1px solid var(--line); border-radius:var(--r-lg);
          padding:30px 30px 26px; cursor:pointer; transition:transform .25s ease, box-shadow .3s ease, border-color .25s ease; text-align:left; overflow:hidden; font-family:inherit; box-shadow:var(--shadow-md);}
        .ai-choice:hover{transform:translateY(-4px); box-shadow:var(--shadow-lg); border-color:#DDD6FE;}
        .ai-choice::before{content:''; position:absolute; top:0; left:0; right:0; height:5px; background:linear-gradient(90deg,var(--violet),var(--brand));}
        .ai-choice-top{display:flex; align-items:center; gap:13px; margin-bottom:20px;}
        .ai-choice-ico{width:46px; height:46px; border-radius:14px; display:flex; align-items:center; justify-content:center; flex-shrink:0;
          background:linear-gradient(135deg,var(--violet),var(--brand)); color:#fff; box-shadow:0 8px 20px -8px rgba(124,58,237,.55);}
        .ai-choice-badge{font-size:10px; font-weight:800; letter-spacing:.1em; text-transform:uppercase; border-radius:999px; padding:6px 13px; margin-left:auto;
          color:var(--violet); background:#F5F3FF; border:1px solid #E9D5FF;}
        .ai-choice-orbwrap{display:flex; justify-content:center; margin:6px 0 18px; position:relative;}
        .ai-choice-orbwrap::after{content:''; position:absolute; bottom:2px; width:120px; height:22px; border-radius:50%;
          background:radial-gradient(ellipse at center, rgba(15,23,42,.14), transparent 70%); filter:blur(4px);}
        .ai-choice h2{font-size:20px; font-weight:800; letter-spacing:-.02em; margin-bottom:8px; text-align:center;}
        .ai-choice > p{font-size:12.5px; color:var(--muted); line-height:1.7; text-align:center; margin-bottom:18px;}
        .ai-feats{list-style:none; display:flex; flex-direction:column; gap:9px; margin-bottom:18px; padding:14px 16px;
          background:#FAF9FF; border:1px solid #EEE9FE; border-radius:12px;}
        .ai-feats li{display:flex; align-items:center; gap:9px; font-size:12px; font-weight:700; color:var(--muted);}
        .ai-feats svg{color:var(--violet); flex-shrink:0;}
        .ai-cstats{display:flex; gap:8px; flex-wrap:wrap; justify-content:center; margin-bottom:20px;}
        .ai-cstat{font-size:10.5px; font-weight:800; color:var(--faint); background:#F1F5F9; border:1px solid var(--line); border-radius:999px; padding:6px 13px; display:inline-flex; align-items:center; gap:6px;}
        .ai-cstat b{color:var(--violet);}
        .ai-choice-foot{display:flex; justify-content:center;}
        .ai-cgo{display:inline-flex; align-items:center; gap:9px; font-size:13.5px; font-weight:800; padding:13px 26px; border-radius:12px; color:#fff;
          background:linear-gradient(135deg,var(--violet),var(--brand)); box-shadow:0 12px 26px -10px rgba(124,58,237,.55);
          transition:gap .2s ease, filter .2s ease, transform .15s ease;}
        .ai-choice:hover .ai-cgo{gap:13px; filter:brightness(1.06);}
        .ai-cgo:active{transform:scale(.98);}

        /* ── History ── */
        .ai-history{max-width:560px; width:100%; margin:40px auto 0;}
        .ai-history-head{display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; padding:0 2px;}
        .ai-history-title{display:flex; align-items:center; gap:9px;}
        .ai-history-ico{width:30px; height:30px; border-radius:9px; background:#F5F3FF; color:var(--violet); display:inline-flex; align-items:center; justify-content:center; border:1px solid #E9D5FF;}
        .ai-history-title b{font-size:14.5px; font-weight:800;}
        .ai-history-count{font-size:11px; font-weight:800; color:var(--faint); background:#fff; border:1px solid var(--line); border-radius:999px; padding:5px 12px; box-shadow:var(--shadow-sm);}
        .ai-history-empty{font-size:12.5px; color:var(--faint); background:#fff; border:1px dashed var(--line2); border-radius:14px; padding:26px 20px; text-align:center; display:flex; flex-direction:column; align-items:center; gap:6px; box-shadow:var(--shadow-sm);}
        .ai-history-empty b{color:var(--muted); font-size:13.5px;}
        .ai-history-empty p{font-size:11.5px; max-width:300px; line-height:1.6;}
        .ai-empty-ico{width:40px; height:40px; border-radius:12px; background:#F1F5F9; color:var(--faint); display:inline-flex; align-items:center; justify-content:center; margin-bottom:4px;}
        .ai-empty-spin{width:16px; height:16px; border-radius:50%; border:2px solid #E2E8F0; border-top-color:var(--violet); animation:spin .8s linear infinite; margin-bottom:4px;}
        @keyframes spin{to{transform:rotate(360deg)}}
        .ai-history-list{display:flex; flex-direction:column; gap:10px;}
        .ai-history-row{background:#fff; border:1px solid var(--line); border-radius:14px; overflow:hidden; box-shadow:var(--shadow-sm); transition:border-color .2s ease, box-shadow .2s ease;}
        .ai-history-row:hover{border-color:#DDD6FE; box-shadow:var(--shadow-md);}
        .ai-history-row.open{border-color:#DDD6FE; box-shadow:var(--shadow-md);}
        .ai-history-row-main{display:flex; align-items:center; gap:13px; width:100%; padding:14px 16px; border:0; background:none; cursor:pointer; font-family:inherit; text-align:left; transition:background .2s ease;}
        .ai-history-row-main:hover{background:#FBFCFE;}
        .ai-h-ring{position:relative; width:44px; height:44px; border-radius:50%; background:conic-gradient(var(--emerald) var(--p), #E2E8F0 0); display:flex; align-items:center; justify-content:center; flex-shrink:0;}
        .ai-h-ring::after{content:''; position:absolute; width:34px; height:34px; border-radius:50%; background:#fff;}
        .ai-h-ring b{position:relative; z-index:1; font-size:12.5px; font-weight:800; color:#047857;}
        .ai-h-meta{flex:1; min-width:0;}
        .ai-h-meta b{display:block; font-size:13.5px; font-weight:800; color:var(--ink); margin-bottom:2px;}
        .ai-h-meta span{font-size:11px; color:var(--faint); font-weight:500; display:inline-flex; align-items:center; gap:5px;}
        .ai-h-verdict{max-width:210px; font-size:11px; color:var(--muted); line-height:1.5; text-align:right;}
        .ai-h-chev{color:var(--faint); display:inline-flex; transition:transform .2s ease; flex-shrink:0;}
        .ai-h-chev.open{transform:rotate(90deg); color:var(--violet);}
        .ai-h-detail{padding:6px 16px 14px; border-top:1px solid #F1F5F9; animation:aiRise .25s ease;}
        .ai-h-detail-head{font-size:10px; font-weight:800; letter-spacing:.1em; text-transform:uppercase; color:var(--faint); margin:10px 0 4px;}
        .ai-h-q{display:flex; align-items:flex-start; gap:10px; padding:9px 0; border-bottom:1px solid #F8FAFC;}
        .ai-h-q:last-child{border-bottom:0;}
        .ai-h-qtext{flex:1; font-size:12px; font-weight:600; color:var(--muted); line-height:1.55;}
        @keyframes aiRise{from{opacity:0; transform:translateY(6px)} to{opacity:1; transform:none}}

        /* ── Interview screen ── */
        .ai-iv{flex:1; overflow-y:auto; padding:32px 30px 52px; position:relative;}
        .ai-iv-col{max-width:700px; margin:0 auto; display:flex; flex-direction:column; gap:16px; animation:aiRise .28s ease;}

        .ai-card{background:#fff; border:1px solid var(--line); border-radius:var(--r-lg); padding:28px 30px; box-shadow:var(--shadow-md);}
        .ai-card-head{display:flex; align-items:center; gap:14px; margin-bottom:20px; padding-bottom:18px; border-bottom:1px solid #F1F5F9;}
        .ai-card-ico{width:40px; height:40px; border-radius:12px; background:#F5F3FF; color:var(--violet); display:inline-flex; align-items:center; justify-content:center; border:1px solid #E9D5FF; flex-shrink:0;}
        .ai-card-head h3{font-size:16px; font-weight:800; letter-spacing:-.01em;}
        .ai-sub{font-size:12px; color:var(--faint); margin-top:2px; line-height:1.5;}
        .ai-prog{display:flex; gap:22px; margin-bottom:22px;}
        .ai-prog > span{display:flex; align-items:center; gap:7px; font-size:10.5px; font-weight:800; letter-spacing:.06em; text-transform:uppercase; color:var(--faint);}
        .ai-prog i{width:22px; height:4px; border-radius:999px; background:var(--line2); transition:background .25s ease;}
        .ai-prog > span.on{color:var(--violet);}
        .ai-prog > span.on i{background:var(--violet);}
        .ai-step{margin-bottom:22px; padding-bottom:22px; border-bottom:1px solid #F1F5F9;}
        .ai-step:last-of-type{border-bottom:0; margin-bottom:0; padding-bottom:0;}
        .ai-flabel{display:flex; align-items:center; gap:9px; font-size:11px; font-weight:800; color:var(--faint); text-transform:uppercase; letter-spacing:.08em; margin-bottom:11px;}
        .ai-step-n{width:20px; height:20px; border-radius:7px; background:var(--violet); color:#fff; font-size:10.5px; display:inline-flex; align-items:center; justify-content:center; flex-shrink:0;}
        .ai-opt{font-size:9.5px; font-weight:700; color:var(--faint); background:#F1F5F9; border-radius:999px; padding:3px 9px; letter-spacing:.05em; text-transform:none;}
        .ai-rolechips{display:flex; flex-direction:column; gap:9px;}
        .ai-chip{display:flex; align-items:center; gap:11px; font-size:13px; font-weight:700; color:var(--muted); background:#FAFAF9; border:1.5px solid var(--line);
          border-radius:12px; padding:12px 15px; cursor:pointer; transition:all .18s ease; font-family:inherit; text-align:left; box-shadow:var(--shadow-sm);}
        .ai-chip:hover{border-color:var(--violet); color:var(--violet); background:#FBF9FF;}
        .ai-chip.on{border-color:var(--violet); background:#F5F3FF; color:var(--violet); box-shadow:0 0 0 3px rgba(124,58,237,.08);}
        .ai-chip-n{width:22px; height:22px; border-radius:8px; background:#F1F5F9; color:transparent; display:inline-flex; align-items:center; justify-content:center; flex-shrink:0; transition:all .18s ease;}
        .ai-chip.on .ai-chip-n{background:var(--violet); color:#fff;}
        .ai-chip-label{flex:1;}
        .ai-chip-cnt{font-size:10.5px; color:var(--faint); font-weight:700; background:#fff; border:1px solid var(--line); border-radius:999px; padding:3px 10px;}
        .ai-chip.on .ai-chip-cnt{color:var(--violet); border-color:#E9D5FF;}
        .ai-field input,.ai-field select{width:100%; border:1.5px solid var(--line2); border-radius:12px; padding:13px 15px; font-size:13px; font-family:inherit;
          color:var(--ink); outline:none; transition:border-color .18s ease, box-shadow .18s ease; background:#fff;}
        .ai-field input:focus,.ai-field select:focus{border-color:var(--violet); box-shadow:0 0 0 4px rgba(124,58,237,.1);}
        .ai-error{align-self:center; font-size:12px; font-weight:700; color:#DC2626; background:#FEF2F2; border:1px solid #FECACA; border-radius:10px; padding:10px 15px;}
        .ai-intro-nav{display:flex; gap:14px; align-items:center; margin-top:22px; flex-wrap:wrap;}
        .ai-hint{font-size:11.5px; color:var(--faint); display:inline-flex; align-items:center; gap:6px; font-weight:600;}

        /* buttons */
        .ai-btn{display:inline-flex; align-items:center; justify-content:center; gap:9px; border:0; border-radius:12px; padding:13px 24px; font-size:13.5px; font-weight:800;
          cursor:pointer; font-family:inherit; transition:filter .2s ease, transform .15s ease, box-shadow .2s ease;}
        .ai-btn:hover{filter:brightness(1.07);}
        .ai-btn:active{transform:scale(.98);}
        .ai-btn.violet{background:linear-gradient(135deg,var(--violet),var(--brand)); color:#fff; box-shadow:0 12px 26px -10px rgba(124,58,237,.55);}
        .ai-btn.ghost{background:#fff; color:var(--muted); border:1.5px solid var(--line2); box-shadow:var(--shadow-sm);}
        .ai-btn.ghost:hover{border-color:var(--violet); color:var(--violet); filter:none;}
        .ai-btn:disabled{opacity:.55; cursor:not-allowed; transform:none;}
        .ai-btn.wispr{display:inline-flex; align-items:center; gap:9px; border:0; background:#0F172A; color:#fff; text-decoration:none;
          box-shadow:0 10px 24px -12px rgba(15,23,42,.6); transition:background .2s ease, transform .15s ease, box-shadow .2s ease;}
        .ai-btn.wispr:hover{background:#1E293B; filter:none; box-shadow:0 14px 30px -12px rgba(15,23,42,.7);}
        .ai-w-logo{width:22px; height:22px; border-radius:7px; background:rgba(255,255,255,.16); color:#fff; font-size:10px; font-weight:800; display:inline-flex; align-items:center; justify-content:center; flex-shrink:0; box-shadow:inset 0 1px 0 rgba(255,255,255,.2);}

        /* Q&A */
        .ai-qa-top{display:flex; align-items:center; justify-content:space-between; margin-bottom:2px; padding:0 4px;}
        .ai-qa-progress{font-size:12px; font-weight:800; color:var(--faint);}
        .ai-qa-progress b{color:var(--violet); font-size:14px;}
        .ai-qa-dots{display:flex; gap:5px;}
        .ai-qa-dots i{width:22px; height:5px; border-radius:999px; background:var(--line2); transition:background .3s ease;}
        .ai-qa-dots i.now{background:var(--violet);}
        .ai-qa-dots i.done{background:#C4B5FD;}
        .ai-q{background:#fff; border:1.5px solid #E9D5FF; border-left:5px solid var(--violet); border-radius:var(--r-md);
          padding:20px 22px; box-shadow:var(--shadow-md);}
        .ai-qtag{display:inline-flex; align-items:center; gap:6px; font-size:10px; font-weight:800; letter-spacing:.1em; text-transform:uppercase;
          color:var(--violet); background:#F5F3FF; border:1px solid #E9D5FF; border-radius:999px; padding:5px 12px; margin-bottom:13px;}
        .ai-qtext{font-size:15px; font-weight:700; line-height:1.7; letter-spacing:-.005em;}
        .ai-qsrc{margin-top:15px; padding-top:13px; border-top:1px dashed #EEE9FE; font-size:11px; color:var(--faint); display:flex; align-items:center; gap:7px; flex-wrap:wrap;}
        .ai-qsrc svg{color:var(--violet);}
        .ai-src-chip{background:#F1F5F9; border:1px solid var(--line); border-radius:7px; padding:3px 9px; font-weight:700; color:var(--muted); font-size:10.5px;}
        .ai-answer-wrap{position:relative;}
        .ai-answer{width:100%; border:1.5px solid var(--line2); border-radius:var(--r-md); padding:16px 18px 30px; min-height:110px; font-size:13.5px;
          color:var(--ink); line-height:1.7; resize:vertical; outline:none; background:#fff; font-family:inherit; transition:border-color .18s ease, box-shadow .18s ease; box-shadow:var(--shadow-sm);}
        .ai-answer:focus{border-color:var(--violet); box-shadow:0 0 0 4px rgba(124,58,237,.08);}
        .ai-answer-meta{position:absolute; bottom:8px; left:16px; right:16px; display:flex; justify-content:space-between; font-size:10.5px; color:var(--faint); font-weight:600; pointer-events:none;}
        .ai-answer-meta .warn{color:#D97706; font-weight:800;}
        .ai-iv-actions{display:flex; align-items:center; gap:12px; flex-wrap:wrap;}
        .ai-score-pill{font-size:12px; font-weight:700; color:#047857; background:#ECFDF5; border:1px solid #A7F3D0; border-radius:12px; padding:10px 14px;
          animation:aiRise .25s ease; display:inline-flex; align-items:center; gap:9px; flex-wrap:wrap; box-shadow:var(--shadow-sm); max-width:100%;}
        .ai-score-pill b{font-size:15px;}
        .ai-dims{display:inline-flex; gap:5px; flex-wrap:wrap;}
        .ai-dims em{font-style:normal; font-size:10px; font-weight:700; color:#047857; background:rgba(255,255,255,.7); border:1px solid #A7F3D0; border-radius:999px; padding:3px 9px;}
        .ai-dims em b{font-size:10px; color:#065F46;}
        .ai-pill-fb{font-size:11.5px; color:#065F46; font-weight:600; line-height:1.5;}

        /* scorecard */
        .ai-scorecard{background:#fff; border:1px solid var(--line); border-radius:var(--r-lg); padding:30px; box-shadow:var(--shadow-lg);}
        .ai-sc-head{display:flex; align-items:center; gap:20px; padding-bottom:22px; border-bottom:1px solid var(--line); margin-bottom:20px;}
        .ai-sc-ring{position:relative; width:84px; height:84px; border-radius:50%; background:conic-gradient(var(--emerald) var(--p), #E2E8F0 0); display:flex; flex-direction:column; align-items:center; justify-content:center; flex-shrink:0;}
        .ai-sc-ring::after{content:''; position:absolute; width:66px; height:66px; border-radius:50%; background:#fff;}
        .ai-sc-ring b{position:relative; z-index:1; font-size:20px; font-weight:800; color:#047857; line-height:1;}
        .ai-sc-ring span{position:relative; z-index:1; font-size:8.5px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; color:var(--faint); margin-top:2px;}
        .ai-sc-head-txt{flex:1; min-width:0;}
        .ai-sc-role{display:inline-flex; align-items:center; gap:6px; font-size:10.5px; font-weight:800; color:var(--violet); background:#F5F3FF; border:1px solid #E9D5FF; border-radius:999px; padding:4px 11px; margin-bottom:8px;}
        .ai-sc-head h3{font-size:17px; font-weight:800; letter-spacing:-.015em;}
        .ai-sc-head p{font-size:12px; color:var(--muted); margin-top:5px; line-height:1.65;}
        .ai-sc-list-head{display:flex; align-items:center; gap:8px; font-size:10.5px; font-weight:800; letter-spacing:.1em; text-transform:uppercase; color:var(--faint); margin-bottom:6px;}
        .ai-sc-list-head svg{color:var(--violet);}
        .ai-sc-row{display:flex; align-items:flex-start; gap:13px; padding:13px 2px; border-bottom:1px solid #F1F5F9; transition:background .15s ease;}
        .ai-sc-row:hover{background:#FBFCFE;}
        .ai-sc-row:last-child{border-bottom:0;}
        .ai-sc-q{flex:1; font-size:12.5px; font-weight:600; color:var(--ink); line-height:1.6; display:flex; gap:10px;}
        .ai-sc-q i{width:22px; height:22px; border-radius:8px; background:#F1F5F9; color:var(--faint); font-size:10.5px; font-weight:800; font-style:normal; display:inline-flex; align-items:center; justify-content:center; flex-shrink:0; margin-top:1px;}
        .ai-sc-score{font-size:12px; font-weight:800; color:#047857; background:#ECFDF5; border:1px solid #A7F3D0; border-radius:999px; padding:5px 12px; flex-shrink:0;}
        .ai-sc-score.low{color:#D97706; background:#FFFBEB; border-color:#FDE68A;}

        @media (prefers-reduced-motion: reduce){*,*::before,*::after{animation:none !important; transition:none !important;}}
      `}</style>
    </div>
  );
};
