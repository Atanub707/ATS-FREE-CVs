// Extracts recruiter / HR / company email addresses from job descriptions.
// No scraping — this runs on descriptions we already have.

export type ContactType = 'recruit' | 'hr' | 'careers' | 'company';

export interface ExtractedContact {
  email: string;
  name: string | null;
  type: ContactType;
  typeLabel: string;
  context: string;
}

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;

// Local-part prefixes that are almost never a recruiter you can reach out
// to — they are automation or generic dead-end inboxes.
const JUNK_LOCAL_RE =
  /^(noreply|no-reply|no_reply|donotreply|do-not-reply|donotreply|mailer-daemon|postmaster|webmaster|sentry|unsubscribe|abuse|support|help|info|contact|hello|admin|team|sales|marketing|billing|account|privacy|security-team|status|newsletter|email|emails|noreplies)$/i;

// Domains that are placeholder / documentation-only and never real contacts.
const JUNK_DOMAIN_RE =
  /(^|\.)(example|example\.com|example\.org|example\.net|test|localhost|yourdomain|your-?company|company\.com|email\.com|domain\.com|acme|sample)\.?$/i;

const RECRUIT_LOCAL_RE = /recruit|talent|hiring|headhunt|search$/i;
const HR_LOCAL_RE = /^(hr|people|peopleops|hrbp|hr-?team|human\s?resources)/i;
const CAREERS_LOCAL_RE = /career|jobs?$|job-?applications?|workwithus|joinus/i;

function classifyType(local: string, company: string): { type: ContactType; typeLabel: string } {
  if (RECRUIT_LOCAL_RE.test(local)) return { type: 'recruit', typeLabel: 'Recruiting' };
  if (HR_LOCAL_RE.test(local)) return { type: 'hr', typeLabel: 'HR' };
  if (CAREERS_LOCAL_RE.test(local)) return { type: 'careers', typeLabel: 'Careers' };
  // A company whose name is a recruitment/staffing agency is by definition
  // a recruiting contact, even when the local part is a person's name.
  if (/recruit|staffing|talent|people|search|consult|partner\b/i.test(company)) {
    return { type: 'recruit', typeLabel: 'Recruiting' };
  }
  return { type: 'company', typeLabel: 'Company' };
}

// Words that commonly appear right before an email but are not a person name.
const NAME_STOPWORDS = new Set([
  'the', 'for', 'at', 'with', 'via', 'contact', 'email', 'or', 'and', 'send', 'your', 'you', 'cv',
  'resume', 'please', 'reach', 'out', 'to', 'me', 'us', 'our', 'directly', 'anytime', 'questions',
  'about', 'this', 'role', 'position', 'job', 'applications', 'inquiries', 'inquiry', 'application',
  'apply', 'now', 'today', 'soon', 'also', 'can', 'be', 'found', 'below', 'above', 'see', 'more',
]);

function extractName(preceding: string): string | null {
  // Take the last meaningful segment (sentence / line / separator).
  const seg = preceding.split(/[.;:!?\n]| — | – |- /).filter(Boolean).pop() || preceding;
  const match = seg.match(/([A-ZÀ-Ý][a-zà-ÿ]+(?:\s+[A-ZÀ-Ý][a-zà-ÿ]+){1,2})\s*$/);
  if (!match) return null;
  const name = match[1].trim();
  const words = name.toLowerCase().split(/\s+/);
  if (words.some((w) => NAME_STOPWORDS.has(w))) return null;
  return name;
}

function cleanContext(preceding: string): string {
  return preceding.replace(/\s+/g, ' ').trim().slice(-90).trim();
}

export function extractContacts(description: string | undefined | null): ExtractedContact[] {
  const text = (description || '').replace(/\r/g, '');
  if (!text.trim()) return [];
  return extractContactsFrom(text, '');
}

export function extractContactsFrom(text: string, company: string): ExtractedContact[] {

  const seen = new Set<string>();
  const results: ExtractedContact[] = [];

  for (const match of text.matchAll(EMAIL_RE)) {
    const email = match[0].toLowerCase();
    if (seen.has(email)) continue;
    seen.add(email);

    const [local, domain] = email.split('@');
    if (!local || !domain) continue;
    if (JUNK_LOCAL_RE.test(local)) continue;
    if (JUNK_DOMAIN_RE.test(domain)) continue;

    const start = Math.max(0, match.index - 90);
    const preceding = text.slice(start, match.index);
    const { type, typeLabel } = classifyType(local, company);

    results.push({
      email,
      name: extractName(preceding),
      type,
      typeLabel,
      context: cleanContext(preceding),
    });
  }

  return results;
}
