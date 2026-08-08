import { Job } from '../../src/types.js';

// Personal-data sanitizer: strip contact details that appear inside scraped
// job descriptions (recruiter names/phones/emails). The tool only needs the
// job facts — title, company, salary, skills text — not people's contact info.
// Conservative on purpose: only unambiguous patterns are removed so legitimate
// job content (years, salaries, dates) is never mangled.

const EMAIL_RE = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;

// Phone numbers: require a '+' (country code) OR an area-code-ish grouping,
// so bare 4-digit years / salary figures are never touched.
const PHONE_RE = /(?:\+[\d\s.-]{6,15}\d|\+\d{1,3}[\s.-]?\d{3,4}[\s.-]?\d{3,4}|\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{3,4})/g;

// "Contact: Daniel Rogov" / "Tel: 555-1234" style lines — drop the value after
// a contact keyword (name OR number), leaving the label.
const CONTACT_VALUE_RE = /((?:contact|reach|call|email|whatsapp|telegram|phone|tel|hr|recruiter|ansprechpartner)[:\s]*)[^\n,;]{2,40}/gi;

export function sanitizeDescription(description: string): string {
  if (!description) return description;
  // Order matters: run the contact-prefix rule FIRST so already-inserted
  // placeholders are never re-processed by the other rules.
  return description
    .replace(CONTACT_VALUE_RE, (m, label: string) => `${label}[contact removed]`)
    .replace(EMAIL_RE, '[contact removed]')
    .replace(PHONE_RE, '[contact removed]');
}

export function sanitizeJob(job: Job): Job {
  return {
    ...job,
    description: sanitizeDescription(job.description || ''),
  };
}

export function sanitizeJobs(jobs: Job[]): Job[] {
  return jobs.map(sanitizeJob);
}
