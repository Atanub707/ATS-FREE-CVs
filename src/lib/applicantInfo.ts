import type { Job } from '../types';

// LinkedIn hides the exact count for low-competition jobs, showing
// "Be among the first N applicants" — the true count is always lower.
// Display an honest bound instead of pretending the ceiling is exact.
export function applicantCountLabel(job: Pick<Job, 'applicantCount' | 'applicantCaption' | 'lowCompetition'>): string | null {
  const cap = job.applicantCaption || '';

  const low = cap.match(/be among the first\s+([\d,.]+)\s+applicants?/i);
  if (low) {
    const n = parseInt(low[1].replace(/,/g, ''), 10);
    if (!isNaN(n)) return `Under ${n.toLocaleString()} applicants`;
  }
  const over = cap.match(/^over\s+([\d,.]+)\s+applicants?/i);
  if (over) {
    const n = parseInt(over[1].replace(/,/g, ''), 10);
    if (!isNaN(n)) return `Over ${n.toLocaleString()} applicants`;
  }
  if (job.lowCompetition && job.applicantCount !== undefined) {
    return `Under ${job.applicantCount.toLocaleString()} applicants`;
  }
  if (job.applicantCount !== undefined) {
    return `${job.applicantCount.toLocaleString()} applicants`;
  }
  return cap || null;
}
