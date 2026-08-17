import { TemplateId } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Shared CV rendering configuration — the SINGLE source of truth for page
// geometry and typography, consumed by BOTH the browser preview
// (CvPdfPreview.tsx) and the PDF generator (docxGenerator.ts).
//
// PDFKit was the authoritative baseline for the numbers below; the preview
// now consumes the same values so both renderers lay out identical content
// with identical widths.
//
// CSS line-height (multiplicative) and PDFKit lineGap (additive points) are
// different layout models — each template stores both representations.
// ─────────────────────────────────────────────────────────────────────────────

export const CV_PAGE = {
  width: 612,   // pt — US Letter @ 72dpi
  height: 792,
  unit: 'pt' as const,
};

export interface CvTemplateGeometry {
  // Page geometry (pt)
  marginLeft: number;
  marginRight: number;
  marginTop: number;
  marginBottom: number;
  skillsColumnGap: number; // 0 = single column (Harvard)

  // Typography
  nameSize: number;
  roleSize: number;
  headingSize: number;
  expTitleSize: number;
  bodySize: number;
  bulletSize: number;
  skillCategorySize: number;
  /** CSS line-height multiplier for the browser preview. */
  bodyLineHeight: number;
  /** PDFKit lineGap (points, additive) for the PDF generator. */
  pdfLineGap: number;
  sectionSpacing: number;   // pt before a section title
  skillRowSpacing: number;  // pt after a skill row

  // Visual identity
  accent: string;
  roleColor: string;
  ruleWidth: number;
  nameWeight: number;
}

export const CV_TEMPLATE_GEOMETRY: Record<TemplateId, CvTemplateGeometry> = {
  atanu: {
    marginLeft: 36, marginRight: 36, marginTop: 32.4, marginBottom: 32.4,
    skillsColumnGap: 18,
    nameSize: 24, roleSize: 12, headingSize: 11, expTitleSize: 10.5,
    bodySize: 9.5, bulletSize: 9.5, skillCategorySize: 9.5,
    bodyLineHeight: 1.42, pdfLineGap: 1.2,
    sectionSpacing: 10, skillRowSpacing: 4,
    accent: '#0F766E', roleColor: '#0F766E', ruleWidth: 1.2, nameWeight: 700,
  },
  jake: {
    marginLeft: 36, marginRight: 36, marginTop: 32.4, marginBottom: 32.4,
    skillsColumnGap: 20,
    nameSize: 24, roleSize: 11.5, headingSize: 11, expTitleSize: 9.5,
    bodySize: 9, bulletSize: 9, skillCategorySize: 9,
    bodyLineHeight: 1.35, pdfLineGap: 1,
    sectionSpacing: 8, skillRowSpacing: 4,
    accent: '#111111', roleColor: '#555555', ruleWidth: 1, nameWeight: 700,
  },
  harvard: {
    marginLeft: 50.4, marginRight: 50.4, marginTop: 43.2, marginBottom: 43.2,
    skillsColumnGap: 0, // single column
    nameSize: 15, roleSize: 10, headingSize: 11, expTitleSize: 10.5,
    bodySize: 10.5, bulletSize: 10.5, skillCategorySize: 10.5,
    bodyLineHeight: 1.3, pdfLineGap: 1,
    sectionSpacing: 10, skillRowSpacing: 2.5,
    accent: '#111111', roleColor: '#111111', ruleWidth: 0, nameWeight: 700,
  },
  'atanu-pro': {
    // 0.5in top/bottom, 0.625in left/right — US Letter box from the spec.
    marginLeft: 45, marginRight: 45, marginTop: 36, marginBottom: 36,
    skillsColumnGap: 18,
    nameSize: 22, roleSize: 11, headingSize: 11, expTitleSize: 10.5,
    bodySize: 9.5, bulletSize: 9.5, skillCategorySize: 9.5,
    bodyLineHeight: 1.42, pdfLineGap: 1.2,
    sectionSpacing: 10, skillRowSpacing: 4,
    accent: '#2563EB', roleColor: '#4B5563', ruleWidth: 2, nameWeight: 800,
  },
};

function cvTemplateGeometry(template: TemplateId): CvTemplateGeometry {
  return CV_TEMPLATE_GEOMETRY[template] || CV_TEMPLATE_GEOMETRY.harvard;
}

export function cvContentWidth(template: TemplateId): number {
  const g = cvTemplateGeometry(template);
  return CV_PAGE.width - g.marginLeft - g.marginRight;
}

export function cvContentHeight(template: TemplateId): number {
  const g = cvTemplateGeometry(template);
  return CV_PAGE.height - g.marginTop - g.marginBottom;
}

/** Single shared column-width formula: (contentWidth - columnGap) / 2. */
export function cvSkillsColumnWidth(template: TemplateId): number {
  const g = cvTemplateGeometry(template);
  if (g.skillsColumnGap <= 0) return cvContentWidth(template);
  return (cvContentWidth(template) - g.skillsColumnGap) / 2;
}
