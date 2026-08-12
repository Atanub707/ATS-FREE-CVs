export function matchesSearch(contact: { name?: string | null; recruiterName?: string | null; email?: string | null; phone?: string | null; company: string }, q: string): boolean {
  const ql = q.trim().toLowerCase();
  if (!ql) return true;
  return [
    contact.name || '',
    contact.recruiterName || '',
    contact.email || '',
    contact.phone || '',
    contact.company || '',
  ].some((v) => v.toLowerCase().includes(ql));
}

export type ContactLite = {
  name?: string | null; company: string; type: string; lastSeen?: string;
  jobCount: number; lastEmailSent?: string;
};

export const TYPE_LABELS: Record<string, string> = { recruit: 'Recruiter', hr: 'HR', careers: 'Careers', company: 'Company' };

export function filterByType(c: ContactLite, t: string): boolean {
  return t === 'all' || c.type === t;
}

export function sortContacts<T extends ContactLite>(list: T[], by: string): T[] {
  const out = [...list];
  switch (by) {
    case 'name': return out.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    case 'company': return out.sort((a, b) => a.company.localeCompare(b.company));
    case 'job_count': return out.sort((a, b) => b.jobCount - a.jobCount);
    case 'last_email_sent': return out.sort((a, b) => (b.lastEmailSent || '').localeCompare(a.lastEmailSent || ''));
    default: return out.sort((a, b) => (b.lastSeen || '').localeCompare(a.lastSeen || ''));
  }
}

export function typeCounts(list: ContactLite[]): Record<string, number> {
  return list.reduce<Record<string, number>>((acc, c) => {
    acc[c.type] = (acc[c.type] || 0) + 1;
    return acc;
  }, {});
}
