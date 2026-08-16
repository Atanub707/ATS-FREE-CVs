import { ask } from './llm/llmAdapter.js';
import { getMasterCv, getAllJobs } from './storage/fileStorage.js';

export interface AnswerDims {
  accuracy: number;
  depth: number;
  structure: number;
  examples: number;
}

export interface InterviewQ {
  question: string;
  answer: string;
  score: number;
  feedback: string;
  jobTitle: string;
  company: string;
  dims: AnswerDims;
}

// Genuine scoring: the model scores four rubric dimensions per answer; the
// overall is computed HERE with fixed weights so no single number can be
// inflated by the model.
const DIM_WEIGHTS: Record<keyof AnswerDims, number> = { accuracy: 0.4, depth: 0.25, structure: 0.15, examples: 0.2 };

function computeOverall(dims: AnswerDims): number {
  const raw = dims.accuracy * DIM_WEIGHTS.accuracy + dims.depth * DIM_WEIGHTS.depth + dims.structure * DIM_WEIGHTS.structure + dims.examples * DIM_WEIGHTS.examples;
  return Math.round(raw * 10) / 10;
}

export interface InterviewSession {
  id: string;
  role: string;
  experienceYears: string;
  total: number;
  qIndex: number;
  qa: InterviewQ[];
  jobs: { id: string; title: string; company: string; description: string }[];
  cvContext: string;
  createdAt: number;
}

export interface ScorecardEntry {
  question: string;
  jobTitle: string;
  score: number;
  feedback: string;
}

export interface Scorecard {
  overall: number;
  verdict: string;
  perQuestion: ScorecardEntry[];
}

const TOTAL_QUESTIONS = 7;
const SESSION_TTL_MS = 4 * 60 * 60 * 1000;
const JD_EXCERPT_LEN = 700;

const sessions = new Map<string, InterviewSession>();

export function getInterviewSession(id: string): InterviewSession | undefined {
  const s = sessions.get(id);
  if (!s) return undefined;
  if (Date.now() - s.createdAt > SESSION_TTL_MS) {
    sessions.delete(id);
    return undefined;
  }
  return s;
}

function destroyInterview(id: string): void {
  sessions.delete(id);
}

// "Senior DevOps Engineer (Paris)" → "DevOps Engineer" — groups job titles
// into role buckets so the intro screen can offer real dashboard roles.
function normalizeRole(title: string): string {
  return title
    .toLowerCase()
    .replace(/\((.*?)\)/g, '')
    .replace(/^(senior|lead|principal|junior|staff|sr\.?|mid|chief|head of|assistant|associate)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function getRoleOptions(limit = 10): { label: string; count: number }[] {
  const counts = new Map<string, { count: number; display: string }>();
  for (const j of getAllJobs() as any[]) {
    if (!j?.title) continue;
    const key = normalizeRole(j.title);
    if (!key) continue;
    const entry = counts.get(key) || { count: 0, display: key };
    entry.count += 1;
    // Prefer the most common original casing for display ("DevOps Engineer" not "Devops engineer").
    if (counts.get(key)?.count !== undefined && j.title.trim().toLowerCase() === key) {
      entry.display = j.title.trim();
    }
    counts.set(key, entry);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, limit)
    .map(([label, { count, display }]) => ({ label: titleCase(display || label), count }));
}

export function getJobsForRole(role: string): { id: string; title: string; company: string; description: string }[] {
  const words = role.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  const jobs = (getAllJobs() as any[])
    .filter((j) => {
      if (!j?.title) return false;
      const t = j.title.toLowerCase();
      return words.some((w) => t.includes(w));
    })
    .filter((j) => j.description && j.description.trim().length > 50)
    .slice(0, 5)
    .map((j) => ({
      id: String(j.id),
      title: j.title || 'Role',
      company: j.company || '',
      description: String(j.description || '').slice(0, JD_EXCERPT_LEN),
    }));
  return jobs;
}

function buildCvContext(): string {
  const cv = getMasterCv();
  const skills = (cv.skills || []).flatMap((s: any) => s.items || []).slice(0, 30).join(', ');
  const exp = (cv.experiences || []).slice(0, 2).map((e: any) => `${e.title} @ ${e.company}`).join('; ');
  return `Candidate: ${cv.fullName}\nSummary: ${(cv.summary || '').slice(0, 500)}\nSkills: ${skills}\nRecent: ${exp}`;
}

export function startInterview(params: { role: string; experienceYears?: string; jobId?: string; jobIds?: string[] }): InterviewSession {
  const role = params.role.trim() || 'the target role';
  let jobs = getJobsForRole(role);
  const wanted = new Set<string>((params.jobIds?.length ? params.jobIds : params.jobId ? [params.jobId] : []));
  if (wanted.size) {
    const picked = jobs.filter((j) => wanted.has(j.id));
    if (picked.length) jobs = [...picked, ...jobs.filter((j) => !wanted.has(j.id))].slice(0, 5);
  }
  const session: InterviewSession = {
    id: crypto.randomUUID(),
    role,
    experienceYears: params.experienceYears?.trim() || 'not specified',
    total: TOTAL_QUESTIONS,
    qIndex: 0,
    qa: [],
    jobs,
    cvContext: buildCvContext(),
    createdAt: Date.now(),
  };
  sessions.set(session.id, session);
  return session;
}

export async function askNextQuestion(session: InterviewSession): Promise<{ question: string; jobTitle: string; company: string }> {
  const n = session.qIndex + 1;
  const job = session.jobs.length ? session.jobs[(n - 1) % session.jobs.length] : null;
  const jobBlock = job
    ? `\nA real job posting from the candidate's dashboard:\nTitle: ${job.title}\nCompany: ${job.company}\nDescription excerpt: ${job.description}`
    : `\nNo matching job descriptions were found in the candidate's dashboard — ask a general interview question for the role.`;
  const prompt = [
    `You are a senior interviewer hiring for the role: ${session.role}. The candidate states ${session.experienceYears} of experience in this role.`,
    session.cvContext,
    jobBlock,
    `Ask interview question ${n} of ${session.total}. Ground the question in the requirements of the job posting above — probe the candidate on the specific tools, concepts and scenarios it mentions.`,
    'Ask ONE question only. Return ONLY the question text. No markdown, no quotes, no preamble, no emojis.',
  ].join('\n');
  const q = (await ask(prompt, undefined, 'text')).trim();
  return {
    question: q.slice(0, 500),
    jobTitle: job?.title || session.role,
    company: job?.company || '',
  };
}

export async function scoreAnswer(session: InterviewSession, question: string, jobTitle: string, company: string, answer: string): Promise<{ score: number; feedback: string; dims: AnswerDims }> {
  const prompt = [
    `You are a senior interviewer for the role: ${session.role}.`,
    session.cvContext,
    jobTitle ? `Job posting this question came from: ${jobTitle}${company ? ` at ${company}` : ''}` : '',
    `Question: ${question}`,
    `Candidate's answer: ${answer}`,
    'Score the answer honestly against FOUR rubric dimensions (each 0-10):',
    '- ACCURACY: technical correctness against the role and the job posting',
    '- DEPTH: specificity — real tools, concepts, scenarios, elaboration beyond one-liners',
    '- STRUCTURE: clear, organized, direct answer',
    '- EXAMPLES: concrete experience or evidence from the candidate\'s own work',
    'Be fair and calibrate to a normal interview: a typical acceptable answer to this question earns a 6.0; a good senior-level answer with the right tools and a sound approach earns 7.5-8.5. Only vague, generic, or wrong answers fall below 5. Reserve 9-10 for truly exceptional, deep, distinctive answers.',
    'A generic answer without specifics must score low on DEPTH and EXAMPLES.',
    'Reply EXACTLY in this format:',
    'ACCURACY: <0-10>',
    'DEPTH: <0-10>',
    'STRUCTURE: <0-10>',
    'EXAMPLES: <0-10>',
    'FEEDBACK: <one short line>',
  ].join('\n');
  const raw = (await ask(prompt, undefined, 'text')).trim();
  const num = (label: string) => {
    const v = Number((raw.match(new RegExp(`${label}:\\s*(\\d{1,2}(?:\\.\\d)?)`)) || [])[1]);
    return Number.isFinite(v) ? Math.max(0, Math.min(10, v)) : 5;
  };
  const dims: AnswerDims = { accuracy: num('ACCURACY'), depth: num('DEPTH'), structure: num('STRUCTURE'), examples: num('EXAMPLES') };
  const feedback = (raw.match(/FEEDBACK:\s*(.+)/) || [])[1]?.trim().slice(0, 200) || '';
  // A one-line answer cannot be a strong interview answer, no matter what the model says.
  let score = computeOverall(dims);
  const wordCount = answer.trim().split(/\s+/).length;
  if (wordCount < 12) score = Math.min(score, 4);
  else if (wordCount < 25) score = Math.min(score, 6);
  session.qa.push({ question, answer, score, feedback, jobTitle, company, dims });
  session.qIndex += 1;
  return { score, feedback, dims };
}

export async function buildScorecard(session: InterviewSession): Promise<Scorecard> {
  const perQuestion: ScorecardEntry[] = session.qa.map((q) => ({ question: q.question, jobTitle: q.jobTitle, score: q.score, feedback: q.feedback }));
  const overall = Math.round((perQuestion.reduce((s, q) => s + q.score, 0) / Math.max(1, perQuestion.length)) * 10) / 10;

  let verdict = 'Interview complete. Keep practicing to raise your score.';
  try {
    const weakest = [...session.qa].sort((a, b) => a.score - b.score)[0];
    const prompt = [
      `You are a senior interviewer for the role: ${session.role}.`,
      session.cvContext,
      `Per-question scores: ${perQuestion.map((q, i) => `Q${i + 1} ${q.score}/10`).join(', ')}`,
      weakest ? `Weakest answer (Q: "${weakest.question.slice(0, 120)}") scored ${weakest.score}/10 — feedback: ${weakest.feedback}` : '',
      'Write a 3-sentence final verdict: overall assessment, strongest area, and the single most important improvement for this role. Be honest — do not inflate.',
      'Return ONLY the verdict text. No markdown, no emojis.',
    ].join('\n');
    const v = (await ask(prompt, undefined, 'text')).trim();
    if (v) verdict = v.slice(0, 500);
  } catch { /* keep default */ }

  destroyInterview(session.id);
  return { overall, verdict, perQuestion };
}
