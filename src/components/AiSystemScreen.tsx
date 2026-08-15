import React, { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight, ChatCircleText, PencilSimple, CheckCircle, Sparkle, Microphone } from '@phosphor-icons/react';

interface RoleOption { label: string; count: number }
interface JobOption { id: string; title: string; company: string }
interface Question { question: string; jobTitle: string; company: string; questionIndex: number; total: number }
interface ScorecardRow { question: string; jobTitle: string; score: number; feedback: string }
interface Scorecard { overall: number; verdict: string; perQuestion: ScorecardRow[] }

type View = 'landing' | 'interview' | 'personalize';
type IvStep = 'intro' | 'qa' | 'scorecard';

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
  const [lastResult, setLastResult] = useState<{ score: number; feedback: string } | null>(null);
  const [scorecard, setScorecard] = useState<Scorecard | null>(null);

  const role = (selectedRole || customRole.trim());

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
        setLastResult({ score: d.score, feedback: d.feedback });
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
  const openPersonalize = () => { setError(null); setView('personalize'); };
  const backToLanding = () => { setView('landing'); setError(null); };

  const orbClass = busy ? 'orb orb-speaking' : 'orb orb-idle';

  return (
    <div className="ai-screen">
      <header className="ai-hdr">
        <div className="ai-hdr-logo"><span className="orb orb-sm orb-idle" aria-hidden="true"></span></div>
        <div className="ai-hdr-ttl">
          <b>AI System</b>
          <span>Interview with AI · Personalized AI Assistant</span>
        </div>
        <div className="ai-spacer" />
        {view !== 'landing' && (
          <button className="ai-back" onClick={view === 'interview' ? backToLanding : backToLanding} aria-label="Back to AI System">
            <ArrowLeft size={17} /> Back
          </button>
        )}
        <button className="ai-x" onClick={onClose} aria-label="Close"><span aria-hidden="true">×</span></button>
      </header>

      {view === 'landing' && (
        <div className="ai-landing">
          <div className="ai-lhead">
            <span className="ai-eyebrow"><Sparkle size={12} weight="fill" /> AI System</span>
            <h1>What would you like to do?</h1>
            <p>Two professional AI assistants — both work entirely on your own data: your scraped jobs and your Master CV.</p>
          </div>
          <div className="ai-choices">
            <button className="ai-choice iv" onClick={openInterview}>
              <div className="ai-choice-top">
                <span className="ai-choice-ico"><ChatCircleText size={24} weight="duotone" /></span>
                <span className="ai-choice-badge">AI Interviewer</span>
              </div>
              <span className={`orb orb-med ${orbClass}`} aria-hidden="true"></span>
              <h2>Interview with AI</h2>
              <p>Questions come from the <b>real job descriptions</b> in your dashboard — the interviewer reads the JDs you scraped and quizzes you on them. One question at a time, scored answers, final verdict.</p>
              <div className="ai-cstats">
                <span className="ai-cstat"><b>{roles.reduce((s, r) => s + r.count, 0) || '…'}</b> jobs in dashboard</span>
                <span className="ai-cstat">Questions from real JDs</span>
              </div>
              <span className="ai-cgo">Start interview <ArrowRight size={15} weight="bold" /></span>
            </button>

            <button className="ai-choice pz" onClick={openPersonalize}>
              <div className="ai-choice-top">
                <span className="ai-choice-ico"><PencilSimple size={24} weight="duotone" /></span>
                <span className="ai-choice-badge">CV Analyzer</span>
              </div>
              <span className="ai-choice-ico ai-pz-big"><PencilSimple size={22} weight="duotone" /></span>
              <h2>Personalized AI Assistant</h2>
              <p>Studies your <b>missing-keyword data across every scored job</b> — tells you exactly what your CV is missing and adds the keywords you approve, straight to your Master CV.</p>
              <div className="ai-cstats">
                <span className="ai-cstat">Analyzes scored jobs</span>
                <span className="ai-cstat">One-click Master CV update</span>
              </div>
              <span className="ai-cgo">Coming soon <ArrowRight size={15} weight="bold" /></span>
            </button>
          </div>
        </div>
      )}

      {view === 'personalize' && (
        <div className="ai-personalize">
          <div className="ai-ps-card">
            <span className="ai-ps-ico"><PencilSimple size={28} weight="duotone" /></span>
            <h2>Personalized AI Assistant</h2>
            <p>This assistant is next up — it analyzes the missing keywords stored across all your scored jobs and adds the ones you approve to your Master CV with one click.</p>
            <button className="ai-btn violet" onClick={backToLanding}>Back to AI System</button>
          </div>
        </div>
      )}

      {view === 'interview' && (
        <div className="ai-iv">
          {ivStep === 'intro' && (
            <div className="ai-iv-col">
              <div className="ai-card">
                <h3>Before we begin</h3>
                <p className="ai-sub">The interviewer asks you 3 quick questions to personalize the session.</p>
                <div className="ai-prog"><i className="on"></i><i></i><i></i></div>

                <label className="ai-flabel">1. Which role from your dashboard?</label>
                <div className="ai-rolechips">
                  {roles.map((r) => (
                    <button key={r.label} className={`ai-chip ${selectedRole === r.label ? 'on' : ''}`} onClick={() => { setSelectedRole(r.label); setCustomRole(''); }}>
                      <span className="ai-chip-n">✓</span>{r.label}<span className="ai-chip-cnt">{r.count} jobs</span>
                    </button>
                  ))}
                </div>
                <div className="ai-field"><input placeholder="Or type another role…" value={customRole} onChange={(e) => { setCustomRole(e.target.value); setSelectedRole(null); }} /></div>

                <label className="ai-flabel">2. Years of experience in this role</label>
                <div className="ai-field"><input placeholder="e.g. 4+ years" value={experience} onChange={(e) => setExperience(e.target.value)} /></div>

                <label className="ai-flabel">3. Pick a real posting from your list (optional)</label>
                <div className="ai-field">
                  <select value={selectedJob} onChange={(e) => setSelectedJob(e.target.value)} disabled={!jobOptions.length}>
                    <option value="">{jobOptions.length ? `Choose from ${jobOptions.length} postings…` : 'No matching postings with descriptions found'}</option>
                    {jobOptions.map((j) => (
                      <option key={j.id} value={j.id}>{j.title} — {j.company}</option>
                    ))}
                  </select>
                </div>

                {error && <div className="ai-error">{error}</div>}
                <div className="ai-intro-nav">
                  <button className="ai-btn violet" onClick={beginInterview} disabled={busy || !role}>
                    {busy ? 'Setting up…' : 'Begin interview'} {!busy && <ArrowRight size={15} weight="bold" />}
                  </button>
                  <span className="ai-hint">7 questions · scored per answer · final verdict</span>
                </div>
              </div>
            </div>
          )}

          {ivStep === 'qa' && question && (
            <div className="ai-iv-col">
              <div className="ai-q">
                <span className="ai-qtag"><ChatCircleText size={11} weight="fill" /> Question {question.questionIndex} of {question.total}</span>
                <p className="ai-qtext">{question.question}</p>
                <div className="ai-qsrc">
                  From this JD:
                  <span className="ai-src-chip">{question.jobTitle}</span>
                  {question.company && <span className="ai-src-chip">{question.company}</span>}
                </div>
              </div>
              <textarea className="ai-answer" placeholder="Type your answer…" value={answer} onChange={(e) => setAnswer(e.target.value)} />
              <div className="ai-iv-actions">
                <button className="ai-btn violet" onClick={submitAnswer} disabled={busy || !answer.trim()}>
                  {busy ? 'Scoring…' : 'Submit answer'}
                </button>
                <button className="ai-btn ghost" onClick={() => { setAnswer(answer + ''); }} disabled>
                  <Microphone size={15} /> Speak (coming soon)
                </button>
                {lastResult && (
                  <span className="ai-score-pill">{lastResult.score}/10 — {lastResult.feedback}</span>
                )}
              </div>
              {error && <div className="ai-error">{error}</div>}
            </div>
          )}

          {ivStep === 'scorecard' && scorecard && (
            <div className="ai-iv-col">
              <div className="ai-scorecard">
                <div className="ai-sc-head">
                  <div className="ai-sc-ring" style={{ '--p': `${scorecard.overall * 10}%` } as React.CSSProperties}><b>{scorecard.overall}</b></div>
                  <div>
                    <h3>Interview complete — {role}</h3>
                    <p>{scorecard.verdict}</p>
                  </div>
                </div>
                {scorecard.perQuestion.map((row, i) => (
                  <div className="ai-sc-row" key={i}>
                    <span className="ai-sc-q">{i + 1}. {row.question}</span>
                    <span className={`ai-sc-score ${row.score < 7 ? 'low' : ''}`}>{row.score}/10</span>
                  </div>
                ))}
                <div className="ai-intro-nav" style={{ marginTop: 18 }}>
                  <button className="ai-btn violet" onClick={backToLanding}>Done</button>
                  <button className="ai-btn ghost" onClick={resetInterview}>Take another interview</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <style>{`
        .ai-screen{position:fixed; inset:0; z-index:55; background:var(--bg,#F9FAFB); color:var(--ink,#0F172A); display:flex; flex-direction:column; font-family:'Plus Jakarta Sans',system-ui,-apple-system,sans-serif;}
        .ai-hdr{display:flex; align-items:center; gap:12px; padding:0 24px; height:62px; border-bottom:1px solid var(--line,#E2E8F0); background:var(--card,#fff); flex-shrink:0;}
        .ai-hdr-logo{display:inline-flex;}
        .ai-hdr-ttl b{font-size:14.5px; font-weight:800; display:block; line-height:1.2;}
        .ai-hdr-ttl span{font-size:11px; color:var(--faint,#64748B); font-weight:500;}
        .ai-spacer{flex:1;}
        .ai-back{display:inline-flex; align-items:center; gap:6px; border:1.5px solid var(--line2,#CBD5E1); background:var(--card,#fff); color:var(--muted,#475569); font-size:12px; font-weight:800; border-radius:10px; padding:8px 14px; cursor:pointer; transition:all .15s ease;}
        .ai-back:hover{border-color:var(--brand,#2563EB); color:var(--brand,#2563EB); background:var(--brand-soft,#EFF6FF);}
        .ai-x{border:0; background:none; color:var(--faint,#64748B); cursor:pointer; padding:6px 9px; border-radius:8px; font-size:22px; line-height:1;}
        .ai-x:hover{background:#F1F5F9; color:var(--ink,#0F172A);}

        /* orb */
        .orb{position:relative; border-radius:50%; flex-shrink:0;
          background:radial-gradient(circle at 32% 28%, #fff 0%, #DBEAFE 9%, #7C3AED 42%, #2563EB 68%, #1E3A8A 100%);
          box-shadow:inset -14px -12px 26px rgba(30,58,138,.5), inset 8px 8px 18px rgba(255,255,255,.55), 0 22px 55px -14px rgba(37,99,235,.6);}
        .orb::before{content:''; position:absolute; top:9%; left:16%; width:36%; height:24%; border-radius:50%; background:radial-gradient(circle, rgba(255,255,255,.9), rgba(255,255,255,0) 70%); transform:rotate(-20deg);}
        .orb::after{content:''; position:absolute; inset:0; border-radius:50%; background:radial-gradient(circle at 50% 115%, rgba(124,58,237,.5), transparent 55%);}
        .orb-sm{width:30px; height:30px; margin:0; box-shadow:inset -6px -5px 10px rgba(30,58,138,.45), inset 4px 4px 8px rgba(255,255,255,.5), 0 6px 16px -6px rgba(37,99,235,.5);}
        .orb-med{width:84px; height:84px; box-shadow:inset -10px -9px 18px rgba(30,58,138,.5), inset 6px 6px 12px rgba(255,255,255,.55), 0 18px 45px -12px rgba(37,99,235,.55);}
        .orb-idle{animation:orbFloat 3.6s ease-in-out infinite;}
        .orb-speaking{animation:orbWobble .62s ease-in-out infinite;}
        @keyframes orbFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
        @keyframes orbWobble{0%{transform:rotate(-3deg) scaleX(1)}12%{transform:rotate(2.5deg) scaleX(1.04)}25%{transform:rotate(-2deg) scaleY(1.05)}37%{transform:rotate(3deg) scaleX(.96)}50%{transform:rotate(-2.5deg) scaleX(1.03)}62%{transform:rotate(2deg) scaleY(1.04)}75%{transform:rotate(-3deg) scaleX(.97)}87%{transform:rotate(1.5deg) scaleX(1.02)}100%{transform:rotate(-3deg) scaleX(1)}}
        @media (prefers-reduced-motion: reduce){.orb-idle,.orb-speaking{animation:none;}}

        /* landing */
        .ai-landing{flex:1; overflow-y:auto; display:flex; align-items:center; justify-content:center; padding:40px 30px 60px;}
        .ai-landing-inner{width:100%; max-width:1060px;}
        .ai-lhead{text-align:center; margin-bottom:36px;}
        .ai-eyebrow{display:inline-flex; align-items:center; gap:7px; font-size:11px; font-weight:800; letter-spacing:.12em; text-transform:uppercase; color:#7C3AED; background:#F5F3FF; border:1px solid #E9D5FF; border-radius:999px; padding:6px 14px; margin-bottom:14px;}
        .ai-lhead h1{font-size:28px; font-weight:800; letter-spacing:-.04em;}
        .ai-lhead p{font-size:13px; color:var(--muted,#475569); margin-top:8px; max-width:520px; margin-left:auto; margin-right:auto; line-height:1.6;}
        .ai-choices{display:grid; grid-template-columns:1fr 1fr; gap:24px;}
        @media(max-width:860px){.ai-choices{grid-template-columns:1fr;}}
        .ai-choice{position:relative; background:var(--card,#fff); border:1px solid var(--line,#E2E8F0); border-radius:18px; padding:28px 26px; cursor:pointer; transition:transform .2s ease, box-shadow .25s ease, border-color .2s ease; text-align:left; overflow:hidden; font-family:inherit;}
        .ai-choice:hover{transform:translateY(-3px); box-shadow:0 18px 40px -16px rgba(15,23,42,.22);}
        .ai-choice::before{content:''; position:absolute; top:0; left:0; right:0; height:5px;}
        .ai-choice.iv::before{background:linear-gradient(90deg,#7C3AED,#2563EB);}
        .ai-choice.pz::before{background:linear-gradient(90deg,#059669,#2563EB);}
        .ai-choice-top{display:flex; align-items:center; gap:13px; margin-bottom:16px;}
        .ai-choice-ico{width:46px; height:46px; border-radius:14px; display:flex; align-items:center; justify-content:center; flex-shrink:0; box-shadow:0 1px 3px rgba(15,23,42,.08);}
        .ai-choice.iv .ai-choice-ico{background:linear-gradient(135deg,#7C3AED,#2563EB); color:#fff;}
        .ai-choice.pz .ai-choice-ico{background:linear-gradient(135deg,#059669,#2563EB); color:#fff;}
        .ai-pz-big{width:46px; height:46px; margin:0 0 16px;}
        .ai-choice-badge{font-size:10px; font-weight:800; letter-spacing:.1em; text-transform:uppercase; border-radius:999px; padding:5px 12px; margin-left:auto;}
        .ai-choice.iv .ai-choice-badge{color:#7C3AED; background:#F5F3FF; border:1px solid #E9D5FF;}
        .ai-choice.pz .ai-choice-badge{color:#059669; background:#ECFDF5; border:1px solid #A7F3D0;}
        .ai-choice h2{font-size:19px; font-weight:800; letter-spacing:-.02em; margin-bottom:7px;}
        .ai-choice p{font-size:12.5px; color:var(--muted,#475569); line-height:1.65; margin-bottom:16px;}
        .ai-cstats{display:flex; gap:8px; flex-wrap:wrap; margin-bottom:18px;}
        .ai-cstat{font-size:10.5px; font-weight:800; color:var(--faint,#64748B); background:#F1F5F9; border:1px solid var(--line,#E2E8F0); border-radius:999px; padding:5px 12px;}
        .ai-cstat b{color:var(--ink,#0F172A);}
        .ai-choice.iv .ai-cstat b{color:#7C3AED;}
        .ai-choice.pz .ai-cstat b{color:#059669;}
        .ai-cgo{display:inline-flex; align-items:center; gap:8px; font-size:13px; font-weight:800; padding:11px 20px; border-radius:11px; color:#fff; transition:gap .18s ease, filter .18s ease;}
        .ai-choice:hover .ai-cgo{gap:12px;}
        .ai-choice.iv .ai-cgo{background:linear-gradient(135deg,#7C3AED,#2563EB); box-shadow:0 10px 24px -10px rgba(124,58,237,.5);}
        .ai-choice.pz .ai-cgo{background:linear-gradient(135deg,#059669,#2563EB); box-shadow:0 10px 24px -10px rgba(5,150,105,.45);}
        .ai-cgo:hover{filter:brightness(1.07);}

        /* interview + personalize screens */
        .ai-iv{flex:1; overflow-y:auto; padding:26px 30px 44px;}
        .ai-iv-col{max-width:720px; margin:0 auto; display:flex; flex-direction:column; gap:16px; animation:aiRise .28s ease;}
        .ai-personalize{flex:1; overflow-y:auto; display:flex; align-items:center; justify-content:center; padding:30px;}
        .ai-ps-card{max-width:440px; background:var(--card,#fff); border:1px solid var(--line,#E2E8F0); border-radius:18px; padding:34px 32px; text-align:center; box-shadow:0 18px 40px -18px rgba(15,23,42,.2);}
        .ai-ps-ico{width:58px; height:58px; border-radius:17px; background:linear-gradient(135deg,#059669,#2563EB); color:#fff; display:inline-flex; align-items:center; justify-content:center; margin-bottom:16px;}
        .ai-ps-card h2{font-size:19px; font-weight:800; margin-bottom:9px;}
        .ai-ps-card p{font-size:12.5px; color:var(--muted,#475569); line-height:1.65; margin-bottom:22px;}
        @keyframes aiRise{from{opacity:0; transform:translateY(6px)} to{opacity:1; transform:none}}

        .ai-card{background:var(--card,#fff); border:1px solid var(--line,#E2E8F0); border-radius:16px; padding:24px; box-shadow:0 6px 16px -8px rgba(15,23,42,.12);}
        .ai-card h3{font-size:15px; font-weight:800; margin-bottom:3px;}
        .ai-sub{font-size:12px; color:var(--faint,#64748B); margin-bottom:15px;}
        .ai-prog{display:flex; gap:6px; margin-bottom:18px;}
        .ai-prog i{width:26px; height:4px; border-radius:999px; background:var(--line2,#CBD5E1); transition:background .2s ease;}
        .ai-prog i.on{background:#7C3AED;}
        .ai-flabel{display:block; font-size:11px; font-weight:800; color:var(--faint,#64748B); text-transform:uppercase; letter-spacing:.07em; margin:15px 0 7px;}
        .ai-rolechips{display:flex; flex-direction:column; gap:8px;}
        .ai-chip{display:flex; align-items:center; gap:10px; font-size:13px; font-weight:700; color:var(--muted,#475569); background:#FAFAF9; border:1.5px solid var(--line,#E2E8F0); border-radius:11px; padding:11px 14px; cursor:pointer; transition:all .15s ease; font-family:inherit; text-align:left;}
        .ai-chip:hover{border-color:#7C3AED; color:#7C3AED; background:#F5F3FF;}
        .ai-chip.on{border-color:#7C3AED; background:#F5F3FF; color:#7C3AED;}
        .ai-chip-n{width:22px; height:22px; border-radius:7px; background:#F1F5F9; color:transparent; font-size:11px; font-weight:800; display:inline-flex; align-items:center; justify-content:center; flex-shrink:0;}
        .ai-chip.on .ai-chip-n{background:#7C3AED; color:#fff;}
        .ai-chip-cnt{font-size:10.5px; color:var(--faint,#64748B); font-weight:600; margin-left:auto;}
        .ai-field input,.ai-field select{width:100%; border:1.5px solid var(--line2,#CBD5E1); border-radius:11px; padding:12px 14px; font-size:13px; font-family:inherit; color:var(--ink,#0F172A); outline:none; transition:border-color .15s ease, box-shadow .15s ease; background:#fff;}
        .ai-field input:focus,.ai-field select:focus{border-color:#7C3AED; box-shadow:0 0 0 4px rgba(124,58,237,.1);}
        .ai-error{align-self:center; font-size:12px; font-weight:700; color:var(--danger,#DC2626); background:#FEF2F2; border:1px solid #FECACA; border-radius:10px; padding:9px 14px;}
        .ai-intro-nav{display:flex; gap:12px; align-items:center; margin-top:18px; flex-wrap:wrap;}
        .ai-hint{font-size:11.5px; color:var(--faint,#64748B);}

        .ai-btn{display:inline-flex; align-items:center; justify-content:center; gap:8px; border:0; border-radius:11px; padding:12px 22px; font-size:13px; font-weight:800; cursor:pointer; font-family:inherit; transition:filter .18s ease, transform .12s ease;}
        .ai-btn:hover{filter:brightness(1.07);}
        .ai-btn:active{transform:scale(.985);}
        .ai-btn.violet{background:linear-gradient(135deg,#7C3AED,#2563EB); color:#fff; box-shadow:0 10px 24px -10px rgba(124,58,237,.5);}
        .ai-btn.ghost{background:var(--card,#fff); color:var(--muted,#475569); border:1.5px solid var(--line2,#CBD5E1);}
        .ai-btn.ghost:hover{border-color:#7C3AED; color:#7C3AED; filter:none;}
        .ai-btn:disabled{opacity:.55; cursor:not-allowed;}

        .ai-q{background:var(--card,#fff); border:1.5px solid #E9D5FF; border-left:5px solid #7C3AED; border-radius:15px; padding:18px 20px; box-shadow:0 6px 16px -8px rgba(15,23,42,.12);}
        .ai-qtag{display:inline-flex; align-items:center; gap:6px; font-size:10px; font-weight:800; letter-spacing:.1em; text-transform:uppercase; color:#7C3AED; background:#F5F3FF; border:1px solid #E9D5FF; border-radius:999px; padding:4px 12px; margin-bottom:11px;}
        .ai-qtext{font-size:14.5px; font-weight:700; line-height:1.65;}
        .ai-qsrc{margin-top:12px; font-size:11px; color:var(--faint,#64748B); display:flex; align-items:center; gap:6px; flex-wrap:wrap;}
        .ai-src-chip{background:#F1F5F9; border:1px solid var(--line,#E2E8F0); border-radius:6px; padding:2px 8px; font-weight:700; color:var(--muted,#475569); font-size:10.5px;}
        .ai-answer{width:100%; border:1.5px solid var(--line2,#CBD5E1); border-radius:13px; padding:14px 16px; min-height:92px; font-size:13.5px; color:var(--ink,#0F172A); line-height:1.65; resize:vertical; outline:none; background:var(--card,#fff); font-family:inherit; transition:border-color .15s ease, box-shadow .15s ease;}
        .ai-answer:focus{border-color:#7C3AED; box-shadow:0 0 0 4px rgba(124,58,237,.08);}
        .ai-iv-actions{display:flex; align-items:center; gap:11px; flex-wrap:wrap;}
        .ai-score-pill{font-size:12px; font-weight:800; color:#059669; background:#ECFDF5; border:1px solid #A7F3D0; border-radius:999px; padding:7px 14px; animation:aiRise .25s ease;}

        .ai-scorecard{background:var(--card,#fff); border:1px solid var(--line,#E2E8F0); border-radius:17px; padding:26px; box-shadow:0 18px 40px -18px rgba(15,23,42,.2);}
        .ai-sc-head{display:flex; align-items:center; gap:16px; padding-bottom:17px; border-bottom:1px solid var(--line,#E2E8F0); margin-bottom:16px;}
        .ai-sc-ring{position:relative; width:74px; height:74px; border-radius:50%; background:conic-gradient(#059669 var(--p), #E2E8F0 0); display:flex; align-items:center; justify-content:center; flex-shrink:0;}
        .ai-sc-ring::after{content:''; position:absolute; width:58px; height:58px; border-radius:50%; background:var(--card,#fff);}
        .ai-sc-ring b{position:relative; z-index:1; font-size:17px; font-weight:800; color:#059669;}
        .ai-sc-head h3{font-size:16.5px; font-weight:800;}
        .ai-sc-head p{font-size:12px; color:var(--muted,#475569); margin-top:3px; line-height:1.55;}
        .ai-sc-row{display:flex; align-items:flex-start; gap:12px; padding:12px 0; border-bottom:1px solid #F1F5F9;}
        .ai-sc-row:last-child{border-bottom:0;}
        .ai-sc-q{flex:1; font-size:12.5px; font-weight:700; color:var(--ink,#0F172A); line-height:1.5;}
        .ai-sc-score{font-size:12px; font-weight:800; color:#059669; background:#ECFDF5; border:1px solid #A7F3D0; border-radius:999px; padding:4px 11px; flex-shrink:0;}
        .ai-sc-score.low{color:#D97706; background:#FFFBEB; border-color:#FDE68A;}
      `}</style>
    </div>
  );
};
