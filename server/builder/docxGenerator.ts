import PDFDocument from 'pdfkit';
import { TailoredCv } from '../../src/types.js';

interface ContactLink {
  type: 'email' | 'phone' | 'location' | 'linkedin' | 'github' | 'website';
  label: string;
  url?: string;
}

function getContactLinks(cv: TailoredCv): ContactLink[] {
  const links: ContactLink[] = [];
  const c = cv.contactInfo || {};

  if (c.email) {
    links.push({
      type: 'email',
      label: String(c.email),
      url: `mailto:${c.email}`,
    });
  }

  if (c.phone) {
    links.push({
      type: 'phone',
      label: String(c.phone),
      url: `tel:${String(c.phone).replace(/[^\d+]/g, '')}`,
    });
  }

  if (c.location) {
    links.push({
      type: 'location',
      label: String(c.location),
    });
  }

  if (c.linkedin) {
    let url = String(c.linkedin).trim();
    if (!url.startsWith('http')) {
      if (url.includes('linkedin.com')) {
        url = `https://${url}`;
      } else {
        const handle = url.replace(/^\/?in\//, '').replace(/^\//, '');
        url = `https://linkedin.com/in/${handle}`;
      }
    }
    links.push({
      type: 'linkedin',
      label: 'LinkedIn',
      url,
    });
  }

  if (c.github) {
    let url = String(c.github).trim();
    if (!url.startsWith('http')) {
      if (url.includes('github.com')) {
        url = `https://${url}`;
      } else {
        const handle = url.replace(/^\//, '');
        url = `https://github.com/${handle}`;
      }
    }
    links.push({
      type: 'github',
      label: 'GitHub',
      url,
    });
  }

  if (c.website) {
    let url = String(c.website).trim();
    if (!url.startsWith('http')) {
      url = `https://${url}`;
    }
    links.push({
      type: 'website',
      label: 'Portfolio',
      url,
    });
  }

  return links;
}

/**
 * Helper to ensure URLs have http/https/mailto/tel prefix
 */
function normalizeUrl(url?: string): string | undefined {
  if (!url) return undefined;
  const trimmed = String(url).trim();
  if (/^https?:\/\//i.test(trimmed) || /^mailto:/i.test(trimmed) || /^tel:/i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}


function sanitizeText(str: any): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\u00A0/g, ' ')
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2022/g, '•')
    .replace(/\u2026/g, '...')
    .replace(/[^\x00-\xFF]/g, '')
    .trim();
}

/**
 * Generate a PDF buffer matching the exact top-notch ATS specification with clickable hyperlinks.
 * `template` mirrors the frontend CV_TEMPLATE_STYLES so the downloaded PDF matches the preview.
 */
export function generatePdfBuffer(cv: TailoredCv, template: string = 'harvard'): Promise<Buffer> {
  if (template !== 'harvard' && template !== 'jake' && template !== 'atanu') {
    template = 'harvard';
  }
  if (template === 'harvard') {
    return generateHarvardPdf(cv);
  }
  if (template === 'jake') {
    return generateJakePdf(cv);
  }
  if (template === 'atanu') {
    return generateAtanuPdf(cv);
  }

  // ── Template styles (must match src/components/CvPdfPreview.tsx CV_TEMPLATE_STYLES) ──
  const TEMPLATES: Record<string, { accent: string; nameSize: number; roleColor: string; ruleWidth: number; bodySize: number; bulletSize: number; sectionGap: number; expTitleSize: number }> = {
    'harvard': { accent: '#2F54EB', nameSize: 18, roleColor: '#374151', ruleWidth: 0.75, bodySize: 9.5, bulletSize: 9.5, sectionGap: 10, expTitleSize: 10 },
    'compact-executive': { accent: '#1E3A5F', nameSize: 15, roleColor: '#475569', ruleWidth: 0.5, bodySize: 8.5, bulletSize: 8.5, sectionGap: 7, expTitleSize: 9 },
  };
  const t = TEMPLATES[template] || TEMPLATES.harvard;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: {
        top: 0.6 * 72, // 43.2 pt
        bottom: 0.6 * 72,
        left: 0.75 * 72, // 54 pt
        right: 0.75 * 72,
      },
    });

    const buffers: Buffer[] = [];
    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', (err) => reject(err));

    const leftMargin = 0.75 * 72; // 54 pt
    const rightMargin = 8.5 * 72 - 0.75 * 72; // 558 pt
    const contentWidth = rightMargin - leftMargin; // 504 pt

    // Page-break safety helper
    const ensurePageSpace = (neededHeight: number) => {
      if (doc.y + neededHeight > 730) {
        doc.addPage();
        doc.y = 43.2;
      }
    };

    // 1. Candidate Name (template-sized, centered)
    doc.x = leftMargin;
    const candidateName = sanitizeText(cv.candidateName).toUpperCase() || 'CANDIDATE NAME';
    ensurePageSpace(30);
    doc.font('Helvetica-Bold').fontSize(t.nameSize).fillColor('#111827').text(candidateName, leftMargin, doc.y, {
      align: 'center',
      width: contentWidth,
    });
    doc.moveDown(0.1);

    // Target Role
    if (cv.targetRole) {
      const targetRole = sanitizeText(cv.targetRole);
      if (targetRole) {
        doc.font('Helvetica-Bold').fontSize(10).fillColor(t.roleColor).text(targetRole, leftMargin, doc.y, {
          align: 'center',
          width: contentWidth,
        });
        doc.moveDown(0.15);
      }
    }

    // 2. Contact Line: Clean centered text line with bullet separators and clickable links
    const contactLinks = getContactLinks(cv);
    if (contactLinks.length > 0) {
      ensurePageSpace(20);
      doc.font('Helvetica').fontSize(9);

      const sep = '   •   ';
      const sepWidth = doc.widthOfString(sep);

      // Measure total width of all contact items + separators
      const itemsMeasured = contactLinks
        .map((item) => {
          const cleanLabel = sanitizeText(item.label);
          if (!cleanLabel) return null;
          const w = doc.widthOfString(cleanLabel);
          return { item, cleanLabel, w };
        })
        .filter((x): x is { item: typeof contactLinks[0]; cleanLabel: string; w: number } => x !== null);

      if (itemsMeasured.length > 0) {
        let totalWidth = itemsMeasured.reduce((sum, el) => sum + el.w, 0);
        totalWidth += (itemsMeasured.length - 1) * sepWidth;

        const currentY = doc.y;
        let currentX = leftMargin + Math.max(0, (contentWidth - totalWidth) / 2);

        itemsMeasured.forEach(({ item, cleanLabel, w }, idx) => {
          const normUrl = item.url ? normalizeUrl(item.url) : undefined;
          if (normUrl) {
            doc.fillColor('#0055BB').text(cleanLabel, currentX, currentY, { lineBreak: false });
            doc.link(currentX, currentY, w, 10, normUrl);
          } else {
            doc.fillColor('#374151').text(cleanLabel, currentX, currentY, { lineBreak: false });
          }
          currentX += w;

          if (idx < itemsMeasured.length - 1) {
            doc.fillColor('#9CA3AF').text(sep, currentX, currentY, { lineBreak: false });
            currentX += sepWidth;
          }
        });

        doc.x = leftMargin;
        doc.y = currentY + 14;
      }
    }

    // Helper to render section header: template accent, ALL CAPS Bold with solid horizontal rule
    const renderSectionHeader = (title: string) => {
      ensurePageSpace(30);
      doc.x = leftMargin;
      doc.moveDown(0.2);
      const headY = doc.y;
      doc.font('Helvetica-Bold').fontSize(10.5).fillColor(t.accent).text(sanitizeText(title).toUpperCase(), leftMargin, headY, {
        width: contentWidth,
      });
      const ruleY = doc.y + 1;
      doc.moveTo(leftMargin, ruleY).lineTo(rightMargin, ruleY).lineWidth(t.ruleWidth).strokeColor(t.accent).stroke();
      doc.y = ruleY + 5;
      doc.x = leftMargin;
    };

    // Helper for bullet points
    const renderBullet = (text: string, linkUrl?: string) => {
      if (!text) return;
      const clean = sanitizeText(String(text).replace(/^[*•\-]\s*/, '').trim());
      if (!clean) return;

      ensurePageSpace(15);
      const bulletX = leftMargin + 4;
      const textX = leftMargin + 16;
      const tWidth = contentWidth - 16;
      const currentY = doc.y;

      doc.font('Helvetica').fontSize(t.bulletSize).fillColor('#4B5563').text('•', bulletX, currentY, { lineBreak: false });

      const normUrl = linkUrl ? normalizeUrl(linkUrl) : undefined;
      if (normUrl) {
        doc.font('Helvetica').fontSize(t.bulletSize).fillColor('#0055BB').text(clean, textX, currentY, {
          width: tWidth,
          lineGap: 1.5,
          underline: true,
        });
        const rawH = doc.heightOfString(clean, { width: tWidth });
        const h = isFinite(rawH) && rawH > 0 ? rawH : 12;
        doc.link(textX, currentY, tWidth, h, normUrl);
      } else {
        doc.font('Helvetica').fontSize(t.bulletSize).fillColor('#1F2937').text(clean, textX, currentY, {
          width: tWidth,
          lineGap: 1.5,
        });
      }

      doc.x = leftMargin;
      doc.moveDown(0.12);
    };

    // 3. Section: PROFESSIONAL SUMMARY
    if (cv.professionalSummary) {
      const cleanSummary = sanitizeText(cv.professionalSummary);
      if (cleanSummary) {
        renderSectionHeader('PROFESSIONAL SUMMARY');
        ensurePageSpace(20);
        doc.font('Helvetica').fontSize(t.bodySize).fillColor('#1F2937').text(cleanSummary, leftMargin, doc.y, {
          width: contentWidth,
          lineGap: 1.5,
        });
        doc.x = leftMargin;
        doc.moveDown(0.2);
      }
    }

    // 4. Section: TECHNICAL SKILLS
    const hasTechnicalSkills = cv.technicalSkills && cv.technicalSkills.length > 0;
    const hasCoreCompetencies = cv.coreCompetencies && cv.coreCompetencies.length > 0;

    if (hasTechnicalSkills || hasCoreCompetencies) {
      renderSectionHeader('TECHNICAL SKILLS & COMPETENCIES');

      if (hasTechnicalSkills) {
        for (const cat of cv.technicalSkills) {
          if (!cat) continue;
          const catName = sanitizeText(cat.category);
          const skillsList = Array.isArray(cat.skills)
            ? cat.skills.map((s) => sanitizeText(s)).filter(Boolean).join(', ')
            : '';
          if (!catName && !skillsList) continue;

          ensurePageSpace(15);
          doc
            .font('Helvetica-Bold')
            .fontSize(t.expTitleSize)
            .fillColor('#111827')
            .text(`${catName}: `, leftMargin, doc.y, { continued: true })
            .font('Helvetica')
            .fillColor('#374151')
            .text(skillsList);
          doc.x = leftMargin;
          doc.moveDown(0.12);
        }
      } else if (hasCoreCompetencies) {
        const compList = cv.coreCompetencies.map((c) => sanitizeText(c)).filter(Boolean).join(', ');
        if (compList) {
          ensurePageSpace(15);
          doc.font('Helvetica').fontSize(t.bodySize).fillColor('#1F2937').text(compList, leftMargin, doc.y, {
            width: contentWidth,
            lineGap: 1.5,
          });
          doc.x = leftMargin;
        }
      }
      doc.moveDown(0.2);
    }

    // 5. Section: PROFESSIONAL EXPERIENCE
    if (cv.workExperience && cv.workExperience.length > 0) {
      renderSectionHeader('PROFESSIONAL EXPERIENCE');

      for (const exp of cv.workExperience) {
        if (!exp) continue;
        ensurePageSpace(45);

        const title = sanitizeText(exp.title);
        const company = sanitizeText(exp.company);
        const dateLoc = [sanitizeText(exp.dates), sanitizeText(exp.location)].filter(Boolean).join('   |   ');
        const entryY = doc.y;

        // Title and Company
        const titleComp = company ? `${title}   |   ${company}` : title;
        doc.font('Helvetica-Bold').fontSize(t.expTitleSize).fillColor('#111827').text(titleComp, leftMargin, entryY, {
          width: contentWidth - 140,
        });
        const yAfterLeft = doc.y;

        // Dates & Location right-aligned on the same header line
        if (dateLoc) {
          doc.font('Helvetica-Oblique').fontSize(8.5).fillColor('#4B5563').text(dateLoc, leftMargin, entryY, {
            align: 'right',
            width: contentWidth,
          });
        }
        const yAfterRight = doc.y;

        doc.y = Math.max(yAfterLeft, yAfterRight);
        doc.x = leftMargin;
        doc.moveDown(0.1);

        if (Array.isArray(exp.highlights)) {
          for (const hl of exp.highlights) {
            renderBullet(hl);
          }
        }
        doc.x = leftMargin;
        doc.moveDown(0.2);
      }
    }

    // 6. Section: FEATURED PROJECTS
    if (cv.projects && cv.projects.length > 0) {
      renderSectionHeader('FEATURED PROJECTS');

      for (const proj of cv.projects) {
        if (!proj) continue;
        ensurePageSpace(40);

        const pName = sanitizeText(proj.name);
        const normLink = proj.link ? normalizeUrl(proj.link) : undefined;
        const pDates = sanitizeText(proj.dates);
        const projY = doc.y;

        if (normLink) {
          doc
            .font('Helvetica-Bold')
            .fontSize(t.expTitleSize)
            .fillColor('#111827')
            .text(pName, leftMargin, projY, { continued: true });
          doc
            .font('Helvetica')
            .fontSize(9)
            .fillColor('#0055BB')
            .text(`   |   View Project`, { width: contentWidth - 120 });
        } else {
          doc
            .font('Helvetica-Bold')
            .fontSize(t.expTitleSize)
            .fillColor('#111827')
            .text(pName, leftMargin, projY, { width: contentWidth - 120 });
        }
        const yAfterLeft = doc.y;

        if (pDates) {
          doc.font('Helvetica-Oblique').fontSize(8.5).fillColor('#4B5563').text(pDates, leftMargin, projY, {
            align: 'right',
            width: contentWidth,
          });
        }
        const yAfterRight = doc.y;

        doc.y = Math.max(yAfterLeft, yAfterRight);
        doc.x = leftMargin;
        doc.moveDown(0.1);

        if (Array.isArray(proj.technologies) && proj.technologies.length > 0) {
          const techList = proj.technologies.map((t) => sanitizeText(t)).filter(Boolean).join(', ');
          if (techList) {
            ensurePageSpace(15);
            doc
              .font('Helvetica-Bold')
              .fontSize(9)
              .fillColor('#374151')
              .text('Technologies: ', leftMargin, doc.y, { continued: true })
              .font('Helvetica')
              .fillColor('#4B5563')
              .text(techList);
            doc.x = leftMargin;
            doc.moveDown(0.08);
          }
        }

        if (proj.description) {
          renderBullet(proj.description);
        }
        doc.x = leftMargin;
        doc.moveDown(0.2);
      }
    }

    // 7. Section: EDUCATION
    if (cv.education && cv.education.length > 0) {
      renderSectionHeader('EDUCATION');

      for (const edu of cv.education) {
        if (!edu) continue;
        ensurePageSpace(35);

        const degree = sanitizeText(edu.degree);
        const inst = sanitizeText(edu.institution);
        const eDates = sanitizeText(edu.dates);
        const eduY = doc.y;

        // Line 1: Degree Name (Left) & Dates (Right)
        doc
          .font('Helvetica-Bold')
          .fontSize(t.expTitleSize)
          .fillColor('#111827')
          .text(degree, leftMargin, eduY, { width: contentWidth - 140 });
        const yAfterDegree = doc.y;

        if (eDates) {
          doc.font('Helvetica-Oblique').fontSize(8.5).fillColor('#4B5563').text(eDates, leftMargin, eduY, {
            align: 'right',
            width: contentWidth,
          });
        }
        const yAfterDates = doc.y;

        doc.y = Math.max(yAfterDegree, yAfterDates);

        // Line 2: Institution Name (Below degree to prevent overlap)
        if (inst) {
          doc
            .font('Helvetica')
            .fontSize(t.bodySize)
            .fillColor('#374151')
            .text(inst, leftMargin, doc.y, { width: contentWidth });
        }

        doc.x = leftMargin;
        doc.moveDown(0.25);
      }
    }

    // 8. Section: CERTIFICATIONS & CREDENTIALS
    if (cv.certifications && cv.certifications.length > 0) {
      renderSectionHeader('CERTIFICATIONS & CREDENTIALS');

      for (const cert of cv.certifications) {
        if (!cert) continue;
        if (typeof cert === 'string') {
          renderBullet(cert);
        } else if (typeof cert === 'object') {
          const parts = [sanitizeText(cert.name), sanitizeText(cert.issuer), sanitizeText(cert.date)].filter(Boolean);
          renderBullet(parts.join('   |   '), cert.link);
        }
      }
    }

    doc.end();
  });
}

/**
 * Harvard Classic — exact replica of the ATS-safe single-column template:
 * centered header (24px name, 3px letter-spacing), teal #0F766E headings
 * with solid rules, 9.5px justified body, 2-column skills grid,
 * role/company + right-aligned period, [year] projects.
 * US Letter, margins 0.45in top/bottom, 0.5in left/right.
 */
function generateAtanuPdf(cv: TailoredCv): Promise<Buffer> {
  const ACCENT = '#0F766E';
  const NAVY = '#0F172A';
  const BODY = '#1F2937';
  const MUTED = '#6B7280';
  const FAINT = '#9CA3AF';

  const MARGIN_X = 0.5 * 72;  // 36 pt
  const MARGIN_Y = 0.45 * 72; // 32.4 pt
  const PAGE_W = 8.5 * 72;    // 612
  const PAGE_H = 11 * 72;     // 792
  const leftMargin = MARGIN_X;
  const rightMargin = PAGE_W - MARGIN_X; // 576
  const contentWidth = rightMargin - leftMargin; // 540
  const pageBottom = PAGE_H - MARGIN_Y;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: { top: MARGIN_Y, bottom: MARGIN_Y, left: MARGIN_X, right: MARGIN_X },
    });

    const buffers: Buffer[] = [];
    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', (err) => reject(err));

    const ensurePageSpace = (neededHeight: number) => {
      if (doc.y + neededHeight > pageBottom) {
        doc.addPage();
        doc.y = MARGIN_Y;
      }
    };

    // ── Header: name + contact ──
    const name = sanitizeText(cv.candidateName).toUpperCase() || 'CANDIDATE NAME';
    ensurePageSpace(60);
    const NAME_SIZE = 24;
    const NAME_SPACING = 3;
    doc.font('Helvetica-Bold').fontSize(NAME_SIZE);
    let nameWidth = 0;
    for (const ch of Array.from(name)) nameWidth += doc.widthOfString(ch) + NAME_SPACING;
    nameWidth -= NAME_SPACING;
    const nameX = leftMargin + Math.max(0, (contentWidth - nameWidth) / 2);
    let cx = nameX;
    for (const ch of Array.from(name)) {
      doc.fillColor(NAVY).text(ch, cx, doc.y, { lineBreak: false });
      cx += doc.widthOfString(ch) + NAME_SPACING;
    }
    doc.moveDown(0.2); // 3px below the name

    // Role subtitle — 12px bold uppercase accent, 1.5px letter-spacing
    if (cv.targetRole) {
      const role = sanitizeText(cv.targetRole).toUpperCase();
      if (role) {
        ensurePageSpace(20);
        const ROLE_SIZE = 12;
        const ROLE_SPACING = 1.5;
        const roleY = doc.y;
        doc.font('Helvetica-Bold').fontSize(ROLE_SIZE);
        let roleW = 0;
        for (const ch of Array.from(role)) roleW += doc.widthOfString(ch) + ROLE_SPACING;
        roleW -= ROLE_SPACING;
        let rx = leftMargin + Math.max(0, (contentWidth - roleW) / 2);
        for (const ch of Array.from(role)) {
          doc.fillColor(ACCENT).text(ch, rx, roleY, { lineBreak: false });
          rx += doc.widthOfString(ch) + ROLE_SPACING;
        }
        doc.moveDown(0.2); // 3px below the role
      }
    }

    const contactLinks = getContactLinks(cv);
    if (contactLinks.length > 0) {
      ensurePageSpace(20);
      const sep = '  |  ';
      const sepWidth = doc.widthOfString(sep);
      const itemsMeasured = contactLinks
        .map((item) => {
          const cleanLabel = sanitizeText(item.label);
          if (!cleanLabel) return null;
          const w = doc.widthOfString(cleanLabel);
          return { item, cleanLabel, w };
        })
        .filter((x): x is { item: typeof contactLinks[0]; cleanLabel: string; w: number } => x !== null);

      if (itemsMeasured.length > 0) {
        let totalWidth = itemsMeasured.reduce((sum, el) => sum + el.w, 0);
        totalWidth += (itemsMeasured.length - 1) * sepWidth;

        const currentY = doc.y;
        let currentX = leftMargin + Math.max(0, (contentWidth - totalWidth) / 2);

        itemsMeasured.forEach(({ item, cleanLabel, w }, idx) => {
          const normUrl = item.url ? normalizeUrl(item.url) : undefined;
          if (normUrl) {
            doc.fillColor(ACCENT).text(cleanLabel, currentX, currentY, { lineBreak: false });
            doc.link(currentX, currentY, w, 10, normUrl);
          } else {
            doc.fillColor('#374151').text(cleanLabel, currentX, currentY, { lineBreak: false });
          }
          currentX += w;

          if (idx < itemsMeasured.length - 1) {
            doc.fillColor(FAINT).text(sep, currentX, currentY, { lineBreak: false });
            currentX += sepWidth;
          }
        });

        doc.x = leftMargin;
        doc.y = currentY + 14;
      }
    }

    // ── Section header: 11px uppercase teal + solid teal rule ──
    const renderSectionHeader = (title: string) => {
      ensurePageSpace(40);
      doc.x = leftMargin;
      doc.moveDown(0.74); // 10px above (0.74 × ~13.5pt line)
      const headY = doc.y;
      const secTitle = title.toUpperCase();
      doc.font('Helvetica').fontSize(11); // normal weight
      let cx = leftMargin;
      for (const ch of Array.from(secTitle)) {
        doc.fillColor(ACCENT).text(ch, cx, headY, { lineBreak: false });
        cx += doc.widthOfString(ch) + 1.5;
      }
      const ruleY = doc.y + 2; // 2px padding below heading text
      doc.moveTo(leftMargin, ruleY).lineTo(rightMargin, ruleY).lineWidth(1.2).strokeColor(ACCENT).stroke();
      doc.y = ruleY + 6; // 6px below the rule
      doc.x = leftMargin;
    };

    // ── Bullet: teal • with 11px text indent, justified ──
    const renderBullet = (text: string, linkUrl?: string) => {
      if (!text) return;
      const clean = sanitizeText(String(text).replace(/^[*•\-]\s*/, '').trim());
      if (!clean) return;

      ensurePageSpace(15);
      const bulletX = leftMargin;
      const textX = leftMargin + 11;
      const tWidth = contentWidth - 11;
      const currentY = doc.y;

      doc.font('Helvetica').fontSize(9.5).fillColor(ACCENT).text('\u2022', bulletX, currentY, { lineBreak: false });

      const normUrl = linkUrl ? normalizeUrl(linkUrl) : undefined;
      doc.font('Helvetica').fontSize(9.5).fillColor(BODY);
      if (normUrl) {
        doc.fillColor(ACCENT).text(clean, textX, currentY, { width: tWidth, lineGap: 1.2, align: 'justify' });
        const rawH = doc.heightOfString(clean, { width: tWidth });
        const h = isFinite(rawH) && rawH > 0 ? rawH : 12;
        doc.link(textX, currentY, tWidth, h, normUrl);
      } else {
        doc.fillColor(BODY).text(clean, textX, currentY, { width: tWidth, lineGap: 1.2, align: 'justify' });
      }

      doc.x = leftMargin;
      doc.moveDown(0.18); // 2.5px between bullets
    };

    // ── Summary ──
    if (cv.professionalSummary) {
      const cleanSummary = sanitizeText(cv.professionalSummary);
      if (cleanSummary) {
        renderSectionHeader('Summary');
        ensurePageSpace(20);
        doc.font('Helvetica').fontSize(9.5).fillColor(BODY).text(cleanSummary, leftMargin, doc.y, {
          width: contentWidth,
          lineGap: 1.2,
          align: 'justify',
        });
        doc.x = leftMargin;
        doc.moveDown(0.2);
      }
    }

    // ── Skills: 2-column grid ──
    const skillCats = Array.isArray(cv.technicalSkills)
      ? cv.technicalSkills
          .map((cat) => ({
            name: sanitizeText(cat.category),
            list: Array.isArray(cat.skills) ? cat.skills.map((s) => sanitizeText(s)).filter(Boolean).join(', ') : '',
          }))
          .filter((c) => c.name || c.list)
      : [];
    const useCompetencies = skillCats.length === 0 && Array.isArray(cv.coreCompetencies) && cv.coreCompetencies.length > 0;

    if (skillCats.length > 0 || useCompetencies) {
      renderSectionHeader('Skills');

      if (useCompetencies) {
        ensurePageSpace(15);
        doc.font('Helvetica').fontSize(9.5).fillColor(BODY).text(
          cv.coreCompetencies.map((c) => sanitizeText(c)).filter(Boolean).join(', '),
          leftMargin, doc.y, { width: contentWidth, lineGap: 1.2 }
        );
        doc.x = leftMargin;
        doc.moveDown(0.2);
      } else {
        const colGap = 18;
        const colW = (contentWidth - colGap) / 2;
        const half = Math.ceil(skillCats.length / 2);
        let yLeft = doc.y;
        let yRight = doc.y;

        skillCats.forEach((cat, i) => {
          const isRight = i >= half;
          const colX = isRight ? leftMargin + colW + colGap : leftMargin;
          const curY = isRight ? yRight : yLeft;
          const line = cat.name ? `${cat.name}: ${cat.list}` : cat.list;

          ensurePageSpace(14);
          if (doc.y + 14 > pageBottom) {
            doc.addPage();
            doc.y = MARGIN_Y;
            yLeft = doc.y;
            yRight = doc.y;
          }

          const lineY = curY;
          doc.font('Helvetica-Bold').fontSize(9.5).fillColor(NAVY);
          doc.text(cat.name ? cat.name + ': ' : '', colX, lineY, { continued: true, width: colW });
          doc.font('Helvetica').fillColor('#374151').text(cat.list, { width: colW, lineGap: 1.2 });

          const lineH = doc.heightOfString(line, { width: colW }) + 4;
          if (isRight) yRight = lineY + lineH;
          else yLeft = lineY + lineH;
        });

        doc.y = Math.max(yLeft, yRight);
        doc.x = leftMargin;
        doc.moveDown(0.2);
      }
    }

    // ── Work Experience ──
    if (cv.workExperience && cv.workExperience.length > 0) {
      renderSectionHeader('Work Experience');

      for (const exp of cv.workExperience) {
        if (!exp) continue;
        ensurePageSpace(45);

        const title = sanitizeText(exp.title);
        const company = sanitizeText(exp.company);
        const period = sanitizeText(exp.dates);
        const loc = sanitizeText(exp.location);
        const entryY = doc.y;

        // Line 1: role (navy bold) — company (teal bold), period right-aligned
        doc.font('Helvetica-Bold').fontSize(10.5).fillColor(NAVY).text(title, leftMargin, entryY, { continued: true });
        doc.fillColor(ACCENT).text(company ? '  \u2014  ' + company : '', { continued: true });
        doc.x = leftMargin;
        const yAfterLeft = doc.y;

        if (period) {
          doc.font('Helvetica').fontSize(9).fillColor(MUTED).text(period, leftMargin, entryY, {
            align: 'right',
            width: contentWidth,
          });
        }
        const yAfterRight = doc.y;
        doc.y = Math.max(yAfterLeft, yAfterRight);

        if (loc) {
          ensurePageSpace(12);
          doc.font('Helvetica').fontSize(9).fillColor(MUTED).text(loc, leftMargin, doc.y, { width: contentWidth });
        }
        doc.x = leftMargin;
        doc.moveDown(0.1);

        if (Array.isArray(exp.highlights)) {
          for (const hl of exp.highlights) renderBullet(hl);
        }
        doc.x = leftMargin;
        doc.moveDown(0.5); // 8px between jobs
      }
    }

    // ── Projects (title bold navy + [year] + description) ──
    if (cv.projects && cv.projects.length > 0) {
      const projYears: number[] = [];
      for (const pp of cv.projects) {
        const ym = /(19|20)\d{2}/.exec(sanitizeText(pp.dates));
        if (ym) projYears.push(parseInt(ym[0], 10));
      }
      const range = projYears.length > 0 ? ` (${Math.min(...projYears)} \u2013 ${Math.max(...projYears)})` : '';
      renderSectionHeader('Projects' + range);

      for (const proj of cv.projects) {
        if (!proj) continue;
        ensurePageSpace(35);

        const pName = sanitizeText(proj.name);
        const pDates = sanitizeText(proj.dates);
        const normLink = proj.link ? normalizeUrl(proj.link) : undefined;
        const projY = doc.y;

        doc.font('Helvetica-Bold').fontSize(9.5).fillColor(NAVY).text(pName, leftMargin, projY, { continued: true });
        if (pDates) {
          doc.font('Helvetica').fontSize(9).fillColor(MUTED).text('  [' + pDates + ']');
        }
        doc.x = leftMargin;
        doc.moveDown(0.1);

        if (proj.description) {
          const desc = sanitizeText(proj.description);
          if (desc) {
            ensurePageSpace(15);
            doc.font('Helvetica').fontSize(9.5).fillColor(BODY).text(desc, leftMargin, doc.y, {
              width: contentWidth,
              lineGap: 1.2,
            });
            doc.x = leftMargin;
            doc.moveDown(0.05);
          }
        }
        if (normLink) {
          ensurePageSpace(12);
          doc.font('Helvetica').fontSize(9.5).fillColor(ACCENT).text(normLink, leftMargin, doc.y, {
            width: contentWidth,
          });
          doc.x = leftMargin;
        }
        doc.moveDown(0.3); // 4px between projects
      }
    }

    // ── Education (single line: bold institution — degree + period) ──
    if (cv.education && cv.education.length > 0) {
      renderSectionHeader('Education');
      for (const edu of cv.education) {
        if (!edu) continue;
        ensurePageSpace(15);
        const inst = sanitizeText(edu.institution);
        const degree = sanitizeText(edu.degree);
        const eDates = sanitizeText(edu.dates);
        const eduY = doc.y;

        doc.font('Helvetica-Bold').fontSize(9.5).fillColor(NAVY).text(inst, leftMargin, eduY, { continued: true });
        doc.font('Helvetica').fillColor(BODY)
          .text((degree ? '  \u2014  ' + degree : '') + (eDates ? '  \u00A0\u00A0' + eDates : ''));
        doc.x = leftMargin;
        doc.moveDown(0.25);
      }
    }

    // ── Certifications (bold issuer — name (year)) ──
    if (cv.certifications && cv.certifications.length > 0) {
      renderSectionHeader('Certifications');
      for (const cert of cv.certifications) {
        if (!cert) continue;
        ensurePageSpace(14);

        let issuer = '';
        let name = '';
        let date = '';
        if (typeof cert === 'string') {
          name = sanitizeText(cert);
        } else {
          issuer = sanitizeText(cert.issuer);
          name = sanitizeText(cert.name);
          date = sanitizeText(cert.date);
        }
        if (!name) continue;

        const certY = doc.y;
        doc.font('Helvetica-Bold').fontSize(9.5).fillColor(NAVY).text(issuer, leftMargin, certY, { continued: true });
        doc.font('Helvetica').fillColor(BODY)
          .text((issuer ? '  \u2014  ' : '') + name + (date ? ' (' + date + ')' : ''));
        doc.x = leftMargin;
        doc.moveDown(0.25);
      }
    }

    doc.end();
  });
}

/**
 * Harvard — official Harvard College bullet-point resume template:
 * Calibri-style sans, centered bold name + centered contact (• separators),
 * CENTERED bold uppercase section headings (no rules), entries with org
 * bold left / city right and title left / dates right, • bullets.
 * US Letter, margins 0.6in top/bottom, 0.7in sides.
 */
function generateHarvardPdf(cv: TailoredCv): Promise<Buffer> {
  const INK = '#111111';
  const MARGIN_X = 0.7 * 72;  // 50.4 pt
  const MARGIN_Y = 0.6 * 72;  // 43.2 pt
  const PAGE_W = 612;
  const PAGE_H = 792;
  const leftMargin = MARGIN_X;
  const rightMargin = PAGE_W - MARGIN_X;
  const contentWidth = rightMargin - leftMargin;
  const pageBottom = PAGE_H - MARGIN_Y;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margins: { top: MARGIN_Y, bottom: MARGIN_Y, left: MARGIN_X, right: MARGIN_X } });
    const buffers: Buffer[] = [];
    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', (err) => reject(err));

    const ensurePageSpace = (h: number) => {
      if (doc.y + h > pageBottom) { doc.addPage(); doc.y = MARGIN_Y; }
    };

    // Centered name (bold, 15pt, uppercase)
    const name = sanitizeText(cv.candidateName).toUpperCase() || 'CANDIDATE NAME';
    ensurePageSpace(40);
    doc.font('Helvetica-Bold').fontSize(15).fillColor(INK).text(name, leftMargin, doc.y, { align: 'center', width: contentWidth });
    doc.moveDown(0.2);

    // Centered contact line with bullet separators
    const contactLinks = getContactLinks(cv);
    if (contactLinks.length > 0) {
      ensurePageSpace(20);
      const sep = '  \u2022  ';
      const sepWidth = doc.widthOfString(sep);
      const itemsMeasured = contactLinks
        .map((item) => { const label = sanitizeText(item.label); if (!label) return null; return { item, label, w: doc.widthOfString(label) }; })
        .filter((x): x is { item: typeof contactLinks[0]; label: string; w: number } => x !== null);
      if (itemsMeasured.length > 0) {
        let totalWidth = itemsMeasured.reduce((sum, el) => sum + el.w, 0) + (itemsMeasured.length - 1) * sepWidth;
        const currentY = doc.y;
        let currentX = leftMargin + Math.max(0, (contentWidth - totalWidth) / 2);
        itemsMeasured.forEach(({ item, label, w }, idx) => {
          const normUrl = item.url ? normalizeUrl(item.url) : undefined;
          doc.font('Helvetica').fontSize(10).fillColor(INK);
          doc.text(label, currentX, currentY, { lineBreak: false });
          if (normUrl) doc.link(currentX, currentY, w, 10, normUrl);
          currentX += w;
          if (idx < itemsMeasured.length - 1) {
            doc.fillColor('#555555').text(sep, currentX, currentY, { lineBreak: false });
            currentX += sepWidth;
          }
        });
        doc.x = leftMargin;
        doc.y = currentY + 13;
      }
    }

    // Centered bold uppercase section heading (no rule)
    const section = (title: string) => {
      ensurePageSpace(30);
      doc.moveDown(0.35);
      const y0 = doc.y;
      doc.font('Helvetica-Bold').fontSize(11).fillColor(INK)
        .text(title.toUpperCase(), leftMargin, y0, { align: 'center', width: contentWidth });
      doc.moveDown(0.15);
      doc.x = leftMargin;
    };

    // Bullet: • at 0, text at 13px indent, justified
    const bullet = (text: string) => {
      if (!text) return;
      const clean = sanitizeText(String(text).replace(/^[*•\-]\s*/, '').trim());
      if (!clean) return;
      ensurePageSpace(14);
      const y0 = doc.y;
      doc.font('Helvetica').fontSize(10.5).fillColor(INK).text('\u2022', leftMargin, y0, { lineBreak: false });
      doc.text(clean, leftMargin + 13, y0, { width: contentWidth - 13, align: 'justify', lineGap: 1 });
      doc.x = leftMargin;
      doc.moveDown(0.18);
    };

    // Summary
    if (cv.professionalSummary) {
      const s = sanitizeText(cv.professionalSummary);
      if (s) {
        section('Summary');
        ensurePageSpace(18);
        doc.font('Helvetica').fontSize(10.5).fillColor(INK).text(s, leftMargin, doc.y, { width: contentWidth, align: 'justify', lineGap: 1 });
        doc.x = leftMargin;
        doc.moveDown(0.2);
      }
    }

    // Education
    if (cv.education && cv.education.length > 0) {
      section('Education');
      for (const edu of cv.education) {
        if (!edu) continue;
        ensurePageSpace(30);
        const inst = sanitizeText(edu.institution);
        const city = '';
        const degree = sanitizeText(edu.degree);
        const dates = sanitizeText(edu.dates);
        const y0 = doc.y;
        if (inst) doc.font('Helvetica-Bold').fontSize(10.5).fillColor(INK).text(inst, leftMargin, y0, { continued: true });
        if (city) {
          doc.font('Helvetica').fontSize(10.5).fillColor(INK).text(city, leftMargin, y0, { align: 'right', width: contentWidth });
        }
        doc.y = Math.max(doc.y, y0 + 13);
        const y1 = doc.y;
        if (degree) doc.font('Helvetica-Bold').fontSize(10.5).fillColor(INK).text(degree, leftMargin, y1, { continued: true });
        if (dates) doc.font('Helvetica').fontSize(10.5).fillColor(INK).text(dates, leftMargin, y1, { align: 'right', width: contentWidth });
        doc.y = Math.max(doc.y, y1 + 13);
        doc.x = leftMargin;
        doc.moveDown(0.2);
      }
    }

    // Experience
    if (cv.workExperience && cv.workExperience.length > 0) {
      section('Experience');
      for (const exp of cv.workExperience) {
        if (!exp) continue;
        ensurePageSpace(30);
        const org = sanitizeText(exp.company);
        const city = sanitizeText(exp.location);
        const title = sanitizeText(exp.title);
        const period = sanitizeText(exp.dates);
        const y0 = doc.y;
        if (org) doc.font('Helvetica-Bold').fontSize(10.5).fillColor(INK).text(org, leftMargin, y0, { continued: true });
        if (city) doc.font('Helvetica').fontSize(10.5).fillColor(INK).text(city, leftMargin, y0, { align: 'right', width: contentWidth });
        doc.y = Math.max(doc.y, y0 + 13);
        const y1 = doc.y;
        if (title) doc.font('Helvetica-Bold').fontSize(10.5).fillColor(INK).text(title, leftMargin, y1, { continued: true });
        if (period) doc.font('Helvetica').fontSize(10.5).fillColor(INK).text(period, leftMargin, y1, { align: 'right', width: contentWidth });
        doc.y = Math.max(doc.y, y1 + 13);
        doc.x = leftMargin;
        if (Array.isArray(exp.highlights)) for (const hl of exp.highlights) bullet(hl);
        doc.moveDown(0.2);
      }
    }

    // Projects
    if (cv.projects && cv.projects.length > 0) {
      section('Projects');
      for (const proj of cv.projects) {
        if (!proj) continue;
        ensurePageSpace(30);
        const pName = sanitizeText(proj.name);
        const pDates = sanitizeText(proj.dates);
        const y0 = doc.y;
        if (pName) doc.font('Helvetica-Bold').fontSize(10.5).fillColor(INK).text(pName, leftMargin, y0, { continued: true });
        if (pDates) doc.font('Helvetica').fontSize(10.5).fillColor(INK).text('[' + pDates + ']', leftMargin, y0, { align: 'right', width: contentWidth });
        doc.y = Math.max(doc.y, y0 + 13);
        doc.x = leftMargin;
        if (proj.description) bullet(sanitizeText(proj.description));
        if (proj.link) {
          ensurePageSpace(12);
          const link = normalizeUrl(proj.link);
          if (link) {
            doc.font('Helvetica').fontSize(10.5).fillColor(INK).text(link, leftMargin, doc.y, { width: contentWidth });
            doc.x = leftMargin;
            doc.moveDown(0.1);
          }
        }
        doc.moveDown(0.15);
      }
    }

    // Skills & Interests
    const skillCats = Array.isArray(cv.technicalSkills)
      ? cv.technicalSkills
          .map((cat) => ({ name: sanitizeText(cat.category), list: Array.isArray(cat.skills) ? cat.skills.map((s) => sanitizeText(s)).filter(Boolean).join(', ') : '' }))
          .filter((c) => c.name || c.list)
      : [];
    if (skillCats.length > 0) {
      section('Skills & Interests');
      for (const cat of skillCats) {
        ensurePageSpace(14);
        const y0 = doc.y;
        doc.font('Helvetica-Bold').fontSize(10.5).fillColor(INK).text(cat.name + ': ', leftMargin, y0, { continued: true });
        doc.font('Helvetica').fillColor(INK).text(cat.list, { width: contentWidth - 1, lineGap: 1 });
        doc.x = leftMargin;
        doc.moveDown(0.15);
      }
    }

    // Certifications
    if (cv.certifications && cv.certifications.length > 0) {
      section('Certifications');
      for (const cert of cv.certifications) {
        if (!cert) continue;
        let nameT = ''; let issuer = '';
        if (typeof cert === 'string') nameT = sanitizeText(cert);
        else { nameT = sanitizeText(cert.name); issuer = sanitizeText(cert.issuer); }
        if (!nameT) continue;
        ensurePageSpace(14);
        const y0 = doc.y;
        if (issuer) doc.font('Helvetica-Bold').fontSize(10.5).fillColor(INK).text(issuer, leftMargin, y0, { continued: true });
        doc.font('Helvetica').fillColor(INK).text((issuer ? '  \u2014  ' : '') + nameT, { width: contentWidth });
        doc.x = leftMargin;
        doc.moveDown(0.15);
      }
    }

    doc.end();
  });
}

/**
 * Jake — Jake Ryan one-page developer resume: black ink, uppercase name,
 * '—' bullets, black rules under headings, left-aligned, tight 9px type.
 * US Letter, margins 0.45in top/bottom, 0.5in sides.
 */
function generateJakePdf(cv: TailoredCv): Promise<Buffer> {
  const INK = '#1a1a1a';
  const MUTED = '#555555';
  const FAINT = '#777777';
  const MARGIN_X = 0.5 * 72;
  const MARGIN_Y = 0.45 * 72;
  const PAGE_W = 612;
  const PAGE_H = 792;
  const leftMargin = MARGIN_X;
  const rightMargin = PAGE_W - MARGIN_X;
  const contentWidth = rightMargin - leftMargin;
  const pageBottom = PAGE_H - MARGIN_Y;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margins: { top: MARGIN_Y, bottom: MARGIN_Y, left: MARGIN_X, right: MARGIN_X } });
    const buffers: Buffer[] = [];
    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', (err) => reject(err));

    const ensurePageSpace = (h: number) => {
      if (doc.y + h > pageBottom) { doc.addPage(); doc.y = MARGIN_Y; }
    };

    // Header: uppercase name left, role, contact
    const name = sanitizeText(cv.candidateName).toUpperCase() || 'CANDIDATE NAME';
    ensurePageSpace(60);
    doc.font('Helvetica-Bold').fontSize(24).fillColor('#111111').text(name, leftMargin, doc.y, { width: contentWidth });
    doc.moveDown(0.15);
    if (cv.targetRole) {
      const role = sanitizeText(cv.targetRole);
      if (role) {
        ensurePageSpace(14);
        doc.font('Helvetica-Bold').fontSize(11.5).fillColor(MUTED).text(role, leftMargin, doc.y, { width: contentWidth });
        doc.moveDown(0.15);
      }
    }
    const contactLinks = getContactLinks(cv);
    if (contactLinks.length > 0) {
      ensurePageSpace(14);
      const sep = '   |   ';
      const y0 = doc.y;
      let cx = leftMargin;
      contactLinks.forEach((item, idx) => {
        const label = sanitizeText(item.label);
        if (!label) return;
        const w = doc.widthOfString(label);
        const normUrl = item.url ? normalizeUrl(item.url) : undefined;
        doc.font('Helvetica').fontSize(9.5).fillColor('#444444');
        doc.text(label, cx, y0, { lineBreak: false });
        if (normUrl) doc.link(cx, y0, w, 10, normUrl);
        cx += w;
        if (idx < contactLinks.length - 1) {
          doc.fillColor('#AAAAAA').text(sep, cx, y0, { lineBreak: false });
          cx += doc.widthOfString(sep);
        }
      });
      doc.y = y0 + 12;
      doc.x = leftMargin;
    }
    doc.moveDown(0.25);

    // Section heading: black bold uppercase + 1px black rule
    const section = (title: string) => {
      ensurePageSpace(30);
      doc.moveDown(0.3);
      const y0 = doc.y;
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#111111').text(title.toUpperCase(), leftMargin, y0, { width: contentWidth });
      const ruleY = doc.y + 2;
      doc.moveTo(leftMargin, ruleY).lineTo(rightMargin, ruleY).lineWidth(1).strokeColor('#111111').stroke();
      doc.y = ruleY + 5;
      doc.x = leftMargin;
    };

    const bullet = (text: string) => {
      if (!text) return;
      const clean = sanitizeText(String(text).replace(/^[*•\-]\s*/, '').trim());
      if (!clean) return;
      ensurePageSpace(13);
      const y0 = doc.y;
      doc.font('Helvetica').fontSize(9).fillColor(INK).text('\u2014', leftMargin, y0, { lineBreak: false });
      doc.text(clean, leftMargin + 12, y0, { width: contentWidth - 12, align: 'justify', lineGap: 1 });
      doc.x = leftMargin;
      doc.moveDown(0.12);
    };

    if (cv.professionalSummary) {
      const s = sanitizeText(cv.professionalSummary);
      if (s) {
        section('Summary');
        ensurePageSpace(16);
        doc.font('Helvetica').fontSize(9).fillColor(INK).text(s, leftMargin, doc.y, { width: contentWidth, align: 'justify', lineGap: 1 });
        doc.x = leftMargin;
        doc.moveDown(0.15);
      }
    }

    const skillCats = Array.isArray(cv.technicalSkills)
      ? cv.technicalSkills
          .map((cat) => ({ name: sanitizeText(cat.category), list: Array.isArray(cat.skills) ? cat.skills.map((s) => sanitizeText(s)).filter(Boolean).join(', ') : '' }))
          .filter((c) => c.name || c.list)
      : [];
    if (skillCats.length > 0) {
      section('Skills');
      // Two-column grid: first half left, second half right
      const colGap = 20;
      const colW = (contentWidth - colGap) / 2;
      const half = Math.ceil(skillCats.length / 2);
      let yLeft = doc.y;
      let yRight = doc.y;
      skillCats.forEach((cat, i) => {
        const isRight = i >= half;
        const colX = isRight ? leftMargin + colW + colGap : leftMargin;
        const y = isRight ? yRight : yLeft;
        const line = cat.name + ': ' + cat.list;
        ensurePageSpace(13);
        const h = doc.heightOfString(line, { width: colW });
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#111111').text(cat.name + ': ', colX, y, { continued: true, width: colW });
        doc.font('Helvetica').fillColor(INK).text(cat.list, { width: colW, lineGap: 1 });
        if (isRight) yRight = y + h + 4; else yLeft = y + h + 4;
      });
      doc.y = Math.max(yLeft, yRight);
      doc.x = leftMargin;
      doc.moveDown(0.15);
    }

    if (cv.workExperience && cv.workExperience.length > 0) {
      section('Experience');
      for (const exp of cv.workExperience) {
        if (!exp) continue;
        ensurePageSpace(24);
        const title = sanitizeText(exp.title);
        const company = sanitizeText(exp.company);
        const period = sanitizeText(exp.dates);
        const loc = sanitizeText(exp.location);
        const y0 = doc.y;
        doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#111111').text(title, leftMargin, y0, { continued: true });
        doc.font('Helvetica').fillColor(MUTED).text(company ? '  \u2014  ' + company : '', { continued: true });
        doc.x = leftMargin;
        if (period) doc.font('Helvetica').fontSize(8.5).fillColor(FAINT).text(period, leftMargin, y0, { align: 'right', width: contentWidth });
        doc.y = Math.max(doc.y, y0 + 12);
        if (loc) {
          ensurePageSpace(11);
          doc.font('Helvetica').fontSize(9).fillColor(FAINT).text(loc, leftMargin, doc.y, { width: contentWidth });
          doc.moveDown(0.1);
        }
        doc.x = leftMargin;
        if (Array.isArray(exp.highlights)) for (const hl of exp.highlights) bullet(hl);
        doc.moveDown(0.25);
      }
    }

    if (cv.projects && cv.projects.length > 0) {
      section('Projects');
      for (const proj of cv.projects) {
        if (!proj) continue;
        ensurePageSpace(18);
        const pName = sanitizeText(proj.name);
        const pDates = sanitizeText(proj.dates);
        const y0 = doc.y;
        doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#111111').text(pName, leftMargin, y0, { continued: true });
        if (pDates) doc.font('Helvetica').fontSize(8.5).fillColor(FAINT).text('  [' + pDates + ']');
        doc.x = leftMargin;
        doc.moveDown(0.1);
        if (proj.description) {
          const d = sanitizeText(proj.description);
          if (d) {
            ensurePageSpace(13);
            doc.font('Helvetica').fontSize(9).fillColor(INK).text(d, leftMargin, doc.y, { width: contentWidth, lineGap: 1 });
            doc.x = leftMargin;
            doc.moveDown(0.05);
          }
        }
        if (proj.link) {
          const link = normalizeUrl(proj.link);
          if (link) {
            ensurePageSpace(11);
            doc.font('Helvetica').fontSize(9).fillColor('#111111').text(link, leftMargin, doc.y, { width: contentWidth });
            doc.x = leftMargin;
          }
        }
        doc.moveDown(0.15);
      }
    }

    if (cv.education && cv.education.length > 0) {
      section('Education');
      for (const edu of cv.education) {
        if (!edu) continue;
        ensurePageSpace(14);
        const inst = sanitizeText(edu.institution);
        const degree = sanitizeText(edu.degree);
        const dates = sanitizeText(edu.dates);
        const y0 = doc.y;
        doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#111111').text(inst, leftMargin, y0, { continued: true });
        doc.font('Helvetica').fillColor(INK)
          .text((degree ? '  \u2014  ' + degree : '') + (dates ? '  \u00A0\u00A0' + dates : ''));
        doc.x = leftMargin;
        doc.moveDown(0.2);
      }
    }

    if (cv.certifications && cv.certifications.length > 0) {
      section('Certifications');
      for (const cert of cv.certifications) {
        if (!cert) continue;
        let nameT = ''; let issuer = '';
        if (typeof cert === 'string') nameT = sanitizeText(cert);
        else { nameT = sanitizeText(cert.name); issuer = sanitizeText(cert.issuer); }
        if (!nameT) continue;
        ensurePageSpace(13);
        const y0 = doc.y;
        if (issuer) doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#111111').text(issuer, leftMargin, y0, { continued: true });
        doc.font('Helvetica').fillColor(INK).text((issuer ? '  \u2014  ' : '') + nameT, { width: contentWidth });
        doc.x = leftMargin;
        doc.moveDown(0.15);
      }
    }

    doc.end();
  });
}


export function generatePlainTextCv(cv: TailoredCv): string {
  const lines: string[] = [];

  lines.push(`${cv.candidateName.toUpperCase()}`);
  if (cv.targetRole) lines.push(`Target Role: ${cv.targetRole}`);

  const contactLinks = getContactLinks(cv);
  if (contactLinks.length > 0) {
    lines.push(contactLinks.map((c) => (c.url ? `${c.label} (${c.url})` : c.label)).join('   |   '));
  }
  lines.push('='.repeat(60));
  lines.push('');

  if (cv.professionalSummary) {
    lines.push('PROFESSIONAL SUMMARY');
    lines.push('-'.repeat(30));
    lines.push(cv.professionalSummary);
    lines.push('');
  }

  const hasTechnicalSkills = cv.technicalSkills && cv.technicalSkills.length > 0;
  const hasCoreCompetencies = cv.coreCompetencies && cv.coreCompetencies.length > 0;

  if (hasTechnicalSkills || hasCoreCompetencies) {
    lines.push('TECHNICAL SKILLS & COMPETENCIES');
    lines.push('-'.repeat(30));
    if (hasTechnicalSkills) {
      for (const cat of cv.technicalSkills) {
        lines.push(`${cat.category}: ${cat.skills.join(', ')}`);
      }
    } else if (hasCoreCompetencies) {
      lines.push(cv.coreCompetencies.join(', '));
    }
    lines.push('');
  }

  if (cv.workExperience && cv.workExperience.length > 0) {
    lines.push('PROFESSIONAL EXPERIENCE');
    lines.push('-'.repeat(30));
    for (const exp of cv.workExperience) {
      lines.push(`${exp.title}   |   ${exp.company}`);
      if (exp.dates || exp.location) {
        lines.push([exp.dates, exp.location].filter(Boolean).join('   |   '));
      }
      for (const hl of exp.highlights) {
        lines.push(`  • ${hl.replace(/^[*•\-]\s*/, '')}`);
      }
      lines.push('');
    }
  }

  if (cv.projects && cv.projects.length > 0) {
    lines.push('FEATURED PROJECTS');
    lines.push('-'.repeat(30));
    for (const proj of cv.projects) {
      const projMeta = [proj.dates, (proj.technologies || []).join(', '), proj.link].filter(Boolean).join('   |   ');
      lines.push(`${proj.name}${projMeta ? '   |   ' + projMeta : ''}`);
      if (proj.description) {
        lines.push(`  • ${proj.description.replace(/^[*•\-]\s*/, '')}`);
      }
      lines.push('');
    }
  }

  if (cv.education && cv.education.length > 0) {
    lines.push('EDUCATION');
    lines.push('-'.repeat(30));
    for (const edu of cv.education) {
      lines.push(`${edu.degree}   |   ${edu.institution}`);
      if (edu.dates) lines.push(edu.dates);
      lines.push('');
    }
  }

  if (cv.certifications && cv.certifications.length > 0) {
    lines.push('CERTIFICATIONS & CREDENTIALS');
    lines.push('-'.repeat(30));
    for (const cert of cv.certifications) {
      if (typeof cert === 'string') {
        lines.push(`  • ${cert}`);
      } else if (cert && typeof cert === 'object') {
        const parts = [cert.name, cert.issuer, cert.date, cert.link].filter(Boolean);
        lines.push(`  • ${parts.join('   |   ')}`);
      }
    }
  }

  return lines.join('\n');
}
