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

/**
 * Generate DOCX buffer adhering to top-notch ATS standards with clickable hyperlinks,
 * matching the exact font sizes, margins, colors, and layout of the PDF template.
 */
export async function generateDocxBuffer(cv: TailoredCv): Promise<Buffer> {
  const children: Paragraph[] = [];
  const contactLinks = getContactLinks(cv);

  // 1. Candidate Name: 18pt Bold, centered (Arial, #111827)
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 20, line: 240 },
      children: [
        new TextRun({
          text: (sanitizeText(cv.candidateName) || 'CANDIDATE NAME').toUpperCase(),
          bold: true,
          size: 36, // 18pt
          font: 'Arial',
          color: '111827',
        }),
      ],
    })
  );

  // Target Role / Subtitle: 10pt Bold, centered (#374151)
  if (cv.targetRole) {
    const targetRole = sanitizeText(cv.targetRole);
    if (targetRole) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 40, line: 240 },
          children: [
            new TextRun({
              text: targetRole,
              bold: true,
              size: 20, // 10pt
              font: 'Arial',
              color: '374151',
            }),
          ],
        })
      );
    }
  }

  // 2. Clickable Contact Bar: 9pt (#0055BB for links, #374151 for text, #9CA3AF for bullet separators)
  if (contactLinks.length > 0) {
    const contactChildren: (TextRun | ExternalHyperlink)[] = [];

    contactLinks.forEach((item, idx) => {
      const cleanLabel = sanitizeText(item.label);
      if (!cleanLabel) return;

      const normUrl = item.url ? normalizeUrl(item.url) : undefined;
      if (normUrl) {
        contactChildren.push(
          new ExternalHyperlink({
            link: normUrl,
            children: [
              new TextRun({
                text: cleanLabel,
                size: 18, // 9pt
                font: 'Arial',
                color: '0055BB',
              }),
            ],
          })
        );
      } else {
        contactChildren.push(
          new TextRun({
            text: cleanLabel,
            size: 18, // 9pt
            font: 'Arial',
            color: '374151',
          })
        );
      }

      if (idx < contactLinks.length - 1) {
        contactChildren.push(
          new TextRun({
            text: '   •   ',
            size: 18, // 9pt
            font: 'Arial',
            color: '9CA3AF',
          })
        );
      }
    });

    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 120, line: 240 },
        children: contactChildren,
      })
    );
  }

  // Helper for Section Headers: 10.5pt ALL CAPS Bold (#111827), bottom border 0.75pt rule (#9CA3AF)
  const createSectionHeader = (title: string): Paragraph => {
    return new Paragraph({
      spacing: { before: 180, after: 60, line: 240 },
      border: {
        bottom: {
          style: BorderStyle.SINGLE,
          size: 6, // ~0.75pt line
          color: '9CA3AF',
          space: 2,
        },
      },
      children: [
        new TextRun({
          text: sanitizeText(title).toUpperCase(),
          bold: true,
          size: 21, // 10.5pt
          font: 'Arial',
          color: '111827',
        }),
      ],
    });
  };

  // Helper for Bullet Points: 9.5pt (#1F2937 or #0055BB for links) with bullet '•  '
  const createBulletPoint = (text: string, linkUrl?: string): Paragraph => {
    const cleanText = sanitizeText(text.replace(/^[*•\-]\s*/, '').trim());
    if (!cleanText) return new Paragraph({});

    const childrenList: (TextRun | ExternalHyperlink)[] = [
      new TextRun({
        text: '•   ',
        font: 'Arial',
        size: 19, // 9.5pt
        color: '4B5563',
      }),
    ];

    const normUrl = linkUrl ? normalizeUrl(linkUrl) : undefined;
    if (normUrl) {
      childrenList.push(
        new ExternalHyperlink({
          link: normUrl,
          children: [
            new TextRun({
              text: cleanText,
              font: 'Arial',
              size: 19, // 9.5pt
              color: '0055BB',
              underline: { type: UnderlineType.SINGLE },
            }),
          ],
        })
      );
    } else {
      childrenList.push(
        new TextRun({
          text: cleanText,
          font: 'Arial',
          size: 19, // 9.5pt
          color: '1F2937',
        })
      );
    }

    return new Paragraph({
      indent: {
        left: 288, // ~0.2 in
        hanging: 216, // ~0.15 in hanging indent
      },
      spacing: { after: 20, line: 250 },
      children: childrenList,
    });
  };

  // 3. Section: PROFESSIONAL SUMMARY
  if (cv.professionalSummary) {
    const cleanSummary = sanitizeText(cv.professionalSummary);
    if (cleanSummary) {
      children.push(createSectionHeader('PROFESSIONAL SUMMARY'));
      children.push(
        new Paragraph({
          spacing: { after: 100, line: 260 },
          children: [
            new TextRun({
              text: cleanSummary,
              size: 19, // 9.5pt
              font: 'Arial',
              color: '1F2937',
            }),
          ],
        })
      );
    }
  }

  // 4. Section: TECHNICAL SKILLS
  const hasTechnicalSkills = cv.technicalSkills && cv.technicalSkills.length > 0;
  const hasCoreCompetencies = cv.coreCompetencies && cv.coreCompetencies.length > 0;

  if (hasTechnicalSkills || hasCoreCompetencies) {
    children.push(createSectionHeader('TECHNICAL SKILLS & COMPETENCIES'));

    if (hasTechnicalSkills) {
      for (const cat of cv.technicalSkills) {
        if (!cat) continue;
        const catName = sanitizeText(cat.category);
        const skillsList = Array.isArray(cat.skills)
          ? cat.skills.map((s) => sanitizeText(s)).filter(Boolean).join(', ')
          : '';
        if (!catName && !skillsList) continue;

        children.push(
          new Paragraph({
            spacing: { after: 40, line: 250 },
            children: [
              new TextRun({
                text: `${catName}: `,
                bold: true,
                size: 19, // 9.5pt
                font: 'Arial',
                color: '111827',
              }),
              new TextRun({
                text: skillsList,
                size: 19, // 9.5pt
                font: 'Arial',
                color: '374151',
              }),
            ],
          })
        );
      }
    } else if (hasCoreCompetencies) {
      const compList = cv.coreCompetencies.map((c) => sanitizeText(c)).filter(Boolean).join(', ');
      if (compList) {
        children.push(
          new Paragraph({
            spacing: { after: 100, line: 250 },
            children: [
              new TextRun({
                text: compList,
                size: 19, // 9.5pt
                font: 'Arial',
                color: '1F2937',
              }),
            ],
          })
        );
      }
    }
  }

  // 5. Section: PROFESSIONAL EXPERIENCE
  if (cv.workExperience && cv.workExperience.length > 0) {
    children.push(createSectionHeader('PROFESSIONAL EXPERIENCE'));

    for (const exp of cv.workExperience) {
      if (!exp) continue;
      const title = sanitizeText(exp.title);
      const company = sanitizeText(exp.company);
      const dateLoc = [sanitizeText(exp.dates), sanitizeText(exp.location)].filter(Boolean).join('   |   ');

      const titleComp = company ? `${title}   |   ${company}` : title;

      children.push(
        new Paragraph({
          tabStops: [{ type: TabStopType.RIGHT, position: 10080 }],
          spacing: { before: 100, after: 20, line: 250 },
          children: [
            new TextRun({
              text: titleComp,
              bold: true,
              size: 20, // 10pt
              font: 'Arial',
              color: '111827',
            }),
            ...(dateLoc
              ? [
                  new TextRun({
                    text: `\t${dateLoc}`,
                    italics: true,
                    size: 17, // 8.5pt
                    font: 'Arial',
                    color: '4B5563',
                  }),
                ]
              : []),
          ],
        })
      );

      if (Array.isArray(exp.highlights)) {
        for (const hl of exp.highlights) {
          children.push(createBulletPoint(hl));
        }
      }
    }
  }

  // 6. Section: FEATURED PROJECTS
  if (cv.projects && cv.projects.length > 0) {
    children.push(createSectionHeader('FEATURED PROJECTS'));

    for (const proj of cv.projects) {
      if (!proj) continue;
      const pName = sanitizeText(proj.name);
      const normLink = proj.link ? normalizeUrl(proj.link) : undefined;
      const pDates = sanitizeText(proj.dates);

      const titleChildren: (TextRun | ExternalHyperlink)[] = [
        new TextRun({
          text: pName,
          bold: true,
          size: 20, // 10pt
          font: 'Arial',
          color: '111827',
        }),
      ];

      if (normLink) {
        titleChildren.push(
          new ExternalHyperlink({
            link: normLink,
            children: [
              new TextRun({
                text: '   |   View Project',
                size: 18, // 9pt
                font: 'Arial',
                color: '0055BB',
              }),
            ],
          })
        );
      }

      if (pDates) {
        titleChildren.push(
          new TextRun({
            text: `\t${pDates}`,
            italics: true,
            size: 17, // 8.5pt
            font: 'Arial',
            color: '4B5563',
          })
        );
      }

      children.push(
        new Paragraph({
          tabStops: [{ type: TabStopType.RIGHT, position: 10080 }],
          spacing: { before: 100, after: 20, line: 250 },
          children: titleChildren,
        })
      );

      if (Array.isArray(proj.technologies) && proj.technologies.length > 0) {
        const techList = proj.technologies.map((t) => sanitizeText(t)).filter(Boolean).join(', ');
        if (techList) {
          children.push(
            new Paragraph({
              spacing: { after: 20, line: 250 },
              children: [
                new TextRun({
                  text: 'Technologies: ',
                  bold: true,
                  size: 18, // 9pt
                  font: 'Arial',
                  color: '374151',
                }),
                new TextRun({
                  text: techList,
                  size: 18, // 9pt
                  font: 'Arial',
                  color: '4B5563',
                }),
              ],
            })
          );
        }
      }

      if (proj.description) {
        children.push(createBulletPoint(proj.description));
      }
    }
  }

  // 7. Section: EDUCATION
  if (cv.education && cv.education.length > 0) {
    children.push(createSectionHeader('EDUCATION'));

    for (const edu of cv.education) {
      if (!edu) continue;
      const degree = sanitizeText(edu.degree);
      const inst = sanitizeText(edu.institution);
      const eDates = sanitizeText(edu.dates);

      children.push(
        new Paragraph({
          tabStops: [{ type: TabStopType.RIGHT, position: 10080 }],
          spacing: { before: 100, after: 20, line: 250 },
          children: [
            new TextRun({
              text: degree,
              bold: true,
              size: 20, // 10pt
              font: 'Arial',
              color: '111827',
            }),
            ...(eDates
              ? [
                  new TextRun({
                    text: `\t${eDates}`,
                    italics: true,
                    size: 17, // 8.5pt
                    font: 'Arial',
                    color: '4B5563',
                  }),
                ]
              : []),
          ],
        })
      );

      if (inst) {
        children.push(
          new Paragraph({
            spacing: { after: 40, line: 250 },
            children: [
              new TextRun({
                text: inst,
                size: 19, // 9.5pt
                font: 'Arial',
                color: '374151',
              }),
            ],
          })
        );
      }
    }
  }

  // 8. Section: CERTIFICATIONS & CREDENTIALS
  if (cv.certifications && cv.certifications.length > 0) {
    children.push(createSectionHeader('CERTIFICATIONS & CREDENTIALS'));

    for (const cert of cv.certifications) {
      if (!cert) continue;
      if (typeof cert === 'string') {
        children.push(createBulletPoint(cert));
      } else if (typeof cert === 'object') {
        const parts = [sanitizeText(cert.name), sanitizeText(cert.issuer), sanitizeText(cert.date)].filter(Boolean);
        children.push(createBulletPoint(parts.join('   |   '), cert.link));
      }
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 864, // 0.6 in (matching PDF 43.2 pt)
              bottom: 864, // 0.6 in (matching PDF 43.2 pt)
              left: 1080, // 0.75 in (matching PDF 54 pt)
              right: 1080, // 0.75 in (matching PDF 54 pt)
            },
          },
        },
        children,
      },
    ],
  });

  return await Packer.toBuffer(doc);
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
 */
export function generatePdfBuffer(cv: TailoredCv): Promise<Buffer> {
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

    // 1. Candidate Name: 18pt Bold, centered (Harvard Style)
    doc.x = leftMargin;
    const candidateName = sanitizeText(cv.candidateName).toUpperCase() || 'CANDIDATE NAME';
    ensurePageSpace(30);
    doc.font('Helvetica-Bold').fontSize(18).fillColor('#111827').text(candidateName, leftMargin, doc.y, {
      align: 'center',
      width: contentWidth,
    });
    doc.moveDown(0.1);

    // Target Role
    if (cv.targetRole) {
      const targetRole = sanitizeText(cv.targetRole);
      if (targetRole) {
        doc.font('Helvetica-Bold').fontSize(10).fillColor('#374151').text(targetRole, leftMargin, doc.y, {
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

    // Helper to render section header: Harvard format 10.5pt ALL CAPS Bold with solid horizontal rule
    const renderSectionHeader = (title: string) => {
      ensurePageSpace(30);
      doc.x = leftMargin;
      doc.moveDown(0.2);
      const headY = doc.y;
      doc.font('Helvetica-Bold').fontSize(10.5).fillColor('#111827').text(sanitizeText(title).toUpperCase(), leftMargin, headY, {
        width: contentWidth,
      });
      const ruleY = doc.y + 1;
      doc.moveTo(leftMargin, ruleY).lineTo(rightMargin, ruleY).lineWidth(0.75).strokeColor('#9CA3AF').stroke();
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

      doc.font('Helvetica').fontSize(9.5).fillColor('#4B5563').text('•', bulletX, currentY, { lineBreak: false });

      const normUrl = linkUrl ? normalizeUrl(linkUrl) : undefined;
      if (normUrl) {
        doc.font('Helvetica').fontSize(9.5).fillColor('#0055BB').text(clean, textX, currentY, {
          width: tWidth,
          lineGap: 1.5,
          underline: true,
        });
        const rawH = doc.heightOfString(clean, { width: tWidth });
        const h = isFinite(rawH) && rawH > 0 ? rawH : 12;
        doc.link(textX, currentY, tWidth, h, normUrl);
      } else {
        doc.font('Helvetica').fontSize(9.5).fillColor('#1F2937').text(clean, textX, currentY, {
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
        doc.font('Helvetica').fontSize(9.5).fillColor('#1F2937').text(cleanSummary, leftMargin, doc.y, {
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
            .fontSize(9.5)
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
          doc.font('Helvetica').fontSize(9.5).fillColor('#1F2937').text(compList, leftMargin, doc.y, {
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
        doc.font('Helvetica-Bold').fontSize(10).fillColor('#111827').text(titleComp, leftMargin, entryY, {
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
            .fontSize(10)
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
            .fontSize(10)
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
          .fontSize(10)
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
            .fontSize(9.5)
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
