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
