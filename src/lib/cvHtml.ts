import { TemplateId } from '../types';

// ── Single source of truth for CV rendering ──
// Both the in-app preview and the server-side PDF use this exact HTML, so
// what users see is byte-for-byte what downloads.

export interface CvRenderShape {
  candidateName: string;
  targetRole?: string;
  contactInfo: {
    email?: string;
    phone?: string;
    location?: string;
    linkedin?: string;
    github?: string;
    website?: string;
  };
  professionalSummary: string;
  technicalSkills: { category: string; skills: string[] }[];
  coreCompetencies?: string[];
  workExperience: { title: string; company: string; location?: string; dates: string; highlights: string[] }[];
  projects?: { name: string; description?: string; technologies?: string[]; link?: string; dates?: string }[];
  education: { degree: string; institution: string; dates: string; details?: string }[];
  certifications?: (string | { name: string; issuer?: string; date?: string; link?: string })[];
}

export const CV_GEOMETRY: Record<TemplateId, { marginX: number; marginY: number; lineHeight: number }> = {
  harvard: { marginX: 50.4, marginY: 43.2, lineHeight: 1.3 },
  jake: { marginX: 36, marginY: 32.4, lineHeight: 1.35 },
  atanu: { marginX: 36, marginY: 32.4, lineHeight: 1.42 },
};

function esc(s: any): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function contactItems(cv: CvRenderShape): { label: string; url?: string }[] {
  const items: { label: string; url?: string }[] = [];
  const c = cv.contactInfo || {};
  if (c.email) items.push({ label: String(c.email), url: `mailto:${c.email}` });
  if (c.phone) items.push({ label: String(c.phone) });
  if (c.location) items.push({ label: String(c.location) });
  if (c.linkedin) items.push({ label: 'LinkedIn', url: String(c.linkedin) });
  if (c.github) items.push({ label: 'GitHub', url: String(c.github) });
  if (c.website) items.push({ label: 'Portfolio', url: String(c.website) });
  return items;
}

function bulletList(items: string[], cls: string): string {
  const lis = items
    .map((t) => String(t || '').replace(/^[*•\-]\s*/, '').trim())
    .filter(Boolean)
    .map((t) => `<li>${esc(t)}</li>`)
    .join('');
  return `<ul class="${cls}">${lis}</ul>`;
}

function skillsTwoCol(cv: CvRenderShape, withBullets: boolean): string {
  const cats = (cv.technicalSkills || [])
    .map((c) => ({ name: esc(c.category), list: esc((c.skills || []).join(', ')) }))
    .filter((c) => c.name || c.list);
  if (cats.length === 0) {
    const comps = (cv.coreCompetencies || []).map(esc).filter(Boolean);
    if (comps.length === 0) return '';
    return `<div class="skills-comp">${comps.join(', ')}</div>`;
  }
  const cls = withBullets ? 'skills-grid' : 'skills-grid plain';
  return `<ul class="${cls}">${cats.map((c) => `<li><b>${c.name}:</b> ${c.list}</li>`).join('')}</ul>`;
}

function skillsLines(cv: CvRenderShape): string {
  const cats = (cv.technicalSkills || [])
    .map((c) => ({ name: esc(c.category), list: esc((c.skills || []).join(', ')) }))
    .filter((c) => c.name || c.list);
  if (cats.length === 0) {
    const comps = (cv.coreCompetencies || []).map(esc).filter(Boolean);
    return comps.length ? `<div class="skills-line"><b>Technical:</b> ${comps.join(', ')}</div>` : '';
  }
  return cats.map((c) => `<div class="skills-line"><b>${c.name}:</b> ${c.list}</div>`).join('');
}

function projectYears(cv: CvRenderShape): string {
  const years: number[] = [];
  for (const p of cv.projects || []) {
    const m = /(19|20)\d{2}/.exec(String(p.dates || ''));
    if (m) years.push(parseInt(m[0], 10));
  }
  return years.length > 0 ? ` (${Math.min(...years)} – ${Math.max(...years)})` : '';
}

function educationHtml(cv: CvRenderShape): string {
  return (cv.education || [])
    .map((e) => {
      const inst = esc(e.institution);
      const deg = e.degree ? '  —  ' + esc(e.degree) : '';
      const dates = e.dates ? '&nbsp;&nbsp;' + esc(e.dates) : '';
      return `<div class="edu-line"><b>${inst}</b>${deg}${dates}</div>`;
    })
    .join('');
}

function certHtml(cv: CvRenderShape): string {
  return (cv.certifications || [])
    .map((cert) => {
      let name = '';
      let issuer = '';
      if (typeof cert === 'string') name = cert;
      else { name = cert.name || ''; issuer = cert.issuer || ''; }
      if (!name) return '';
      return `<div class="cert-line">${issuer ? `<b>${esc(issuer)}</b>  —  ` : ''}${esc(name)}</div>`;
    })
    .join('');
}

function workHtml(cv: CvRenderShape, orgBold: boolean): string {
  return (cv.workExperience || [])
    .map((exp) => {
      const org = exp.company ? esc(exp.company) : '';
      const city = exp.location ? esc(exp.location) : '';
      const title = exp.title ? esc(exp.title) : '';
      const period = exp.dates ? esc(exp.dates) : '';
      const bullets = bulletList(exp.highlights || [], 'bullets');
      if (orgBold) {
        return `<div class="entry"><div class="entry-top"><span class="entry-org">${org}</span><span class="entry-city">${city}</span></div><div class="entry-top"><span class="entry-title">${title}</span><span class="entry-period">${period}</span></div>${bullets}</div>`;
      }
      return `<div class="job"><div class="job-top"><span><span class="job-role">${title}</span>${org ? `<span class="job-company">  —  ${org}</span>` : ''}</span><span class="job-period">${period}</span></div>${city ? `<div class="job-loc">${city}</div>` : ''}${bullets}</div>`;
    })
    .join('');
}

function projectsHtml(cv: CvRenderShape, withBullets: boolean): string {
  return (cv.projects || [])
    .map((p) => {
      const name = esc(p.name);
      const dates = p.dates ? esc(p.dates) : '';
      const desc = p.description ? esc(String(p.description).replace(/^[*•\-]\s*/, '').trim()) : '';
      const link = p.link ? `<a href="${esc(p.link)}">${esc(p.link)}</a>` : '';
      const head = withBullets
        ? `<div class="entry-top"><span class="entry-org">${name}</span>${dates ? `<span class="entry-period">[${dates}]</span>` : ''}</div>${desc ? bulletList([desc], 'bullets') : ''}`
        : `<span class="proj-title">${name}</span>${dates ? `<span class="proj-period">  [${dates}]</span>` : ''}<br>${desc ? `<div class="proj-desc">${desc}</div>` : ''}`;
      return `<div class="proj">${head}${link ? `<div class="proj-link">${link}</div>` : ''}</div>`;
    })
    .join('');
}

function headerHtml(cv: CvRenderShape, style: 'harvard' | 'jake' | 'atanu'): string {
  const contacts = contactItems(cv);
  const contactLine = contacts
    .map((c, i) => {
      const sep = style === 'harvard' ? '<span class="sep">•</span>' : '<span class="sep">|</span>';
      const item = c.url ? `<a href="${esc(c.url)}">${esc(c.label)}</a>` : esc(c.label);
      return (i > 0 ? sep : '') + item;
    })
    .join('');
  const role = cv.targetRole ? esc(cv.targetRole) : '';
  if (style === 'jake') {
    return `<header class="jake"><h1>${esc(cv.candidateName || 'CANDIDATE NAME')}</h1>${role ? `<div class="role">${role}</div>` : ''}<div class="contact">${contactLine}</div></header>`;
  }
  if (style === 'atanu') {
    return `<header class="atanu"><h1>${esc(cv.candidateName || 'CANDIDATE NAME')}</h1>${role ? `<div class="role">${esc(role.toUpperCase())}</div>` : ''}<div class="contact">${contactLine}</div></header>`;
  }
  // harvard
  return `<header class="harvard"><h1>${esc(cv.candidateName || 'CANDIDATE NAME').toUpperCase()}</h1><div class="contact">${contactLine}</div></header>`;
}

export function renderCvHtml(cv: CvRenderShape, template: TemplateId = 'harvard'): string {
  const geom = CV_GEOMETRY[template] || CV_GEOMETRY.harvard;
  const mx = geom.marginX;
  const my = geom.marginY;
  const lh = geom.lineHeight;

  const summary = cv.professionalSummary
    ? `<section><h2>${template === 'atanu' ? 'Summary' : 'Summary'}</h2><p class="summary">${esc(cv.professionalSummary)}</p></section>`
    : '';

  const education = (cv.education || []).length
    ? `<section><h2>${template === 'jake' ? 'Education' : 'Education'}</h2>${educationHtml(cv)}</section>`
    : '';

  const work = (cv.workExperience || []).length
    ? `<section><h2>${template === 'atanu' ? 'Work Experience' : template === 'jake' ? 'Experience' : 'Experience'}</h2>${workHtml(cv, template === 'harvard')}</section>`
    : '';

  const projects = (cv.projects || []).length
    ? `<section><h2>${template === 'atanu' ? 'Projects' + projectYears(cv) : 'Projects'}</h2>${projectsHtml(cv, template === 'harvard')}</section>`
    : '';

  const skillsSection = (cv.technicalSkills || []).length || (cv.coreCompetencies || []).length
    ? `<section><h2>${template === 'harvard' ? 'Skills &amp; Interests' : 'Skills'}</h2>${template === 'harvard' ? skillsLines(cv) : skillsTwoCol(cv, template === 'atanu')}</section>`
    : '';

  const certs = (cv.certifications || []).length
    ? `<section><h2>Certifications</h2>${certHtml(cv)}</section>`
    : '';

  let css = '';
  if (template === 'harvard') {
    css = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page { size: letter; margin: ${my / 72}in ${mx / 72}in; }
  body { font-family: Calibri, "Helvetica Neue", Helvetica, Arial, sans-serif; font-size: 10.5px; color: #111111; line-height: ${lh}; }
  header.harvard { text-align: center; margin-bottom: 8px; }
  header.harvard h1 { font-size: 15px; font-weight: 700; letter-spacing: 0.5px; }
  header.harvard .contact { font-size: 10px; margin-top: 3px; }
  header.harvard .contact .sep { padding: 0 4px; }
  h2 { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; text-align: center; margin: 10px 0 5px; }
  .summary { text-align: justify; }
  ul { list-style: none; }
  ul.bullets li { padding-left: 13px; position: relative; margin-bottom: 2.5px; text-align: justify; }
  ul.bullets li::before { content: "\\2022"; position: absolute; left: 0; }
  .entry { margin-bottom: 7px; }
  .entry-top { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
  .entry-org { font-weight: 700; }
  .entry-city { white-space: nowrap; }
  .entry-title { font-weight: 700; margin-top: 1px; }
  .entry-period { white-space: nowrap; }
  .skills-line { margin-bottom: 2.5px; }
  .skills-line b { font-weight: 700; }
  .edu-line, .cert-line { margin-bottom: 2px; }
  .edu-line b, .cert-line b { font-weight: 700; }
  .proj { margin-bottom: 7px; }
  .proj-link a { color: #111111; text-decoration: none; }
  a { color: #111111; text-decoration: none; }`;
  } else if (template === 'jake') {
    css = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page { size: letter; margin: ${my / 72}in ${mx / 72}in; }
  body { font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; font-size: 9px; color: #1a1a1a; line-height: ${lh}; }
  header.jake { margin-bottom: 8px; }
  header.jake h1 { font-size: 24px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; }
  header.jake .role { font-size: 11.5px; font-weight: 600; color: #555555; margin: 2px 0 6px; }
  header.jake .contact { font-size: 9.5px; color: #444444; }
  header.jake .contact .sep { color: #AAAAAA; padding: 0 5px; }
  header.jake .contact a { color: #111111; text-decoration: none; border-bottom: 1px solid #BBBBBB; }
  h2 { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.2px; color: #111111; border-bottom: 1px solid #111111; padding-bottom: 3px; margin: 8px 0 5px; }
  .summary { text-align: justify; }
  ul { list-style: none; }
  ul.bullets li { padding-left: 12px; position: relative; margin-bottom: 1.5px; text-align: justify; }
  ul.bullets li::before { content: "\\2014"; position: absolute; left: 0; color: #111111; }
  ul.skills-grid { display: grid; grid-template-columns: 1fr 1fr; column-gap: 20px; }
  ul.skills-grid li { text-align: left; margin-bottom: 2.5px; }
  ul.skills-grid b { color: #111111; }
  .job { margin-bottom: 6px; }
  .job-top { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; }
  .job-role { font-size: 9.5px; font-weight: 700; color: #111111; }
  .job-company { font-size: 9.5px; color: #555555; }
  .job-period { font-size: 8.5px; color: #777777; white-space: nowrap; }
  .job-loc { font-size: 9px; color: #777777; }
  .proj { margin-bottom: 3px; }
  .proj-title { font-weight: 700; color: #111111; }
  .proj-period { font-size: 8.5px; color: #777777; }
  .proj-desc { margin-top: 1px; }
  .proj-link a { color: #111111; text-decoration: none; border-bottom: 1px solid #BBBBBB; }
  .edu-line, .cert-line { margin-bottom: 1.5px; }
  .edu-line b, .cert-line b { color: #111111; }
  a { color: #111111; text-decoration: none; border-bottom: 1px solid #BBBBBB; }`;
  } else {
    css = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page { size: letter; margin: ${my / 72}in ${mx / 72}in; }
  body { font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; font-size: 9.5px; color: #1f2937; line-height: ${lh}; }
  header.atanu { text-align: center; margin-bottom: 10px; }
  header.atanu h1 { font-size: 24px; letter-spacing: 3px; color: #0f172a; margin-bottom: 3px; }
  header.atanu .role { font-size: 12px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: #0f766e; margin-bottom: 3px; }
  header.atanu .contact { font-size: 9px; color: #374151; }
  header.atanu .contact a { color: #0f766e; text-decoration: none; }
  header.atanu .contact .sep { color: #9ca3af; padding: 0 4px; }
  h2 { font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #0f766e; border-bottom: 1.2px solid #0f766e; padding-bottom: 2px; margin: 10px 0 6px; }
  .summary { text-align: justify; }
  ul { list-style: none; }
  ul.bullets li { padding-left: 11px; position: relative; margin-bottom: 2.5px; text-align: justify; }
  ul.bullets li::before { content: "\\2022"; position: absolute; left: 0; color: #0f766e; font-weight: bold; }
  ul.skills-grid { display: grid; grid-template-columns: 1fr 1fr; column-gap: 18px; }
  ul.skills-grid li { text-align: left; margin-bottom: 2.5px; }
  ul.skills-grid li::before { color: #0f766e; font-weight: bold; }
  .job { margin-bottom: 8px; }
  .job-top { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; }
  .job-role { font-size: 10.5px; font-weight: 700; color: #0f172a; }
  .job-company { font-size: 10.5px; font-weight: 700; color: #0f766e; }
  .job-period { font-size: 9px; color: #6b7280; white-space: nowrap; }
  .job-loc { font-size: 9px; color: #6b7280; margin-bottom: 3px; }
  .proj { margin-bottom: 4px; }
  .proj-title { font-weight: 700; color: #0f172a; }
  .proj-period { font-size: 9px; color: #6b7280; }
  .proj-desc { margin-top: 1px; }
  .proj-link a { color: #0f766e; text-decoration: none; }
  .edu-line, .cert-line { margin-bottom: 2px; }
  .edu-line b, .cert-line b { color: #0f172a; }
  a { color: #0f766e; text-decoration: none; }`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${esc(cv.candidateName || 'CV')}</title>
<style>${css}
</style>
</head>
<body>
${headerHtml(cv, template)}
${summary}
${education}
${work}
${projects}
${skillsSection}
${certs}
</body>
</html>`;
}
