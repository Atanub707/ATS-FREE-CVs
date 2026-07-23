export function getValidJobUrl(job: { url?: string; title?: string; company?: string; source?: string; id?: string }): string {
  const url = job.url?.trim() || '';
  const id = job.id?.trim() || '';

  // 1. Extract real numeric LinkedIn job ID (7 to 11 digits) from URL or ID
  const numericMatch =
    url.match(/\/view\/.*?(\d{7,11})/) ||
    url.match(/-(\d{7,11})/) ||
    url.match(/(\d{7,11})/) ||
    id.match(/(\d{7,11})/);

  if (numericMatch && numericMatch[1]) {
    return `https://www.linkedin.com/jobs/view/${numericMatch[1]}`;
  }

  // 2. Handle Indeed jobs
  if (job.source === 'Indeed') {
    if (url.startsWith('http') && !url.includes('ind-') && url.includes('viewjob?jk=')) {
      return url;
    }
    const query = [job.title, job.company].filter(Boolean).join(' ');
    return `https://www.indeed.com/jobs?q=${encodeURIComponent(query)}`;
  }

  // 3. Handle Glassdoor jobs
  if (job.source === 'Glassdoor') {
    const query = [job.title, job.company].filter(Boolean).join(' ');
    return `https://www.glassdoor.com/Job/jobs.htm?sc.keyword=${encodeURIComponent(query)}`;
  }

  // 4. If already a direct clean LinkedIn view URL, return it
  if (url.startsWith('https://www.linkedin.com/jobs/view/') && !url.includes('undefined')) {
    return url;
  }

  // 5. Fallback for LinkedIn or unspecified source: direct search query for exact position & company
  const query = [job.title, job.company].filter(Boolean).join(' ');
  if (query) {
    return `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(query)}`;
  }

  return 'https://www.linkedin.com/jobs/search/?keywords=Software+Engineer';
}
