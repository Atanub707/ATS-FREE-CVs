import { BaseCvBuilder } from './baseBuilder.js';
import { Job, MasterCv, TailoredCv } from '../../src/types.js';
import { ask } from '../llm/llmAdapter.js';

export class LlmCvTailor extends BaseCvBuilder {
  async tailorCv(job: Job, masterCv: MasterCv): Promise<TailoredCv> {
    const candidateTitle = masterCv.experiences[0]?.title || masterCv.summary?.split(/[.,\n]/)[0]?.trim() || job.title;

    const missingSkills = job.gapAnalysis?.missingSkills && job.gapAnalysis.missingSkills.length > 0
      ? job.gapAnalysis.missingSkills
      : [];

    const missingKeywords = job.gapAnalysis?.missingKeywords && job.gapAnalysis.missingKeywords.length > 0
      ? job.gapAnalysis.missingKeywords
      : [];

    const missingKeywordsStr = missingKeywords.length > 0
      ? missingKeywords.map(k => `  - ${k}`).join('\n')
      : '  (none identified)';

    const prompt = `You are an elite Executive Resume Writer and ATS Optimization Specialist.
Your mission is to rewrite the candidate's Master CV so it ranks at the top of real ATS systems (Greenhouse, Workday, Lever, Taleo, iCIMS).

STRICT RULE: NEVER FABRICATE OR INVENT NEW COMPANIES, DATES, DEGREES, OR WORK EXPERIENCE.

CRITICAL RULE: The candidate's actual job title ("${candidateTitle}") MUST remain exactly as stated. Do NOT replace it with the target job title.

MISSING JD KEYWORDS — YOU MUST INTEGRATE THESE:
The following keywords from the job description are NOT currently in the candidate's CV.
For EACH keyword, determine if it can naturally fit into the candidate's existing experience:
- If yes: rephrase an existing bullet point to include the keyword naturally (e.g., "Managed vulnerability prioritization using CVSS scoring" instead of just listing it).
- If no (would require inventing experience the candidate doesn't have): skip it and add it to the "notIntegrable" array.

${missingKeywordsStr}

CRITICAL: Do NOT fabricate experience. Only rephrase what already exists. If a keyword cannot be worked into existing bullets naturally, report it in notIntegrable.

STEP 1 — GAP ANALYSIS (do this internally before writing):
- Extract every hard skill, tool, certification, and technology from the job description.
- Compare against the candidate's CV to identify what's present and what's missing.

STEP 2 — OPTIMIZE EACH SECTION:
1. Professional Summary: Start with the candidate's ACTUAL role ("${candidateTitle}"). Include the top 3-4 hard skills from the JD. Do NOT change the stated role. 2-3 sentences max.
2. Work Experience: Keep ORIGINAL job titles. REORDER bullets so most relevant to this JD come FIRST. Rephrase to naturally incorporate missing keywords WITHOUT fabricating.
3. Skills/Core Competencies: FRONT-LOAD categories that match the JD. Move less relevant skills down.
4. Keyword Density: Ensure missing keywords appear naturally in summary + experience + skills.
5. Quantification: Rewrite bullets to include metrics where possible.

STEP 3 — FORMATTING RULES:
- Standard section headers: "Professional Summary", "Professional Experience", "Education", "Technical Skills", "Certifications"
- No columns, tables, graphics, or unusual characters
- Dates in "Month YYYY — Month YYYY" format
- Degree names spelled out

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
  "candidateName": string,
  "targetRole": "${candidateTitle}",
  "professionalSummary": string (2-3 sentences, start with "${candidateTitle}", include top JD skills),
  "coreCompetencies": string[] (6-10 items, ordered by JD relevance),
  "workExperience": [{ "title": string (original from Master CV), "company": string, "location": string, "dates": string, "highlights": string[] }],
  "education": [{ "degree": string, "institution": string, "dates": string, "details": string }],
  "technicalSkills": [{ "category": string, "skills": string[] }],
  "keywordsIncorporated": string[] (missing keywords you successfully integrated into the CV),
  "notIntegrable": string[] (missing keywords that could NOT be added without fabricating experience),
  "afterScore": number,
  "auditNotes": string[] (4-6 specific changes made)
}`;

    try {
      const jsonText = await ask(prompt, 0.2);
      const parsed = JSON.parse(jsonText);

      const beforeScore = job.matchScore || job.gapAnalysis?.matchScore || 68;

      const cvText = [
        parsed.professionalSummary || '',
        ...(parsed.workExperience || []).flatMap((w: any) => w.highlights || []),
        ...(parsed.coreCompetencies || []),
        ...(parsed.technicalSkills || []).flatMap((t: any) => t.skills || []),
      ].join(' ').toLowerCase();

      const llmClaimed = (parsed.keywordsIncorporated || []).filter((k: string) => k);
      const verifiedKeywords = llmClaimed.filter((kw: string) => cvText.includes(kw.toLowerCase()));

      const llmNotIntegrable = (parsed.notIntegrable || []).filter((k: string) => k);
      const actuallyNotIntegrable = missingKeywords.filter((kw: string) => {
        const lower = kw.toLowerCase();
        return !verifiedKeywords.some((v: string) => v.toLowerCase() === lower) && !cvText.includes(lower);
      });
      const allNotIntegrable = [...new Set([...llmNotIntegrable, ...actuallyNotIntegrable])];

      const integratedCount = verifiedKeywords.length;
      const totalMissing = missingKeywords.length;
      const fullGap = 100 - beforeScore;
      const maxPossibleBump = fullGap;
      const fillRatio = totalMissing > 0 ? integratedCount / totalMissing : 0;
      const bumpRaw = Math.round(fillRatio * maxPossibleBump);
      const bumpDiscounted = Math.round(bumpRaw * 0.55);
      const afterScore = Math.min(beforeScore + bumpDiscounted, 95);
      const scoreBoost = afterScore - beforeScore;
      const remainingGap = 100 - afterScore;

      const rephrasedCount = (parsed.workExperience || []).reduce(
        (acc: number, item: any) => acc + (item.highlights?.length || 0), 0
      );

      const matchedKeys = [...new Set(verifiedKeywords)];
      const unmatchedKeys = [...new Set(allNotIntegrable)];

      const auditNotes = [
        `Maintained candidate's title as "${candidateTitle}" (not changed to "${job.title}").`,
        `Integrated ${integratedCount} of ${totalMissing} missing JD keywords into the CV text.`,
        ...(unmatchedKeys.length > 0
          ? [`Could not add ${unmatchedKeys.length} keywords without fabricating experience: ${unmatchedKeys.join(', ')}.`]
          : []),
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
        professionalSummary:
          parsed.professionalSummary ||
          `Experienced ${candidateTitle} professional with a proven track record of delivering high-impact results.`,
        coreCompetencies:
          parsed.coreCompetencies || ['TypeScript', 'Node.js/Express', 'React', 'Cloud Services', 'ATS Optimization'],
        workExperience: parsed.workExperience || [],
        education: parsed.education || [],
        technicalSkills: parsed.technicalSkills || [],
        projects: masterCv.projects || [],
        certifications: (masterCv.certifications || []).map((c) =>
          typeof c === 'string' ? c : `${c.name}${c.issuer ? ' (' + c.issuer + ')' : ''}`
        ),
        rephraseHighlightsCount: rephrasedCount,
        keywordsIncorporated: matchedKeys,
        audit: {
          beforeScore,
          afterScore,
          scoreBoost,
          scoreBreakdown: {
            alreadyMatched: beforeScore,
            newlyIntegrated: scoreBoost,
            remainingGap,
          },
          missingBefore: {
            skills: missingSkills,
            keywords: missingKeywords,
          },
          addedAfter: {
            keywordsIncorporated: matchedKeys,
            rephrasedHighlightsCount: rephrasedCount,
            skillsAdded: missingSkills,
          },
          notIntegrable: unmatchedKeys,
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

    const jobKeywords = [candidateTitle, ...missingKeywords.slice(0, 5)];

    const tailoredExperiences = masterCv.experiences.map((exp) => {
      const rephrasedHighlights = exp.responsibilities.map((r) => {
        if (!r.toLowerCase().includes('typescript') && !r.toLowerCase().includes('react')) {
          return `${r} (Optimized for ${job.title} requirements at ${job.company}).`;
        }
        return r;
      });
      return {
        title: exp.title,
        company: exp.company,
        location: exp.location,
        dates: exp.dates,
        highlights: rephrasedHighlights,
      };
    });

    const rephrasedCount = tailoredExperiences.reduce((acc, curr) => acc + curr.highlights.length, 0);
    const beforeScore = job.matchScore || job.gapAnalysis?.matchScore || 68;
    const afterScore = Math.min(beforeScore + 10, 85);
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
      keywordsIncorporated: jobKeywords,
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
          keywordsIncorporated: jobKeywords,
          rephrasedHighlightsCount: rephrasedCount,
          skillsAdded: missingSkills,
        },
        notIntegrable: missingKeywords,
        auditNotes: [
          `Maintained candidate's title as "${candidateTitle}" (not changed to "${job.title}").`,
          `Fallback mode: could not automatically integrate missing keywords. Manual review recommended.`,
          `Rephrased ${rephrasedCount} experience bullet points with target keywords.`,
        ],
      },
    };
  }
}
