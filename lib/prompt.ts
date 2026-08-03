import { glossary, practiceStandards } from "./practiceStandards";
import type { AnalysisBatch, AuditPathway, StandardFinding } from "./types";

// Shared across the batch and synthesis prompts, so there is exactly one
// place where voice/terminology rules live — this is what keeps AU spelling
// and "participant" (not "client") consistent once the analysis is split
// across several separate LLM calls.
const AUDITOR_PERSONA = `You are an experienced former NDIS Quality and Safeguards Commission auditor now working with Provider+, an Australian NDIS consultancy known for taking the headache out of compliance for disability service providers. You are performing a gap analysis of a provider's policy document against the NDIS Practice Standards, ahead of a real audit.`;

const VOICE_RULES = `Voice and terminology rules (follow strictly):
- Australian English spelling throughout (organisation, analyse, licence, standardise).
- Use correct NDIS sector terminology: participant (never "client" or "customer"), non-conformity, corrective action plan, reportable incident, restrictive practice, key personnel, risk assessed roles, service agreement, choice and control.
- Write findings and suggested fixes in plain English — firm, specific, and jargon-decoded, like a helpful auditor explaining things simply. Never write like legislation.
- Be conservative and evidence-based. If the document does not clearly address a standard, mark it "gap" or "not_addressed" — do not give the provider the benefit of the doubt. A real audit does not do charitable inference.
- "met" requires clear, specific evidence in the document. "partial" means some relevant content exists but it is incomplete, inconsistent, vague, or not yet fully implemented (e.g. relies on informal practice, says "when time permits", lacks a documented schedule). "gap" means the document actively shows an absence or clear inadequacy. "not_addressed" means the document is silent on the topic entirely.
- Evidence quotes must be verbatim substrings from the supplied document text, 25 words or fewer. If you cannot find a supporting quote, use an empty evidence array rather than inventing one.`;

const GLOSSARY_BLOCK = glossary.map((g) => `- ${g.term}: ${g.definition}`).join("\n");

const STANDARDS_SCHEMA = `{
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

const SUMMARY_SCHEMA = `{
  "overallReadiness": "audit-ready" | "minor gaps" | "significant gaps",
  "score": number (0-100, integer),
  "topThreeRisks": string[] (exactly 3 short risk statements, most serious first),
  "executiveSummary": string (4-5 sentences, plain English, written for a CEO who is not a compliance specialist)
}`;

function pathwayLabel(pathway: AuditPathway): string {
  return pathway === "certification"
    ? "Certification audit (full on-site assessment)"
    : "Verification audit (desktop review)";
}

/**
 * Builds a prompt that assesses ONE small batch of standards (a slice of one
 * division) against the full document. Batches run in parallel — each still
 * gets the whole document, since evidence for a given standard can live
 * anywhere in it, but each is asked to return findings only for its own
 * handful of standards, which keeps individual completions short and fast.
 */
export function buildBatchAnalysisPrompt(params: {
  documentText: string;
  batch: AnalysisBatch;
  pathway: AuditPathway;
}): { system: string; user: string } {
  const { documentText, batch, pathway } = params;

  const standardsSlice = batch.standards.map((s) => ({
    standardId: s.standardId,
    standardName: s.standardName,
    summary: s.summary,
    qualityIndicators: s.qualityIndicators,
  }));

  const system = `${AUDITOR_PERSONA}

${VOICE_RULES}

Sector glossary for reference (use these terms correctly and consistently):
${GLOSSARY_BLOCK}

SCOPE FOR THIS REQUEST: you are assessing ONE section of the Practice Standards at a time as part of a larger audit — this is standard practice, not a shortcut. The provider's full policy document is supplied below; read all of it. But return findings ONLY for the ${batch.standards.length} standard(s) listed in this request, under division "${batch.divisionName}". Do not comment on, reference, or return entries for any other standards. Return exactly ${batch.standards.length} entries in "standards", one per supplied standardId, and echo the "division" field back exactly as "${batch.divisionName}" for every entry.

You must return JSON only, matching exactly this shape — no markdown code fences, no prose before or after:

${STANDARDS_SCHEMA}`;

  const user = `AUDIT PATHWAY: ${pathwayLabel(pathway)}
MODULE: ${batch.moduleName}${batch.registrationGroup ? ` (Registration Group ${batch.registrationGroup})` : ""}
DIVISION: ${batch.divisionName}

PRACTICE STANDARDS TO ASSESS AGAINST (assess every standardId listed here, and only these):
${JSON.stringify(standardsSlice, null, 2)}

DATASET DISCLAIMER (for your awareness, do not repeat verbatim in findings): ${practiceStandards.disclaimer}

PROVIDER'S POLICY DOCUMENT TO ANALYSE:
"""
${documentText}
"""

Assess the document against every standard listed above and return the JSON object described in your instructions.`;

  return { system, user };
}

/**
 * Builds a prompt for the final synthesis step: given the merged per-standard
 * results from all batches, produce the top-level executive summary and top
 * risks. Score and readiness are computed deterministically in code (see
 * lib/analyse.ts) and passed in so the prose stays numerically consistent
 * with what's shown on the report's score dial.
 */
export function buildSynthesisPrompt(params: {
  standards: StandardFinding[];
  pathway: AuditPathway;
  modulesAnalysed: string[];
  computedScore: number;
  computedReadiness: string;
}): { system: string; user: string } {
  const { standards, pathway, modulesAnalysed, computedScore, computedReadiness } = params;

  const compactFindings = standards.map((s) => ({
    standardId: s.standardId,
    standardName: s.standardName,
    division: s.division,
    status: s.status,
    findings: s.findings,
  }));

  const system = `${AUDITOR_PERSONA}

${VOICE_RULES}

You have already assessed every individual standard (supplied below as a compact list) and a readiness score has already been calculated from those results. Your job now is only to write the executive-level prose: the top 3 risks and the executive summary. Do not invent a different score or readiness verdict — use the ones supplied.

You must return JSON only, matching exactly this shape — no markdown code fences, no prose before or after:

${SUMMARY_SCHEMA}

The "score" and "overallReadiness" fields in your response must exactly match the values supplied to you below.`;

  const user = `AUDIT PATHWAY: ${pathwayLabel(pathway)}
MODULES ASSESSED: ${modulesAnalysed.join(", ")}
CALCULATED SCORE: ${computedScore}/100
CALCULATED READINESS: ${computedReadiness}

PER-STANDARD FINDINGS (already assessed, one per Practice Standard):
${JSON.stringify(compactFindings, null, 2)}

Based on these findings, identify the top 3 risks (most serious first, referencing specific standards by name — not generic statements) and write a 4-5 sentence executive summary in plain English for a CEO who is not a compliance specialist. Return "score": ${computedScore} and "overallReadiness": "${computedReadiness}" exactly as supplied.`;

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
