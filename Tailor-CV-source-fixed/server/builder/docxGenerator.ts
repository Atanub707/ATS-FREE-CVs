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
  // ── Template styles (must match src/components/CvPdfPreview.tsx CV_TEMPLATE_STYLES) ──
  const TEMPLATES: Record<string, { accent: string; nameSize: number; roleColor: string; ruleWidth: number; bodySize: number; bulletSize: number; sectionGap: number; expTitleSize: number }> = {
    'harvard': { accent: '#2F54EB', nameSize: 18, roleColor: '#374151', ruleWidth: 0.75, bodySize: 9.5, bulletSize: 9.5, sectionGap: 10, expTitleSize: 10 },
    'modern-minimal': { accent: '#111827', nameSize: 20, roleColor: '#565D6C', ruleWidth: 1.25, bodySize: 9.5, bulletSize: 9.5, sectionGap: 14, expTitleSize: 10 },
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
 * Generate plain text ATS representation.
 */
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
