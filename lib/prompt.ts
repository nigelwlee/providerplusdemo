import { flattenStandards, glossary, practiceStandards } from "./practiceStandards";
import type { AuditPathway, PracticeModule } from "./types";

const RESPONSE_SCHEMA = `{
  "summary": {
    "overallReadiness": "audit-ready" | "minor gaps" | "significant gaps",
    "score": number (0-100, integer),
    "topThreeRisks": string[] (exactly 3 short risk statements, most serious first),
    "executiveSummary": string (4-5 sentences, plain English, written for a CEO who is not a compliance specialist)
  },
  "standards": [
    {
      "standardId": string (must exactly match an id from the supplied Practice Standards list),
      "standardName": string,
      "division": string,
      "status": "met" | "partial" | "gap" | "not_addressed",
      "confidence": "high" | "medium" | "low",
      "evidence": [ { "quote": string (verbatim from the document, 25 words or fewer), "locationHint": string (e.g. "Section 4 - Risk Management") } ],
      "findings": string (2-3 sentences, neutral auditor tone, plain English),
      "suggestedFix": string (1-3 sentences, concrete suggested policy wording or addition)
    }
  ]
}`;

export function buildAnalysisPrompt(params: {
  documentText: string;
  modules: PracticeModule[];
  pathway: AuditPathway;
}): { system: string; user: string } {
  const { documentText, modules, pathway } = params;

  const standardsSlice = modules.map((m) => ({
    moduleId: m.moduleId,
    moduleName: m.moduleName,
    registrationGroup: m.registrationGroup,
    divisions: m.divisions?.map((d) => ({
      divisionName: d.divisionName,
      standards: d.standards.map((s) => ({
        standardId: s.standardId,
        standardName: s.standardName,
        summary: s.summary,
        qualityIndicators: s.qualityIndicators,
      })),
    })),
  }));

  const glossaryBlock = glossary
    .map((g) => `- ${g.term}: ${g.definition}`)
    .join("\n");

  const standardsCount = flattenStandards(modules).length;

  const system = `You are an experienced former NDIS Quality and Safeguards Commission auditor now working with Provider+, an Australian NDIS consultancy known for taking the headache out of compliance for disability service providers. You are performing a gap analysis of a provider's policy document against the NDIS Practice Standards, ahead of a real audit.

Voice and terminology rules (follow strictly):
- Australian English spelling throughout (organisation, analyse, licence, standardise).
- Use correct NDIS sector terminology: participant (never "client" or "customer"), non-conformity, corrective action plan, reportable incident, restrictive practice, key personnel, risk assessed roles, service agreement, choice and control.
- Write findings and suggested fixes in plain English — firm, specific, and jargon-decoded, like a helpful auditor explaining things simply. Never write like legislation.
- Be conservative and evidence-based. If the document does not clearly address a standard, mark it "gap" or "not_addressed" — do not give the provider the benefit of the doubt. A real audit does not do charitable inference.
- "met" requires clear, specific evidence in the document. "partial" means some relevant content exists but it is incomplete, inconsistent, vague, or not yet fully implemented (e.g. relies on informal practice, says "when time permits", lacks a documented schedule). "gap" means the document actively shows an absence or clear inadequacy. "not_addressed" means the document is silent on the topic entirely.
- Evidence quotes must be verbatim substrings from the supplied document text, 25 words or fewer. If you cannot find a supporting quote, use an empty evidence array rather than inventing one.

Sector glossary for reference (use these terms correctly and consistently):
${glossaryBlock}

You must return JSON only, matching exactly this shape, with one entry in "standards" for every standardId supplied below (there are ${standardsCount} standards to assess) — no markdown code fences, no prose before or after:

${RESPONSE_SCHEMA}`;

  const user = `AUDIT PATHWAY: ${pathway === "certification" ? "Certification audit (full on-site assessment)" : "Verification audit (desktop review)"}

PRACTICE STANDARDS TO ASSESS AGAINST (assess every standardId listed here):
${JSON.stringify(standardsSlice, null, 2)}

DATASET DISCLAIMER (for your awareness, do not repeat verbatim in findings): ${practiceStandards.disclaimer}

PROVIDER'S POLICY DOCUMENT TO ANALYSE:
"""
${documentText}
"""

Assess the document against every standard listed above and return the JSON object described in your instructions.`;

  return { system, user };
}

export function buildCondensePrompt(chunk: string, chunkIndex: number, totalChunks: number): {
  system: string;
  user: string;
} {
  return {
    system:
      "You condense long NDIS provider policy documents for a downstream compliance gap-analysis. Preserve every specific, checkable detail: what policies exist, what they cover, any dates/version numbers, and any admissions of gaps or informal practice (e.g. 'reviewed periodically', 'when time permits'). Cut repetition and boilerplate. Keep verbatim short phrases where they show compliance-relevant specifics, in Australian English. Output plain condensed text only, no commentary.",
    user: `This is chunk ${chunkIndex + 1} of ${totalChunks} from one policy document. Condense it to roughly a third of its length, preserving all compliance-relevant specifics:\n\n"""\n${chunk}\n"""`,
  };
}
