// Extracts recruiter / HR / company email addresses from job descriptions.
// No scraping — this runs on descriptions we already have.

export type ContactType = 'recruit' | 'hr' | 'careers' | 'company';

export interface ExtractedContact {
  email: string | null;
  phone: string | null;
  name: string | null;
  type: ContactType;
  typeLabel: string;
  context: string;
}

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;

// Phone candidates: optional country code / area code, then digit groups
// separated by space, dash, dot or parens. Validated afterwards.
const PHONE_RE = /(?:\+?\d{1,3}[\s-]?)?(?:\(\d{2,5}\)[\s-]?)?\d{2,5}[\s.-]?\d{2,4}[\s.-]?\d{2,4}(?:[\s.-]?\d{2,4})?/g;

// ────────────────────────────────────────────────────────────────────────────
// Phone false-positive guards: years, dates, versions, salaries, amounts.
// ────────────────────────────────────────────────────────────────────────────

function looksLikePhone(raw: string, preceding: string): boolean {
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return false;

  // Ungrouped digit runs ("2011548", "0242810") are usually IDs, codes or
  // requisition numbers — require 9+ digits when there is no separator.
  const hasSeparator = /[\s\-().]/.test(raw);
  if (!hasSeparator && digits.length < 9) return false;

  const groups = raw.replace(/^\+/, '').split(/[\s.-]+/).filter(Boolean);

  // Years: 2026, 1998
  if (/^\d{4}$/.test(digits) && /^(19|20)\d{2}$/.test(digits)) return false;

  // Dates: 2026-08-09 or 09-08-2026
  if (groups.length === 3) {
    if (/^\d{4}$/.test(groups[0]) && /^\d{1,2}$/.test(groups[1]) && /^\d{1,2}$/.test(groups[2])) return false;
    if (/^\d{1,2}$/.test(groups[0]) && /^\d{1,2}$/.test(groups[1]) && /^\d{4}$/.test(groups[2])) return false;
  }

  // Versions / decimals (DOT-separated only): 2.4.1, 1.2 — a spaced
  // "93 83 83 54" is a real phone, so space/dash groups are never treated
  // as versions.
  if (raw.includes('.') && !raw.includes('+') && !raw.includes('(')) {
    const g = raw.split('.');
    if (g.length >= 2 && g.every((x) => /^\d{1,2}$/.test(x))) return false;
  }

  // Money / amounts: $120,000 · €45k · salary 50.000
  const prev = preceding.toLowerCase();
  if (/(\$|€|£|₹|usd|eur|gbp|inr|k\b|salary|annum|year|monthly|hour)/.test(prev.slice(-16))) return false;

  // Percentages / ranges like "50–80%"
  if (/%|percent/.test(prev.slice(-10))) return false;

  // Applicant counts / years of experience lines: "76 applicants", "5+
  // years" — but never "…$120,000/yr." (salary per year shorthand).
  const expTail = prev.slice(-24);
  if (
    !/\/yr\b|per\s*year/.test(expTail) &&
    /(applicants?|applied|candidates?|years?|yrs?|months?|days?|hours?|week)/.test(expTail)
  ) {
    return false;
  }

  return true;
}

function extractPhonesFrom(text: string): { phone: string; name: string | null; context: string; index: number }[] {
  const out: { phone: string; name: string | null; context: string; index: number }[] = [];
  for (const match of text.matchAll(PHONE_RE)) {
    const raw = match[0].trim();
    const start = Math.max(0, match.index - 90);
    const preceding = text.slice(start, match.index);
    if (!looksLikePhone(raw, preceding)) continue;
    out.push({
      phone: raw.replace(/[\s.]+/g, ' ').trim(),
      name: extractName(preceding),
      context: cleanContext(preceding),
      index: match.index,
    });
  }
  return out;
}

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
  'salary', 'version', 'package', 'annual', 'bonus', 'compensation', 'ref', 'mobile', 'call',
  'phone', 'tel', 'whatsapp', 'number', 'line', 'dial', 'text', 'message', 'per', 'year', 'years',
  'experience', 'total', 'ctc', 'lakhs', 'lpa', 'usd', 'eur', 'inr',
]);

// Job titles/roles that must never be mistaken for a person's surname.
const TITLE_STOPWORDS = new Set([
  'advisor', 'founder', 'director', 'manager', 'recruiter', 'consultant', 'partner', 'lead', 'head',
  'specialist', 'executive', 'engineer', 'developer', 'designer', 'analyst', 'coordinator',
  'representative', 'officer', 'president', 'owner', 'principal', 'associate', 'senior', 'junior',
  'trusted', 'talent', 'people', 'hiring', 'technical', 'business', 'sales', 'marketing', 'account',
  'customer', 'product', 'program', 'project', 'operations', 'human', 'resources', 'chief', 'vp',
  'team', 'recruitment', 'careers', 'staffing', 'professional', 'services', 'solutions', 'group',
  'global', 'seniority', 'experienced', 'independent', 'official', 'staff', 'agent', 'agency',
]);

function extractName(preceding: string): string | null {
  const clean = preceding.replace(/[^\p{L}\s'-]/gu, ' ');
  const words = clean.split(/\s+/).filter(Boolean);
  for (let i = words.length - 1; i >= 1; i--) {
    const a = words[i - 1];
    const b = words[i];
    const al = a.toLowerCase();
    const bl = b.toLowerCase();
    if (/^[A-ZÀ-Ý]/.test(a) && /^[A-ZÀ-Ý]/.test(b) && !TITLE_STOPWORDS.has(bl) && !NAME_STOPWORDS.has(al) && !NAME_STOPWORDS.has(bl)) {
      return `${a} ${b}`;
    }
  }
  return null;
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
  if (!text.trim()) return [];

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
      phone: null,
      name: extractName(preceding),
      type,
      typeLabel,
      context: cleanContext(preceding),
    });
  }

  // Phones: attach to a nearby email when they appear in the same contact
  // block, otherwise list as a phone-only contact.
  const phones = extractPhonesFrom(text);
  for (const p of phones) {
    const near = results.find((r) => {
      if (!r.email) return false;
      const idx = text.indexOf(r.email, Math.max(0, p.index - 200));
      return idx !== -1 && Math.abs(idx - p.index) < 160;
    });
    if (near) {
      near.phone = p.phone;
      if (!near.name) near.name = p.name;
    } else {
      const { type, typeLabel } = classifyType('', company);
      results.push({
        email: null,
        phone: p.phone,
        name: p.name,
        type,
        typeLabel,
        context: p.context,
      });
    }
  }

  return results;
}
