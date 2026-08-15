import { ask } from './llm/llmAdapter.js';
import { getMasterCv } from './storage/fileStorage.js';

export interface InterviewQ {
  question: string;
  answer: string;
  score: number;
  feedback: string;
}

export interface InterviewSession {
  id: string;
  role: string;
  total: number;
  qIndex: number;
  qa: InterviewQ[];
  cvContext: string;
  createdAt: number;
}

export interface ScorecardEntry {
  question: string;
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

function buildCvContext(): string {
  const cv = getMasterCv();
  const skills = (cv.skills || []).flatMap((s: any) => s.items || []).slice(0, 30).join(', ');
  const exp = (cv.experiences || []).slice(0, 2).map((e: any) => `${e.title} @ ${e.company}`).join('; ');
  return `Candidate: ${cv.fullName}\nSummary: ${(cv.summary || '').slice(0, 500)}\nSkills: ${skills}\nRecent: ${exp}`;
}

export function startInterview(role: string): InterviewSession {
  const session: InterviewSession = {
    id: crypto.randomUUID(),
    role: role.trim() || 'the target role',
    total: TOTAL_QUESTIONS,
    qIndex: 0,
    qa: [],
    cvContext: buildCvContext(),
    createdAt: Date.now(),
  };
  sessions.set(session.id, session);
  return session;
}

export function destroyInterview(id: string): void {
  sessions.delete(id);
}

export async function askNextQuestion(session: InterviewSession): Promise<string> {
  const n = session.qIndex + 1;
  const prompt = [
    `You are a professional interviewer conducting a mock interview for the role: ${session.role}.`,
    session.cvContext,
    `Ask question ${n} of ${session.total}. Ask ONE question only.`,
    'Make it realistic, role-specific, and progressively harder.',
    'Return ONLY the question text. No markdown, no quotes, no preamble, no emojis.',
  ].join('\n');
  const q = (await ask(prompt)).trim();
  return q.slice(0, 400);
}

export async function scoreAnswer(session: InterviewSession, question: string, answer: string): Promise<{ score: number; feedback: string }> {
  const prompt = [
    `You are a professional interviewer for the role: ${session.role}.`,
    session.cvContext,
    `Question: ${question}`,
    `Candidate's answer: ${answer}`,
    'Score the answer 0-10 (10 = exceptional) and give ONE short constructive feedback line.',
    'Reply EXACTLY in this format:\nSCORE: <number 0-10>\nFEEDBACK: <one line>',
  ].join('\n');
  const raw = (await ask(prompt)).trim();
  const score = Math.max(0, Math.min(10, Number((raw.match(/SCORE:\s*(\d{1,2})/) || [])[1]) || 5));
  const feedback = (raw.match(/FEEDBACK:\s*(.+)/) || [])[1]?.trim().slice(0, 200) || '';
  session.qa.push({ question, answer, score, feedback });
  session.qIndex += 1;
  return { score, feedback };
}

export async function buildScorecard(session: InterviewSession): Promise<Scorecard> {
  const perQuestion: ScorecardEntry[] = session.qa.map((q) => ({ question: q.question, score: q.score, feedback: q.feedback }));
  const overall = Math.round((perQuestion.reduce((s, q) => s + q.score, 0) / Math.max(1, perQuestion.length)) * 10) / 10;

  let verdict = 'Interview complete. Keep practicing to raise your score.';
  try {
    const prompt = [
      `You are a professional interviewer for the role: ${session.role}.`,
      session.cvContext,
      `Scores: ${perQuestion.map((q) => `${q.score}/10`).join(', ')}`,
      'Write a 3-sentence final verdict: overall assessment, strongest area, and the single most important improvement for this role.',
      'Return ONLY the verdict text. No markdown, no emojis.',
    ].join('\n');
    const v = (await ask(prompt)).trim();
    if (v) verdict = v.slice(0, 500);
  } catch { /* keep default */ }

  destroyInterview(session.id);
  return { overall, verdict, perQuestion };
}
