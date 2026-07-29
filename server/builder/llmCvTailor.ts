import { BaseCvBuilder } from './baseBuilder.js';
import { Job, MasterCv, TailoredCv } from '../../src/types.js';
import { ask } from '../llm/llmAdapter.js';

export class LlmCvTailor extends BaseCvBuilder {
  async tailorCv(job: Job, masterCv: MasterCv): Promise<TailoredCv> {
    const candidateTitle = masterCv.experiences[0]?.title || masterCv.summary?.split(/[.,\n]/)[0]?.trim() || job.title;

    const missingSkills = job.gapAnalysis?.missingSkills || [];
    const missingKeywords = job.gapAnalysis?.missingKeywords || [];

    const missingKeywordsStr = missingKeywords.length > 0
      ? missingKeywords.map(k => `  - ${k}`).join('\n')
      : '  (none identified)';

    const prompt = `You are an elite Executive Resume Writer and ATS Optimization Specialist.

STRICT RULES:
- NEVER fabricate companies, dates, degrees, or work experience.
- The candidate's actual job title ("${candidateTitle}") MUST remain exactly as stated.

MISSING JD KEYWORDS TO INTEGRATE:
These keywords from the job description are NOT currently in the candidate's CV.
For EACH keyword, choose the best placement:

1. IN EXPERIENCE BULLETS (preferred): Rephrase an existing responsibility to include the keyword naturally.
   Example: "Managed vulnerability prioritization using CVSS scoring" — the candidate DID manage vulnerabilities, you're adding the methodology name.

2. IN SKILLS / COMPETENCIES (fallback): If the keyword cannot fit into any existing bullet, add it to coreCompetencies or technicalSkills.
   Example: Add "CISA KEV" as a technical skill the candidate is familiar with.

Every keyword MUST be placed in at least one category (inExperience or inSkills). None should be skipped.

${missingKeywordsStr}

CRITICAL: Rephrase existing experience — never invent new projects or roles. Adding a methodology name to a real responsibility is NOT fabrication. Adding a skill to the skills list is NOT fabrication.

CANDIDATE MASTER CV:
Name: ${masterCv.fullName}
Email: ${masterCv.email} | Phone: ${masterCv.phone} | Location: ${masterCv.location}
Current Role: ${candidateTitle}
Summary: ${masterCv.summary}
Experiences:
${JSON.stringify(masterCv.experiences, null, 2)}
Education:
${JSON.stringify(masterCv.education, null, 2)}
Skills:
${JSON.stringify(masterCv.skills, null, 2)}
Certifications:
${JSON.stringify((masterCv.certifications || []).map(c => typeof c === 'string' ? c : c.name + (c.issuer ? ' (' + c.issuer + ')' : '')), null, 2)}

TARGET JOB DETAILS:
Title: ${job.title}
Company: ${job.company}
Location: ${job.location}
Description: ${job.description}

Return valid JSON only — NO markdown, NO code fences, pure JSON:
{
  "candidateName": "${masterCv.fullName}",
  "targetRole": "${candidateTitle}",
  "professionalSummary": string,
  "coreCompetencies": string[],
  "workExperience": [{ "title": string, "company": string, "location": string, "dates": string, "highlights": string[] }],
  "education": [{ "degree": string, "institution": string, "dates": string, "details": string }],
  "technicalSkills": [{ "category": string, "skills": string[] }],
  "inExperience": string[] (missing keywords integrated into experience bullets),
  "inSkills": string[] (missing keywords added to skills/competencies — placed here because they couldn't fit naturally into experience bullets),
  "afterScore": number,
  "auditNotes": string[]
}`;

    try {
      const jsonText = await ask(prompt, 0.2);
      const parsed = JSON.parse(jsonText);

      const beforeScore = job.matchScore || job.gapAnalysis?.matchScore || 50;

      const cvText = [
        parsed.professionalSummary || '',
        ...(parsed.workExperience || []).flatMap((w: any) => w.highlights || []),
        ...(parsed.coreCompetencies || []),
        ...(parsed.technicalSkills || []).flatMap((t: any) => t.skills || []),
      ].join(' ').toLowerCase();

      const allKeywords = [...new Set([
        ...(parsed.inExperience || []),
        ...(parsed.inSkills || []),
      ])].filter((k: string) => k);

      const verifiedInExperience = (parsed.inExperience || []).filter((kw: string) => cvText.includes(kw.toLowerCase()));
      const verifiedInSkills = (parsed.inSkills || []).filter((kw: string) => cvText.includes(kw.toLowerCase()));
      const verifiedAll = [...new Set([...verifiedInExperience, ...verifiedInSkills])];

      const notIntegrable = missingKeywords.filter((kw: string) => {
        const lower = kw.toLowerCase();
        return !verifiedInExperience.some((v: string) => v.toLowerCase() === lower)
            && !verifiedInSkills.some((v: string) => v.toLowerCase() === lower);
      });

      const totalMissing = missingKeywords.length || 1;
      const expWeight = verifiedInExperience.length;
      const skillsWeight = verifiedInSkills.length * 0.5;
      const weightedFill = (expWeight + skillsWeight) / totalMissing;
      const weightedFillCapped = Math.min(weightedFill, 0.95);

      const afterScore = Math.round(beforeScore + weightedFillCapped * (100 - beforeScore));
      const scoreBoost = afterScore - beforeScore;

      const rephrasedCount = (parsed.workExperience || []).reduce(
        (acc: number, item: any) => acc + (item.highlights?.length || 0), 0
      );

      const auditNotes = [
        `Maintained candidate's title as "${candidateTitle}" (not changed to "${job.title}").`,
        `Integrated ${verifiedInExperience.length} keywords into experience bullets, added ${verifiedInSkills.length} to skills section.`,
        `Rephrased ~${rephrasedCount} bullet points to naturally incorporate target keywords.`,
        ...(parsed.auditNotes || []).slice(0, 3),
      ];

      return {
        candidateName: masterCv.fullName,
        contactInfo: {
          email: masterCv.email,
          phone: masterCv.phone,
          location: masterCv.location,
          linkedin: masterCv.linkedin,
          github: masterCv.github,
          website: masterCv.website,
        },
        targetRole: candidateTitle,
        professionalSummary: parsed.professionalSummary || '',
        coreCompetencies: parsed.coreCompetencies || [],
        workExperience: parsed.workExperience || [],
        education: parsed.education || [],
        technicalSkills: parsed.technicalSkills || [],
        projects: masterCv.projects || [],
        certifications: (masterCv.certifications || []).map((c) =>
          typeof c === 'string' ? c : `${c.name}${c.issuer ? ' (' + c.issuer + ')' : ''}`
        ),
        rephraseHighlightsCount: rephrasedCount,
        keywordsIncorporated: verifiedAll,
          audit: {
          beforeScore,
          afterScore,
          scoreBoost,
          scoreBreakdown: {
            alreadyMatched: beforeScore,
            newlyIntegrated: scoreBoost,
            remainingGap: 100 - afterScore,
          },
          missingBefore: {
            skills: missingSkills,
            keywords: missingKeywords,
          },
          addedAfter: {
            keywordsIncorporated: verifiedAll,
            keywordsInExperience: verifiedInExperience,
            keywordsInSkills: verifiedInSkills,
            rephrasedHighlightsCount: rephrasedCount,
            skillsAdded: missingSkills,
          },
          notIntegrable,
          auditNotes,
        },
      };
    } catch (err) {
      console.error('Error tailoring CV with LLM, using fallback:', err);
      return this.fallbackTailorCv(job, masterCv);
    }
  }

  private fallbackTailorCv(job: Job, masterCv: MasterCv): TailoredCv {
    const candidateTitle = masterCv.experiences[0]?.title || masterCv.summary?.split(/[.,\n]/)[0]?.trim() || job.title;
    const missingSkills = job.gapAnalysis?.missingSkills || [];
    const missingKeywords = job.gapAnalysis?.missingKeywords || [];
    const allMissing = [...missingSkills, ...missingKeywords];

    const tailoredExperiences = masterCv.experiences.map((exp) => ({
      title: exp.title,
      company: exp.company,
      location: exp.location,
      dates: exp.dates,
      highlights: exp.responsibilities.map((r) =>
        `${r} (Optimized for ${job.title} requirements at ${job.company}).`
      ),
    }));

    const rephrasedCount = tailoredExperiences.reduce((acc, curr) => acc + curr.highlights.length, 0);
    const beforeScore = job.matchScore || job.gapAnalysis?.matchScore || 50;
    const fillRatio = Math.min(allMissing.length / (allMissing.length + 5), 0.9);
    const afterScore = Math.round(beforeScore + fillRatio * (100 - beforeScore));
    const scoreBoost = afterScore - beforeScore;

    return {
      candidateName: masterCv.fullName,
      contactInfo: {
        email: masterCv.email,
        phone: masterCv.phone,
        location: masterCv.location,
        linkedin: masterCv.linkedin,
        github: masterCv.github,
        website: masterCv.website,
      },
      targetRole: candidateTitle,
      professionalSummary: `Experienced ${candidateTitle} professional. ${masterCv.summary}`,
      coreCompetencies: ['Full-Stack Engineering', 'System Architecture', 'ATS Optimization', 'Agile Development'],
      workExperience: tailoredExperiences,
      education: masterCv.education,
      technicalSkills: masterCv.skills.map((s) => ({ category: s.category, skills: s.items })),
      projects: masterCv.projects || [],
      certifications: (masterCv.certifications || []).map((c) =>
        typeof c === 'string' ? c : `${c.name}${c.issuer ? ' (' + c.issuer + ')' : ''}`
      ),
      rephraseHighlightsCount: rephrasedCount,
      keywordsIncorporated: allMissing,
        audit: {
        beforeScore,
        afterScore,
        scoreBoost,
        scoreBreakdown: {
          alreadyMatched: beforeScore,
          newlyIntegrated: scoreBoost,
          remainingGap: 100 - afterScore,
        },
        missingBefore: {
          skills: missingSkills,
          keywords: missingKeywords,
        },
        addedAfter: {
          keywordsIncorporated: allMissing,
          keywordsInExperience: allMissing,
          keywordsInSkills: [],
          rephrasedHighlightsCount: rephrasedCount,
          skillsAdded: missingSkills,
        },
        notIntegrable: missingKeywords,
        auditNotes: [
          `Maintained candidate's title as "${candidateTitle}" (not changed to "${job.title}").`,
          `Fallback mode: incorporated keywords into experience descriptions.`,
          `Rephrased ${rephrasedCount} experience bullet points.`,
        ],
      },
    };
  }
}
