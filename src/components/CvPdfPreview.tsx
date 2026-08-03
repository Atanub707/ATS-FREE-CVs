import React from 'react';
import { MasterCv } from '../types';

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

function getContactItems(cv: PdfCvShape): { label: string; url?: string }[] {
  const items: { label: string; url?: string }[] = [];
  if (cv.contactInfo.email) items.push({ label: cv.contactInfo.email, url: `mailto:${cv.contactInfo.email}` });
  if (cv.contactInfo.phone) items.push({ label: cv.contactInfo.phone });
  if (cv.contactInfo.location) items.push({ label: cv.contactInfo.location });
  if (cv.contactInfo.linkedin) {
    const label = cv.contactInfo.linkedin.replace(/^https?:\/\/(www\.)?/, '');
    items.push({ label, url: cv.contactInfo.linkedin });
  }
  if (cv.contactInfo.github) {
    const label = cv.contactInfo.github.replace(/^https?:\/\/(www\.)?/, '');
    items.push({ label, url: cv.contactInfo.github });
  }
  if (cv.contactInfo.website) items.push({ label: cv.contactInfo.website, url: cv.contactInfo.website });
  return items;
}

interface CvPdfPreviewProps {
  cv: PdfCvShape;
  zoom?: 50 | 75 | 100;
}

/**
 * HTML replica of the server-side PDF (docxGenerator.ts / generatePdfBuffer).
 * Fonts, sizes, colors and layout mirror pdfkit output exactly:
 *  - Letter 8.5x11, margins 0.75" sides / 0.6" top-bottom
 *  - Name: Helvetica-Bold 18pt centered #111827, uppercase
 *  - Target role: Helvetica-Bold 10pt centered #374151
 *  - Contact: Helvetica 9pt centered, '   •   ' separators, links #0055BB
 *  - Section headers: Helvetica-Bold 10.5pt uppercase #111827 + 0.75pt #9CA3AF rule
 *  - Bullets: 9.5pt '•' #4B5563, text #1F2937
 */
export const CvPdfPreview: React.FC<CvPdfPreviewProps> = ({ cv, zoom = 100 }) => {
  const widthPx = Math.round(612 * (zoom / 100));
  const contacts = getContactItems(cv);
  const hasTechSkills = cv.technicalSkills.length > 0 || (cv.coreCompetencies?.length || 0) > 0;

  return (
    <div
      className="bg-white text-left"
      style={{
        width: widthPx,
        minHeight: Math.round(792 * (zoom / 100)),
        padding: `${Math.round(43.2 * (zoom / 100))}px ${Math.round(54 * (zoom / 100))}px`,
        fontFamily: 'Helvetica, Arial, sans-serif',
        color: '#1F2937',
        fontSize: Math.round(9.5 * (zoom / 100)) + 'px',
        lineHeight: 1.45,
        transition: 'width .25s ease, min-height .25s ease, font-size .25s ease, padding .25s ease',
      }}
    >
      {/* 1. Name */}
      <div
        style={{
          textAlign: 'center',
          fontFamily: 'Helvetica-Bold, Helvetica, Arial, sans-serif',
          fontSize: Math.round(18 * (zoom / 100)) + 'px',
          fontWeight: 700,
          color: '#111827',
          textTransform: 'uppercase',
        }}
      >
        {cv.candidateName || 'CANDIDATE NAME'}
      </div>

      {/* Target role */}
      {cv.targetRole && (
        <div
          style={{
            textAlign: 'center',
            fontWeight: 700,
            fontSize: Math.round(10 * (zoom / 100)) + 'px',
            color: '#374151',
            marginTop: Math.round(3 * (zoom / 100)) + 'px',
          }}
        >
          {cv.targetRole}
        </div>
      )}

      {/* 2. Contact line */}
      {contacts.length > 0 && (
        <div style={{ textAlign: 'center', fontSize: Math.round(9 * (zoom / 100)) + 'px', marginTop: Math.round(6 * (zoom / 100)) + 'px' }}>
          {contacts.map((c, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span style={{ color: '#9CA3AF', margin: `0 ${Math.round(5 * (zoom / 100))}px` }}>•</span>}
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

      {/* 3. Professional Summary */}
      {cv.professionalSummary && (
        <>
          <SectionTitle zoom={zoom}>PROFESSIONAL SUMMARY</SectionTitle>
          <div style={{ color: '#1F2937', marginBottom: Math.round(4 * (zoom / 100)) + 'px' }}>{cv.professionalSummary}</div>
        </>
      )}

      {/* 4. Technical Skills */}
      {hasTechSkills && (
        <>
          <SectionTitle zoom={zoom}>TECHNICAL SKILLS &amp; COMPETENCIES</SectionTitle>
          {cv.technicalSkills.map((cat, i) => (
            <div key={i} style={{ marginBottom: Math.round(3 * (zoom / 100)) + 'px' }}>
              <span style={{ fontWeight: 700, color: '#111827' }}>{cat.category}: </span>
              <span style={{ color: '#374151' }}>{cat.skills.join(', ')}</span>
            </div>
          ))}
          {cv.technicalSkills.length === 0 && cv.coreCompetencies && (
            <div style={{ color: '#1F2937' }}>{cv.coreCompetencies.join(', ')}</div>
          )}
        </>
      )}

      {/* 5. Professional Experience */}
      {cv.workExperience.length > 0 && (
        <>
          <SectionTitle zoom={zoom}>PROFESSIONAL EXPERIENCE</SectionTitle>
          {cv.workExperience.map((exp, i) => (
            <div key={i} style={{ marginBottom: Math.round(8 * (zoom / 100)) + 'px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
                <span style={{ fontWeight: 700, fontSize: Math.round(10 * (zoom / 100)) + 'px', color: '#111827' }}>
                  {[exp.title, exp.company].filter(Boolean).join('   |   ')}
                </span>
                <span style={{ fontStyle: 'italic', fontSize: Math.round(8.5 * (zoom / 100)) + 'px', color: '#4B5563', whiteSpace: 'nowrap' }}>
                  {[exp.dates, exp.location].filter(Boolean).join('   |   ')}
                </span>
              </div>
              <div style={{ marginTop: Math.round(2 * (zoom / 100)) + 'px' }}>
                {exp.highlights.map((hl, j) => (
                  <Bullet key={j} zoom={zoom} text={hl} />
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      {/* 6. Featured Projects */}
      {cv.projects && cv.projects.length > 0 && (
        <>
          <SectionTitle zoom={zoom}>FEATURED PROJECTS</SectionTitle>
          {cv.projects.map((p, i) => (
            <div key={i} style={{ marginBottom: Math.round(8 * (zoom / 100)) + 'px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
                <span style={{ fontWeight: 700, fontSize: Math.round(10 * (zoom / 100)) + 'px', color: '#111827' }}>
                  {p.name}
                  {p.link && (
                    <a href={p.link} target="_blank" rel="noopener noreferrer" style={{ color: '#0055BB', fontSize: Math.round(9 * (zoom / 100)) + 'px', fontWeight: 400, marginLeft: Math.round(6 * (zoom / 100)) + 'px' }}>
                      | View Project
                    </a>
                  )}
                </span>
                {p.dates && (
                  <span style={{ fontStyle: 'italic', fontSize: Math.round(8.5 * (zoom / 100)) + 'px', color: '#4B5563', whiteSpace: 'nowrap' }}>
                    {p.dates}
                  </span>
                )}
              </div>
              {p.technologies && p.technologies.length > 0 && (
                <div style={{ fontSize: Math.round(9 * (zoom / 100)) + 'px', marginTop: Math.round(2 * (zoom / 100)) + 'px' }}>
                  <span style={{ fontWeight: 700, color: '#374151' }}>Technologies: </span>
                  <span style={{ color: '#4B5563' }}>{p.technologies.join(', ')}</span>
                </div>
              )}
              {p.description && <Bullet zoom={zoom} text={p.description} />}
            </div>
          ))}
        </>
      )}

      {/* 7. Education */}
      {cv.education.length > 0 && (
        <>
          <SectionTitle zoom={zoom}>EDUCATION</SectionTitle>
          {cv.education.map((e, i) => (
            <div key={i} style={{ marginBottom: Math.round(6 * (zoom / 100)) + 'px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
                <span style={{ fontWeight: 700, fontSize: Math.round(10 * (zoom / 100)) + 'px', color: '#111827' }}>{e.degree}</span>
                {e.dates && (
                  <span style={{ fontStyle: 'italic', fontSize: Math.round(8.5 * (zoom / 100)) + 'px', color: '#4B5563', whiteSpace: 'nowrap' }}>
                    {e.dates}
                  </span>
                )}
              </div>
              <div style={{ color: '#374151' }}>{e.institution}</div>
            </div>
          ))}
        </>
      )}

      {/* 8. Certifications */}
      {cv.certifications && cv.certifications.length > 0 && (
        <>
          <SectionTitle zoom={zoom}>CERTIFICATIONS &amp; CREDENTIALS</SectionTitle>
          {cv.certifications.map((cert, i) => {
            const parts = typeof cert === 'string' ? [cert] : [cert.name, cert.issuer, cert.date].filter(Boolean);
            return <Bullet key={i} zoom={zoom} text={parts.join('   |   ')} />;
          })}
        </>
      )}
    </div>
  );
};

const SectionTitle: React.FC<{ zoom: number; children: React.ReactNode }> = ({ zoom, children }) => (
  <div style={{ marginTop: Math.round(10 * (zoom / 100)) + 'px', marginBottom: Math.round(6 * (zoom / 100)) + 'px' }}>
    <div
      style={{
        fontWeight: 700,
        fontSize: Math.round(10.5 * (zoom / 100)) + 'px',
        color: '#111827',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
      }}
    >
      {children}
    </div>
    <div style={{ height: 1, background: '#9CA3AF', marginTop: Math.round(3 * (zoom / 100)) + 'px' }} />
  </div>
);

const Bullet: React.FC<{ zoom: number; text: string }> = ({ zoom, text }) => {
  const clean = String(text || '').replace(/^[*•\-]\s*/, '').trim();
  if (!clean) return null;
  return (
    <div style={{ display: 'flex', gap: Math.round(6 * (zoom / 100)) + 'px', marginBottom: Math.round(2 * (zoom / 100)) + 'px' }}>
      <span style={{ color: '#4B5563', flexShrink: 0 }}>•</span>
      <span style={{ color: '#1F2937' }}>{clean}</span>
    </div>
  );
};
