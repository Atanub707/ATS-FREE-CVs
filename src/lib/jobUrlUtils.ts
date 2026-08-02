export function getValidJobUrl(job: { url?: string; title?: string; company?: string; source?: string; id?: string }): string {
  const url = job.url?.trim() || '';
  const id = job.id?.trim() || '';

  // 1. Handle Dice jobs
  if (job.source === 'Dice') {
    if (url.startsWith('http') && url.includes('dice.com/job-detail/')) return url;
    const query = [job.title, job.company].filter(Boolean).join(' ');
    return `https://www.dice.com/jobs?q=${encodeURIComponent(query)}`;
  }

  // 2. Handle SimplyHired jobs
  if (job.source === 'SimplyHired') {
    if (url.startsWith('http') && url.includes('simplyhired.com')) return url;
    const query = [job.title, job.company].filter(Boolean).join(' ');
    return `https://www.simplyhired.com/search?q=${encodeURIComponent(query)}`;
  }

  // 3. Handle Reed jobs
  if (job.source === 'Reed') {
    if (url.startsWith('http') && url.includes('reed.co.uk/jobs/')) return url;
    const query = [job.title, job.company].filter(Boolean).join(' ');
    return `https://www.reed.co.uk/jobs/${encodeURIComponent(query.replace(/\s+/g, '-'))}-jobs`;
  }

  // For non-LinkedIn sources (SimplyHired, Dice, etc.)
  // Extract real numeric LinkedIn job ID (7 to 11 digits) from URL or ID
  // Only for LinkedIn or unspecified sources
  if (job.source !== 'LinkedIn' && job.source !== undefined) {
    // Non-LinkedIn sources with valid external URLs
    if (url.startsWith('http') && !url.includes('linkedin.com')) return url;
    const query = [job.title, job.company].filter(Boolean).join(' ');
    return `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(query)}`;
  }

  const numericMatch =
    url.match(/\/view\/.*?(\d{7,11})/) ||
    url.match(/-(\d{7,11})/) ||
    url.match(/(\d{7,11})/) ||
    id.match(/(\d{7,11})/);

  if (numericMatch && numericMatch[1]) {
    return `https://www.linkedin.com/jobs/view/${numericMatch[1]}`;
  }

  // 5. If already a direct clean LinkedIn view URL
  if (url.startsWith('https://www.linkedin.com/jobs/view/') && !url.includes('undefined')) {
    return url;
  }

  // 6. Fallback for LinkedIn or unspecified source: direct search query
  const query = [job.title, job.company].filter(Boolean).join(' ');
  if (query) {
    return `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(query)}`;
  }

  return 'https://www.linkedin.com/jobs/search/?keywords=Software+Engineer';
}
