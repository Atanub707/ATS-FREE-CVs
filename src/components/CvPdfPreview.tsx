import React, { useLayoutEffect, useMemo, useRef, useState, useEffect } from 'react';
import { MasterCv, TemplateId } from '../types';

// Normalized shape mirroring server-side TailoredCv (as produced by generatePdfBuffer)
export interface PdfCvShape {
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

// Convert a MasterCv into the same shape the server uses for generatePdfBuffer
export function masterCvToPdfShape(m: MasterCv): PdfCvShape {
  return {
    candidateName: m.fullName || 'CANDIDATE NAME',
    targetRole: m.experiences?.[0]?.title || '',
    contactInfo: {
      email: m.email,
      phone: m.phone,
      location: m.location,
      linkedin: m.linkedin,
      github: m.github,
      website: m.website,
    },
    professionalSummary: m.summary || '',
    technicalSkills: (m.skills || []).map((s) => ({ category: s.category, skills: s.items })),
    workExperience: (m.experiences || []).map((e) => ({
      title: e.title,
      company: e.company,
      location: e.location,
      dates: e.dates,
      highlights: e.responsibilities || [],
    })),
    projects: (m.projects || []).map((p) => ({
      name: p.name,
      description: p.description,
      technologies: p.technologies,
      link: p.link,
      dates: p.dates,
    })),
    education: (m.education || []).map((e) => ({
      degree: e.degree,
      institution: e.institution,
      dates: e.dates,
      details: e.details,
    })),
    certifications: (m.certifications || []).map((c) =>
      typeof c === 'string' ? c : { name: c.name, issuer: c.issuer, date: c.date }
    ),
  };
}

// Convert an AI-compressed CV payload (server analyze/accept shape) into the
// same normalized shape used for PDF rendering.
export function compressedCvToPdfShape(cv: any): PdfCvShape {
  return {
    candidateName: cv.candidateName || '',
    targetRole: cv.targetRole || '',
    contactInfo: cv.contactInfo || {},
    professionalSummary: cv.professionalSummary || '',
    technicalSkills: Array.isArray(cv.technicalSkills) ? cv.technicalSkills : [],
    coreCompetencies: Array.isArray(cv.coreCompetencies) ? cv.coreCompetencies : [],
    workExperience: Array.isArray(cv.workExperience) ? cv.workExperience : [],
    projects: Array.isArray(cv.projects) ? cv.projects : [],
    education: Array.isArray(cv.education) ? cv.education : [],
    certifications: Array.isArray(cv.certifications) ? cv.certifications : [],
  };
}

function getContactItems(cv: PdfCvShape): { label: string; url?: string }[] {
  const items: { label: string; url?: string }[] = [];
  if (cv.contactInfo.email) items.push({ label: cv.contactInfo.email, url: `mailto:${cv.contactInfo.email}` });
  if (cv.contactInfo.phone) items.push({ label: cv.contactInfo.phone });
  if (cv.contactInfo.location) items.push({ label: cv.contactInfo.location });
  if (cv.contactInfo.linkedin) items.push({ label: 'LinkedIn', url: cv.contactInfo.linkedin });
  if (cv.contactInfo.github) items.push({ label: 'GitHub', url: cv.contactInfo.github });
  if (cv.contactInfo.website) items.push({ label: 'Portfolio', url: cv.contactInfo.website });
  return items;
}

// ── Page geometry (Letter 8.5x11 at 72dpi, mirroring pdfkit) ──
const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN_X = 54; // 0.75in
const MARGIN_Y = 43.2; // 0.6in
const CONTENT_W = PAGE_W - MARGIN_X * 2; // 504
const CONTENT_H = PAGE_H - MARGIN_Y * 2; // 705.6

// Scale a pt value to the current zoom (all sizes scale linearly, so the
// wrap points and relative heights stay identical at every zoom level).
const pt = (v: number, zoom: number) => Math.round(v * (zoom / 100));

// ── Template styles — same structure/blocks for all three, only the
//    visual treatment changes (colors, name size, density, rules).
//    All variants stay single-column with standard headings → ATS-safe.
export interface CvTemplateStyle {
  accent: string;           // section headers / rules
  nameSize: number;
  roleColor: string;
  ruleWidth: number;        // section rule thickness
  bodySize: number;
  bulletSize: number;
  sectionGap: number;       // spacing before a section title
  expTitleSize: number;
  lineHeight: number;
  nameWeight: number;
}

export const CV_TEMPLATE_STYLES: Record<TemplateId, CvTemplateStyle> = {
  'harvard': {
    accent: '#2F54EB', nameSize: 18, roleColor: '#374151', ruleWidth: 0.75,
    bodySize: 9.5, bulletSize: 9.5, sectionGap: 10, expTitleSize: 10, lineHeight: 1.45, nameWeight: 700,
  },
  'modern-minimal': {
    accent: '#111827', nameSize: 20, roleColor: '#565D6C', ruleWidth: 1.25,
    bodySize: 9.5, bulletSize: 9.5, sectionGap: 14, expTitleSize: 10, lineHeight: 1.5, nameWeight: 800,
  },
  'compact-executive': {
    accent: '#1E3A5F', nameSize: 15, roleColor: '#475569', ruleWidth: 0.5,
    bodySize: 8.5, bulletSize: 8.5, sectionGap: 7, expTitleSize: 9, lineHeight: 1.35, nameWeight: 700,
  },
};

// A single atomic layout unit. `keepAfter` mirrors pdfkit's ensurePageSpace:
// the block requires at least that many pt to remain below it, otherwise it
// moves to the next page (prevents orphaned section titles / headers).
interface CvBlock {
  key: string;
  keepAfter?: number;
  render: (zoom: number) => React.ReactNode;
}

interface CvPdfPreviewProps {
  cv: PdfCvShape;
  zoom?: number;
  template?: TemplateId;
  onPageCount?: (n: number) => void;
  /** Auto-scale pages to fill the container width (up to 100%) — use in
   *  side-by-side views so pages use the full lane without side gaps. */
  fitToWidth?: boolean;
}

/**
 * HTML replica of the server-side PDF (docxGenerator.ts / generatePdfBuffer),
 * rendered PAGE-WISE: content that exceeds one Letter page flows onto the
 * next sheet, using the same break rules as pdfkit (section headers and
 * experience headers keep with their content; bullets are atomic).
 */
export const CvPdfPreview: React.FC<CvPdfPreviewProps> = ({ cv, zoom = 100, template = 'harvard', onPageCount, fitToWidth = false }) => {
  const style = CV_TEMPLATE_STYLES[template] || CV_TEMPLATE_STYLES.harvard;
  const blocks = useMemo(() => buildBlocks(cv, style), [cv, style]);
  const measurerRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<CvBlock[][]>([]);
  const [fitZoom, setFitZoom] = useState<number>(zoom);

  useEffect(() => {
    onPageCount?.(pages.length);
  }, [pages, onPageCount]);

  // Auto-fit: measure the container and scale pages to fill its width.
  useEffect(() => {
    if (!fitToWidth) { setFitZoom(zoom); return; }
    const el = rootRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      if (w > 0) {
        // leave ~16px breathing room, cap at 100%, snap to 5%
        const z = Math.min(100, Math.floor(((w - 16) / PAGE_W) * 100 / 5) * 5);
        setFitZoom(Math.max(40, z));
      }
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [fitToWidth, zoom]);

  const effectiveZoom = fitToWidth ? fitZoom : zoom;

  // Measure every block at 100% zoom (exact PDF metrics), then paginate.
  useLayoutEffect(() => {
    const el = measurerRef.current;
    if (!el) return;
    const heights: Record<string, number> = {};
    Array.from(el.children).forEach((child, i) => {
      heights[blocks[i]?.key ?? ''] = (child as HTMLElement).getBoundingClientRect().height;
    });
    setPages(paginate(blocks, heights));
  }, [blocks]);

  return (
    <div ref={rootRef} className="flex flex-col items-center gap-6 w-full">
      {/* Hidden measurer — renders every block at 100% with the exact PDF
          content width so heights are measured truthfully. */}
      <div
        ref={measurerRef}
        aria-hidden
        style={{
          position: 'absolute',
          left: -99999,
          top: 0,
          width: CONTENT_W,
          fontFamily: 'Helvetica, Arial, sans-serif',
          color: '#1F2937',
          fontSize: '9.5px',
          lineHeight: 1.45,
          visibility: 'hidden',
          pointerEvents: 'none',
        }}
      >
        {blocks.map((b) => (
          <div key={b.key}>{b.render(100)}</div>
        ))}
      </div>

      {/* Stacked A4 pages */}
      {pages.map((page, pi) => (
        <div
          key={pi}
          className="bg-white shadow-2xl rounded-sm"
          style={{
            width: pt(PAGE_W, effectiveZoom),
            height: pt(PAGE_H, effectiveZoom),
            padding: `${pt(MARGIN_Y, effectiveZoom)}px ${pt(MARGIN_X, effectiveZoom)}px`,
            overflow: 'hidden',
            fontFamily: 'Helvetica, Arial, sans-serif',
            color: '#1F2937',
            fontSize: `${pt(9.5, effectiveZoom)}px`,
            lineHeight: 1.45,
          }}
        >
          {page.map((b) => (
            <div key={b.key}>{b.render(effectiveZoom)}</div>
          ))}
        </div>
      ))}
    </div>
  );
};

// ── Pagination: greedy page fill with orphan protection ──
function paginate(blocks: CvBlock[], heights: Record<string, number>): CvBlock[][] {
  const pages: CvBlock[][] = [];
  let current: CvBlock[] = [];
  let used = 0;

  for (const b of blocks) {
    const h = heights[b.key] ?? 16;
    const required = h + (b.keepAfter ?? 0);
    if (used > 0 && used + required > CONTENT_H) {
      pages.push(current);
      current = [];
      used = 0;
    }
    current.push(b);
    used += h;
  }
  if (current.length > 0) pages.push(current);
  return pages;
}

// ── Build the atomic block list in document order ──
function buildBlocks(cv: PdfCvShape, s: CvTemplateStyle): CvBlock[] {
  const blocks: CvBlock[] = [];
  const contacts = getContactItems(cv);
  const hasTechSkills = cv.technicalSkills.length > 0 || (cv.coreCompetencies?.length || 0) > 0;

  const section = (title: string): CvBlock => ({
    key: `sec-${title}`,
    keepAfter: 40, // never orphan a section title at the bottom of a page
    render: (zoom) => <SectionTitle zoom={zoom} style={s}>{title}</SectionTitle>,
  });

  // 1. Name + role + contact (always together)
  blocks.push({
    key: 'header',
    render: (zoom) => (
      <div style={{ paddingBottom: pt(4, zoom) }}>
        <div
          style={{
            textAlign: 'center',
            fontFamily: 'Helvetica-Bold, Helvetica, Arial, sans-serif',
            fontSize: `${pt(s.nameSize, zoom)}px`,
            fontWeight: s.nameWeight,
            color: '#111827',
            textTransform: 'uppercase',
            letterSpacing: s.nameSize >= 20 ? '0.05em' : '0.02em',
          }}
        >
          {cv.candidateName || 'CANDIDATE NAME'}
        </div>
        {cv.targetRole && (
          <div
            style={{
              textAlign: 'center',
              fontWeight: 700,
              fontSize: `${pt(10, zoom)}px`,
              color: s.roleColor,
              paddingTop: pt(3, zoom),
            }}
          >
            {cv.targetRole}
          </div>
        )}
        {contacts.length > 0 && (
          <div style={{ textAlign: 'center', fontSize: `${pt(9, zoom)}px`, paddingTop: pt(6, zoom) }}>
            {contacts.map((c, i) => (
              <React.Fragment key={i}>
                {i > 0 && <span style={{ color: '#9CA3AF', margin: `0 ${pt(5, zoom)}px` }}>•</span>}
                {c.url ? (
                  <a href={c.url} target="_blank" rel="noopener noreferrer" style={{ color: '#0055BB', textDecoration: 'underline' }}>
                    {c.label}
                  </a>
                ) : (
                  <span style={{ color: '#374151' }}>{c.label}</span>
                )}
              </React.Fragment>
            ))}
          </div>
        )}
      </div>
    ),
  });

  // 2. Professional Summary
  if (cv.professionalSummary) {
    blocks.push(section('PROFESSIONAL SUMMARY'));
    blocks.push({
      key: 'summary',
      render: (zoom) => (
        <div style={{ color: '#1F2937', fontSize: `${pt(s.bodySize, zoom)}px`, lineHeight: s.lineHeight, paddingBottom: pt(4, zoom) }}>{cv.professionalSummary}</div>
      ),
    });
  }

  // 3. Technical Skills
  if (hasTechSkills) {
    blocks.push(section('TECHNICAL SKILLS & COMPETENCIES'));
    cv.technicalSkills.forEach((cat, i) => {
      blocks.push({
        key: `skill-${i}`,
        render: (zoom) => (
          <div style={{ fontSize: `${pt(s.bodySize, zoom)}px`, lineHeight: s.lineHeight, paddingBottom: pt(3, zoom) }}>
            <span style={{ fontWeight: 700, color: '#111827' }}>{cat.category}: </span>
            <span style={{ color: '#374151' }}>{cat.skills.join(', ')}</span>
          </div>
        ),
      });
    });
    if (cv.technicalSkills.length === 0 && cv.coreCompetencies) {
      blocks.push({
        key: 'skill-competencies',
        render: (zoom) => (
          <div style={{ color: '#1F2937', fontSize: `${pt(s.bodySize, zoom)}px`, lineHeight: s.lineHeight, paddingBottom: pt(3, zoom) }}>{cv.coreCompetencies.join(', ')}</div>
        ),
      });
    }
  }

  // 4. Professional Experience
  if (cv.workExperience.length > 0) {
    blocks.push(section('PROFESSIONAL EXPERIENCE'));
    cv.workExperience.forEach((exp, i) => {
      // Header stays with at least one bullet (pdfkit ensurePageSpace(45))
      blocks.push({
        key: `exp-${i}-head`,
        keepAfter: 30,
        render: (zoom) => (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, paddingBottom: pt(2, zoom) }}>
            <span style={{ fontWeight: 700, fontSize: `${pt(s.expTitleSize, zoom)}px`, color: '#111827' }}>
              {[exp.title, exp.company].filter(Boolean).join('   |   ')}
            </span>
            <span style={{ fontStyle: 'italic', fontSize: `${pt(8.5, zoom)}px`, color: '#4B5563', whiteSpace: 'nowrap' }}>
              {[exp.dates, exp.location].filter(Boolean).join('   |   ')}
            </span>
          </div>
        ),
      });
      exp.highlights.forEach((hl, j) => {
        blocks.push({
          key: `exp-${i}-b${j}`,
          render: (zoom) => <Bullet zoom={zoom} text={hl} style={s} />,
        });
      });
    });
  }

  // 5. Featured Projects
  if (cv.projects && cv.projects.length > 0) {
    blocks.push(section('FEATURED PROJECTS'));
    cv.projects.forEach((p, i) => {
      blocks.push({
        key: `proj-${i}-head`,
        keepAfter: 25,
        render: (zoom) => (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, paddingBottom: pt(2, zoom) }}>
            <span style={{ fontWeight: 700, fontSize: `${pt(s.expTitleSize, zoom)}px`, color: '#111827' }}>
              {p.name}
              {p.link && (
                <a href={p.link} target="_blank" rel="noopener noreferrer" style={{ color: '#0055BB', fontSize: `${pt(9, zoom)}px`, fontWeight: 400, marginLeft: pt(6, zoom) }}>
                  | View Project
                </a>
              )}
            </span>
            {p.dates && (
              <span style={{ fontStyle: 'italic', fontSize: `${pt(8.5, zoom)}px`, color: '#4B5563', whiteSpace: 'nowrap' }}>
                {p.dates}
              </span>
            )}
          </div>
        ),
      });
      if (p.technologies && p.technologies.length > 0) {
        blocks.push({
          key: `proj-${i}-tech`,
          render: (zoom) => (
            <div style={{ fontSize: `${pt(9, zoom)}px`, lineHeight: s.lineHeight, paddingBottom: pt(2, zoom) }}>
              <span style={{ fontWeight: 700, color: '#374151' }}>Technologies: </span>
              <span style={{ color: '#4B5563' }}>{p.technologies.join(', ')}</span>
            </div>
          ),
        });
      }
      if (p.description) {
        blocks.push({ key: `proj-${i}-desc`, render: (zoom) => <Bullet zoom={zoom} text={p.description} style={s} /> });
      }
    });
  }

  // 6. Education
  if (cv.education.length > 0) {
    blocks.push(section('EDUCATION'));
    cv.education.forEach((e, i) => {
      blocks.push({
        key: `edu-${i}`,
        keepAfter: 15,
        render: (zoom) => (
          <div style={{ fontSize: `${pt(s.bodySize, zoom)}px`, lineHeight: s.lineHeight, paddingBottom: pt(6, zoom) }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
              <span style={{ fontWeight: 700, fontSize: `${pt(s.expTitleSize, zoom)}px`, color: '#111827' }}>{e.degree}</span>
              {e.dates && (
                <span style={{ fontStyle: 'italic', fontSize: `${pt(8.5, zoom)}px`, color: '#4B5563', whiteSpace: 'nowrap' }}>
                  {e.dates}
                </span>
              )}
            </div>
            <div style={{ color: '#374151' }}>{e.institution}</div>
          </div>
        ),
      });
    });
  }

  // 7. Certifications
  if (cv.certifications && cv.certifications.length > 0) {
    blocks.push(section('CERTIFICATIONS & CREDENTIALS'));
    cv.certifications.forEach((cert, i) => {
      const parts = typeof cert === 'string' ? [cert] : [cert.name, cert.issuer, cert.date].filter(Boolean);
      blocks.push({ key: `cert-${i}`, render: (zoom) => <Bullet zoom={zoom} text={parts.join('   |   ')} style={s} /> });
    });
  }

  return blocks;
}

const SectionTitle: React.FC<{ zoom: number; style: CvTemplateStyle; children: React.ReactNode }> = ({ zoom, style, children }) => (
  <div style={{ paddingTop: pt(style.sectionGap, zoom), paddingBottom: pt(6, zoom) }}>
    <div
      style={{
        fontWeight: 700,
        fontSize: `${pt(10.5, zoom)}px`,
        color: style.accent,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
      }}
    >
      {children}
    </div>
    <div style={{ height: Math.max(1, Math.round(style.ruleWidth * (zoom / 100))), background: style.accent, opacity: 0.6, marginTop: pt(3, zoom) }} />
  </div>
);

const Bullet: React.FC<{ zoom: number; text: string; style: CvTemplateStyle }> = ({ zoom, text, style }) => {
  const clean = String(text || '').replace(/^[*•\-]\s*/, '').trim();
  if (!clean) return null;
  return (
    <div style={{ display: 'flex', gap: pt(6, zoom), fontSize: `${pt(style.bulletSize, zoom)}px`, lineHeight: style.lineHeight, paddingBottom: pt(2, zoom) }}>
      <span style={{ color: '#4B5563', flexShrink: 0 }}>•</span>
      <span style={{ color: '#1F2937' }}>{clean}</span>
    </div>
  );
};
