import { describe, it, expect } from 'vitest';
import { buildEditableCv, editableCvToPdfShape } from '../../src/components/ManualJdScreen';
import type { PdfCvShape } from '../../src/components/CvPdfPreview';

const CV: PdfCvShape = {
  candidateName: 'Aarav Sharma',
  targetRole: 'DevSecOps Engineer',
  contactInfo: { email: 'a@b.com' },
  professionalSummary: 'Cloud engineer with 6 years.',
  technicalSkills: [{ category: 'Technical', skills: ['Kubernetes', 'SAST/DAST', 'AWS'] }],
  workExperience: [
    {
      title: 'Lead Cloud Engineer',
      company: 'CloudCore',
      dates: '2021 – Present',
      highlights: ['Led migration of 40+ services.', 'Built security scanning into CI.', 'Designed IaC in Terraform.'],
    },
  ],
  projects: [],
  education: [],
  certifications: [],
};

const DIFF = {
  beforeScore: 40,
  afterScore: 78,
  scoreBoost: 38,
  missingBefore: { skills: [], keywords: [] },
  addedAfter: { skillsAdded: ['SAST/DAST'], rephrasedHighlightsCount: 1 },
  notIntegrable: [],
  bulletRewrites: [{ original: 'Old text', rewritten: 'Built security scanning into CI.' }],
};

// Flatten the categorized skill model for assertions.
const skillItems = (cv: any) => cv.skills.flatMap((g: any) => g.items);

describe('Manual JD · Preview Stage editable model', () => {
  it('tags AI-added skills and AI-rewritten bullets', () => {
    const cv = buildEditableCv(CV, DIFF as any);
    const items = skillItems(cv);
    expect(items.find((s: any) => s.text === 'SAST/DAST')?.ai).toBe(true);
    expect(items.find((s: any) => s.text === 'Kubernetes')?.ai).toBe(false);
    expect(cv.experiences[0].bullets.find((b) => b.text === 'Built security scanning into CI.')?.ai).toBe(true);
    expect(cv.experiences[0].bullets.find((b) => b.text === 'Led migration of 40+ services.')?.ai).toBe(false);
  });

  it('hides AI items when hideAI is on, keeps user content', () => {
    const cv = buildEditableCv(CV, DIFF as any);
    const pdf = editableCvToPdfShape(cv, true);
    expect(pdf.technicalSkills[0].skills).toEqual(['Kubernetes', 'AWS']);
    expect(pdf.workExperience[0].highlights).toEqual(['Led migration of 40+ services.', 'Designed IaC in Terraform.']);
  });

  it('preserves skill categories from the master CV', () => {
    const cv = buildEditableCv(CV, DIFF as any);
    expect(cv.skills[0].category).toBe('Technical');
    const pdf = editableCvToPdfShape(cv, false);
    expect(pdf.technicalSkills[0].category).toBe('Technical');
  });

  it('shows AI items when hideAI is off and preserves edits', () => {
    const cv = buildEditableCv(CV, DIFF as any);
    cv.summary = 'My own summary.'; // simulated user edit
    cv.skills[0].items.push({ id: 'x', text: 'Python', ai: false }); // user-added skill
    const pdf = editableCvToPdfShape(cv, false);
    expect(pdf.professionalSummary).toBe('My own summary.');
    expect(pdf.technicalSkills[0].skills).toContain('Python');
    expect(pdf.technicalSkills[0].skills).toContain('SAST/DAST'); // AI skill still visible
  });

  it('handles a null diff (no AI tagging → everything is the user\u2019s)', () => {
    const cv = buildEditableCv(CV, null);
    expect(skillItems(cv).every((s: any) => !s.ai)).toBe(true);
    expect(cv.experiences[0].bullets.every((b) => !b.ai)).toBe(true);
  });
});