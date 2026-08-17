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

  it('tags AI-ADDED bullets by content comparison against the original CV', () => {
    // Tailored CV has the original 3 bullets PLUS a new AI-added one, and one
    // rewritten. The diff only lists the rewrite — content comparison must
    // also tag the added bullet.
    const tailored: PdfCvShape = {
      ...CV,
      workExperience: [
        {
          title: 'Lead Cloud Engineer',
          company: 'CloudCore',
          dates: '2021 – Present',
          highlights: [
            'Led migration of 40+ services.',
            'Automated security scanning across all pipelines.', // rewritten
            'Designed IaC in Terraform.',
            'Introduced supply-chain SBOM attestation.', // AI-ADDED, not in diff
          ],
        },
      ],
    };
    const cv = buildEditableCv(tailored, { ...DIFF, bulletRewrites: [{ original: 'Built security scanning into CI.', rewritten: 'Automated security scanning across all pipelines.' }] } as any, CV);
    const bullets = cv.experiences[0].bullets;
    expect(bullets.find((b) => b.text === 'Led migration of 40+ services.')?.ai).toBe(false); // unchanged → user's
    expect(bullets.find((b) => b.text === 'Designed IaC in Terraform.')?.ai).toBe(false); // unchanged
    expect(bullets.find((b) => b.text === 'Automated security scanning across all pipelines.')?.ai).toBe(true); // rewritten
    expect(bullets.find((b) => b.text === 'Introduced supply-chain SBOM attestation.')?.ai).toBe(true); // AI-added
  });

  it('keeps reordered-but-unchanged bullets untagged (multiset match)', () => {
    const tailored: PdfCvShape = {
      ...CV,
      workExperience: [
        {
          title: 'Lead Cloud Engineer',
          company: 'CloudCore',
          dates: '2021 – Present',
          highlights: [
            'Designed IaC in Terraform.', // moved up, wording identical
            'Led migration of 40+ services.',
            'Built security scanning into CI.',
          ],
        },
      ],
    };
    // No rewrite entries in the diff → content comparison is the only signal.
    const cv = buildEditableCv(tailored, { ...DIFF, bulletRewrites: [] } as any, CV);
    expect(cv.experiences[0].bullets.every((b) => !b.ai)).toBe(true);
  });
});
// ── Drag & drop placement math (mirrors the handlers in ManualJdScreen) ──
// dropOnto computes: insert = below ? to+1 : to; if (from < insert) insert--.
// Then reorderArr splices out `from` and inserts at `insert`.
function reorderArr<T>(arr: T[], from: number, to: number): T[] {
  const next = [...arr];
  const [x] = next.splice(from, 1);
  next.splice(to, 0, x);
  return next;
}
function dropIndex(from: number, to: number, below: boolean): number {
  let insert = below ? to + 1 : to;
  if (from < insert) insert -= 1;
  return insert;
}

describe('Preview Stage · drag-drop placement', () => {
  const list = ['A', 'B', 'C', 'D'];

  it('drops on the top half of a row → lands BEFORE it', () => {
    // Drag A onto C, release on top half: A should land before C → [B,A,C,D]
    const insert = dropIndex(0, 2, false);
    expect(reorderArr(list, 0, insert)).toEqual(['B', 'A', 'C', 'D']);
  });

  it('drops on the bottom half of a row → lands AFTER it', () => {
    // Drag A onto C, release on bottom half: A should land after C → [B,C,A,D]
    const insert = dropIndex(0, 2, true);
    expect(reorderArr(list, 0, insert)).toEqual(['B', 'C', 'A', 'D']);
  });

  it('dragging DOWN lands at the exact hovered slot (no off-by-one)', () => {
    // Drag A onto D, top half → after C, before D → [B,C,A,D]
    const insert = dropIndex(0, 3, false);
    expect(reorderArr(list, 0, insert)).toEqual(['B', 'C', 'A', 'D']);
    // Drag A onto D, bottom half → last → [B,C,D,A]
    const insert2 = dropIndex(0, 3, true);
    expect(reorderArr(list, 0, insert2)).toEqual(['B', 'C', 'D', 'A']);
  });

  it('dragging UP lands at the exact hovered slot', () => {
    // Drag D onto B, top half → [A,D,B,C]
    const insert = dropIndex(3, 1, false);
    expect(reorderArr(list, 3, insert)).toEqual(['A', 'D', 'B', 'C']);
    // Drag D onto B, bottom half → [A,B,D,C]
    const insert2 = dropIndex(3, 1, true);
    expect(reorderArr(list, 3, insert2)).toEqual(['A', 'B', 'D', 'C']);
  });

  it('dropping back onto its own slot is a no-op', () => {
    const insert = dropIndex(1, 1, false);
    expect(reorderArr(list, 1, insert)).toEqual(list);
  });
});

// ── Shared Master CV editor adapter round-trip ──
import { editableCvToEditorShape, editorShapeToEditableCv, makeAiLookups } from '../../src/components/ManualJdScreen';

const ED = (() => {
  const base = buildEditableCv(CV, DIFF as any);
  base.candidateName = 'Aarav Sharma';
  base.contactInfo = { email: 'a@b.com', phone: '+1', location: 'Kolkata' };
  base.experiences[0].bullets[1].ai = true; // 'Built security scanning into CI.' is AI-rewritten
  return base;
})();

describe('Manual JD · Shared Master CV editor adapter', () => {
  it('converts editable model → editor shape (MasterCv) and back, preserving AI flags', () => {
    const editor = editableCvToEditorShape(ED);
    expect(editor.fullName).toBe('Aarav Sharma');
    expect(editor.email).toBe('a@b.com');
    expect(editor.experiences[0].responsibilities).toContain('Led migration of 40+ services.');

    const back = editorShapeToEditableCv(editor, ED);
    expect(back.candidateName).toBe('Aarav Sharma');
    expect(back.contactInfo.email).toBe('a@b.com');
    expect(back.experiences[0].bullets.find((b) => b.text === 'Built security scanning into CI.')?.ai).toBe(true);
    expect(back.experiences[0].bullets.find((b) => b.text === 'Led migration of 40+ services.')?.ai).toBe(false);
  });

  it('marks new skills/bullets typed in the editor as user content (not AI)', () => {
    const editor = editableCvToEditorShape(ED);
    editor.skills[0].items.push('Rust'); // user adds via TagInput
    editor.experiences[0].responsibilities.push('My own bullet.'); // user adds
    const back = editorShapeToEditableCv(editor, ED);
    expect(back.skills[0].items.find((s) => s.text === 'Rust')?.ai).toBe(false);
    expect(back.experiences[0].bullets.find((b) => b.text === 'My own bullet.')?.ai).toBe(false);
  });

  it('makeAiLookups tags AI content for the shared editor', () => {
    const lu = makeAiLookups(ED);
    expect(lu.skill('SAST/DAST')).toBe(true);
    expect(lu.skill('Kubernetes')).toBe(false);
    expect(lu.bullet('Built security scanning into CI.')).toBe(true);
    expect(lu.bullet('Led migration of 40+ services.')).toBe(false);
  });
});
