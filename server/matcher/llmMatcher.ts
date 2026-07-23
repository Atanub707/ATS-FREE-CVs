import { BaseMatcher, MatchResult } from './baseMatcher.js';
import { Job, MasterCv, GapAnalysis } from '../../src/types.js';
import { ask } from '../llm/llmAdapter.js';

export class LlmMatcher extends BaseMatcher {
  async matchJob(job: Job, masterCv: MasterCv, earlyBlockThreshold = 30): Promise<MatchResult> {
    const prompt = `You are an expert ATS (Applicant Tracking System) Screener and Technical Recruiter.
Analyze how well the Candidate Master CV matches the target Job Description.

CANDIDATE MASTER CV:
Name: ${masterCv.fullName}
Summary: ${masterCv.summary}
Skills: ${masterCv.skills.map((s) => `${s.category}: ${s.items.join(', ')}`).join(' | ')}
Experience: ${masterCv.experiences.map((e) => `${e.title} at ${e.company}: ${e.responsibilities.join(' ')}`).join('\n')}

TARGET JOB DESCRIPTION:
Title: ${job.title}
Company: ${job.company}
Location: ${job.location}
Salary: ${job.salaryText || 'Not specified'}
Description: ${job.description}

EVALUATION INSTRUCTIONS:
1. Calculate a realistic ATS match score between 0 and 100 based on title alignment, technical skills overlap, years of experience, and role responsibilities.
2. Identify matching skills present in both CV and Job Description.
3. Identify missing required skills specified in the Job Description but absent or weak in the CV.
4. Extract key keywords matching and missing.
5. Provide 2-3 specific, actionable recommendations for CV optimization for this job.
6. Evaluate salary fit ('below', 'matched', 'above', or 'unknown') and experience level fit ('entry', 'mid', 'senior', 'overqualified', or 'ideal').
7. Provide a concise 2-sentence summary of the match fit.

Return valid JSON only with these exact fields:
{
  "matchScore": number (0-100),
  "matchingSkills": string[],
  "missingSkills": string[],
  "matchedKeywords": string[],
  "missingKeywords": string[],
  "salaryFit": "below" | "matched" | "above" | "unknown",
  "experienceFit": "entry" | "mid" | "senior" | "overqualified" | "ideal",
  "keyRecommendations": string[],
  "summaryAnalysis": string
}`;

    try {
      const jsonText = await ask(prompt, 0.1);
      const parsed = JSON.parse(jsonText);

      const score = Math.min(100, Math.max(0, Math.round(parsed.matchScore || 50)));
      const isEarlyBlocked = score < earlyBlockThreshold;

      const gapAnalysis: GapAnalysis = {
        matchScore: score,
        matchingSkills: parsed.matchingSkills || [],
        missingSkills: parsed.missingSkills || [],
        matchedKeywords: parsed.matchedKeywords || parsed.matchingSkills || [],
        missingKeywords: parsed.missingKeywords || parsed.missingSkills || [],
        salaryFit: (['below', 'matched', 'above', 'unknown'].includes(parsed.salaryFit)
          ? parsed.salaryFit
          : 'matched') as any,
        experienceFit: (['entry', 'mid', 'senior', 'overqualified', 'ideal'].includes(parsed.experienceFit)
          ? parsed.experienceFit
          : 'ideal') as any,
        keyRecommendations: parsed.keyRecommendations || [
          'Highlight relevant keywords in work experience bullet points.',
          'Quantify accomplishments with metrics aligned with job requirements.',
        ],
        summaryAnalysis: parsed.summaryAnalysis || `Match score calculated at ${score}%.`,
      };

      return {
        matchScore: score,
        gapAnalysis,
        isEarlyBlocked,
      };
    } catch (err) {
      console.error('LLM matching error, using fallback:', err);
      return this.fallbackHeuristicMatch(job, masterCv, earlyBlockThreshold);
    }
  }

  private fallbackHeuristicMatch(job: Job, masterCv: MasterCv, earlyBlockThreshold: number): MatchResult {
    const jobText = (job.title + ' ' + job.description).toLowerCase();

    const candidateSkills = masterCv.skills.flatMap((s) => s.items.map((item) => item.toLowerCase()));

    const matching: string[] = [];
    const missing: string[] = [];

    const commonKeywords = [
      'typescript', 'javascript', 'react', 'node', 'express', 'python', 'sql',
      'docker', 'aws', 'gcp', 'cloud', 'ai', 'gemini', 'rest', 'api', 'ci/cd',
      'microservices', 'postgresql', 'sqlite', 'vite', 'testing'
    ];

    for (const kw of commonKeywords) {
      if (jobText.includes(kw)) {
        if (candidateSkills.some((s) => s.includes(kw))) {
          matching.push(kw.toUpperCase());
        } else {
          missing.push(kw.toUpperCase());
        }
      }
    }

    const matchRatio = (matching.length + 1) / (matching.length + missing.length + 2);
    const rawScore = Math.round(matchRatio * 100);
    const score = Math.min(95, Math.max(25, rawScore));

    const isEarlyBlocked = score < earlyBlockThreshold;

    return {
      matchScore: score,
      gapAnalysis: {
        matchScore: score,
        matchingSkills: matching.length > 0 ? matching : ['TypeScript', 'React', 'Node.js', 'REST APIs'],
        missingSkills: missing.length > 0 ? missing : ['GraphQL', 'Kubernetes'],
        matchedKeywords: matching,
        missingKeywords: missing,
        salaryFit: 'matched',
        experienceFit: 'ideal',
        keyRecommendations: [
          'Incorporate exact technical keywords from the job description into work experience.',
          'Add quantitative achievements for core backend and frontend responsibilities.'
        ],
        summaryAnalysis: `Candidate has strong foundational overlap in ${matching.slice(0, 3).join(', ')}. Recommend rephrasing bullet points for ATS parser targeting.`
      },
      isEarlyBlocked
    };
  }
}
