import { callClaude, extractJson } from "./llm";
import { buildAnalysisPrompt, buildCondensePrompt } from "./prompt";
import { getModulesById, flattenStandards, practiceStandards } from "./practiceStandards";
import { LONG_DOCUMENT_THRESHOLD } from "./parseDocument";
import type {
  AnalyseRequestBody,
  AnalysisReport,
  AnalysisSummary,
  ConfidenceLevel,
  OverallReadiness,
  StandardFinding,
  StandardStatus,
} from "./types";

export class AnalysisError extends Error {}

const CHUNK_SIZE = 40_000;

const VALID_STATUSES = new Set<StandardStatus>(["met", "partial", "gap", "not_addressed"]);
const VALID_CONFIDENCE = new Set<ConfidenceLevel>(["high", "medium", "low"]);
const VALID_READINESS = new Set<OverallReadiness>(["audit-ready", "minor gaps", "significant gaps"]);

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function validateSummary(value: unknown): AnalysisSummary {
  if (typeof value !== "object" || value === null) {
    throw new Error("summary is missing or not an object.");
  }
  const s = value as Record<string, unknown>;
  if (!VALID_READINESS.has(s.overallReadiness as OverallReadiness)) {
    throw new Error(`summary.overallReadiness is invalid: ${JSON.stringify(s.overallReadiness)}`);
  }
  if (typeof s.score !== "number" || !Number.isFinite(s.score) || s.score < 0 || s.score > 100) {
    throw new Error(`summary.score is invalid: ${JSON.stringify(s.score)}`);
  }
  if (!Array.isArray(s.topThreeRisks) || !s.topThreeRisks.every(isNonEmptyString)) {
    throw new Error("summary.topThreeRisks must be an array of non-empty strings.");
  }
  if (!isNonEmptyString(s.executiveSummary)) {
    throw new Error("summary.executiveSummary must be a non-empty string.");
  }
  return {
    overallReadiness: s.overallReadiness as OverallReadiness,
    score: s.score,
    topThreeRisks: s.topThreeRisks as string[],
    executiveSummary: s.executiveSummary,
  };
}

function validateStandard(value: unknown): StandardFinding {
  if (typeof value !== "object" || value === null) {
    throw new Error("standard entry is not an object.");
  }
  const s = value as Record<string, unknown>;
  if (!isNonEmptyString(s.standardId)) {
    throw new Error("standard.standardId must be a non-empty string.");
  }
  if (!isNonEmptyString(s.standardName)) {
    throw new Error(`standard ${s.standardId} is missing standardName.`);
  }
  if (!isNonEmptyString(s.division)) {
    throw new Error(`standard ${s.standardId} is missing division.`);
  }
  if (!VALID_STATUSES.has(s.status as StandardStatus)) {
    throw new Error(`standard ${s.standardId} has an invalid status: ${JSON.stringify(s.status)}`);
  }
  if (!VALID_CONFIDENCE.has(s.confidence as ConfidenceLevel)) {
    throw new Error(`standard ${s.standardId} has an invalid confidence: ${JSON.stringify(s.confidence)}`);
  }
  if (!Array.isArray(s.evidence)) {
    throw new Error(`standard ${s.standardId} is missing an evidence array.`);
  }
  const evidence = s.evidence.map((e, i) => {
    if (typeof e !== "object" || e === null) {
      throw new Error(`standard ${s.standardId} evidence[${i}] is not an object.`);
    }
    const ev = e as Record<string, unknown>;
    if (typeof ev.quote !== "string" || typeof ev.locationHint !== "string") {
      throw new Error(`standard ${s.standardId} evidence[${i}] has invalid quote/locationHint.`);
    }
    return { quote: ev.quote, locationHint: ev.locationHint };
  });
  if (!isNonEmptyString(s.findings)) {
    throw new Error(`standard ${s.standardId} is missing findings.`);
  }
  if (typeof s.suggestedFix !== "string") {
    throw new Error(`standard ${s.standardId} has an invalid suggestedFix.`);
  }
  return {
    standardId: s.standardId,
    standardName: s.standardName,
    division: s.division,
    status: s.status as StandardStatus,
    confidence: s.confidence as ConfidenceLevel,
    evidence,
    findings: s.findings,
    suggestedFix: s.suggestedFix,
  };
}

async function condenseDocument(text: string): Promise<string> {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += CHUNK_SIZE) {
    chunks.push(text.slice(i, i + CHUNK_SIZE));
  }

  const condensed = await Promise.all(
    chunks.map(async (chunk, i) => {
      const { system, user } = buildCondensePrompt(chunk, i, chunks.length);
      return callClaude({ system, user, maxTokens: 4096, temperature: 0.1 });
    })
  );

  return condensed.join("\n\n");
}

function parseModelResponse(
  raw: string,
  expectedIds: Set<string>
): {
  summary: AnalysisSummary;
  standards: StandardFinding[];
} {
  const jsonText = extractJson(raw);
  const parsed = JSON.parse(jsonText);

  if (typeof parsed !== "object" || parsed === null || !Array.isArray(parsed.standards)) {
    throw new Error("Response JSON is missing required fields.");
  }

  const summary = validateSummary(parsed.summary);
  const standards: StandardFinding[] = parsed.standards.map(validateStandard);

  const returnedIds = new Set(standards.map((s) => s.standardId));
  const missingIds = [...expectedIds].filter((id) => !returnedIds.has(id));
  if (missingIds.length > 0) {
    throw new Error(`Response is missing standards: ${missingIds.join(", ")}`);
  }

  return { summary, standards: standards.filter((s) => expectedIds.has(s.standardId)) };
}

export async function runAnalysis(body: AnalyseRequestBody): Promise<AnalysisReport> {
  const { documentText, selectedModules, pathway } = body;

  if (!documentText || !documentText.trim()) {
    throw new AnalysisError("No document text was provided to analyse.");
  }
  if (!selectedModules || selectedModules.length === 0) {
    throw new AnalysisError("Select at least one Practice Standards module to assess against.");
  }

  const allSelectedModules = getModulesById(selectedModules);
  const detailedModules = allSelectedModules.filter((m) => m.divisions && m.divisions.length > 0);

  if (detailedModules.length === 0) {
    throw new AnalysisError(
      "None of the selected modules have detailed Practice Standards in this demo dataset. Select the Core Module and/or Module 5A (SIL) for a full gap analysis."
    );
  }

  let workingText = documentText;
  let wasCondensed = false;
  if (workingText.length > LONG_DOCUMENT_THRESHOLD) {
    workingText = await condenseDocument(workingText);
    wasCondensed = true;
  }

  const { system, user } = buildAnalysisPrompt({
    documentText: workingText,
    modules: detailedModules,
    pathway,
  });

  const expectedIds = new Set(flattenStandards(detailedModules).map((s) => s.standardId));

  let raw = await callClaude({ system, user, maxTokens: 16000 });
  let parsed;
  try {
    parsed = parseModelResponse(raw, expectedIds);
  } catch (err) {
    if (process.env.LLM_DEBUG) {
      console.error("[analyse debug] first parse failed:", err);
      console.error("[analyse debug] raw length:", raw.length, "tail:", raw.slice(-300));
    }
    // Retry once with an explicit correction instruction.
    raw = await callClaude({
      system,
      user: `${user}\n\nYour previous response was not valid JSON matching the required schema, or was missing some of the required standards. Return ONLY the JSON object — no markdown code fences, no commentary before or after — and make sure every standardId listed in the instructions has a corresponding entry in "standards".`,
      maxTokens: 16000,
    });
    try {
      parsed = parseModelResponse(raw, expectedIds);
    } catch (err2) {
      if (process.env.LLM_DEBUG) {
        console.error("[analyse debug] retry parse failed:", err2);
        console.error("[analyse debug] raw length:", raw.length, "tail:", raw.slice(-300));
      }
      throw new AnalysisError(
        "The analysis engine returned an unexpected or incomplete response. Please try again — if this keeps happening, try a shorter document."
      );
    }
  }

  return {
    summary: parsed.summary,
    standards: parsed.standards,
    modulesAnalysed: detailedModules.map((m) => m.moduleName),
    pathway,
    generatedAt: new Date().toISOString(),
    documentCondensed: wasCondensed,
    disclaimer: practiceStandards.disclaimer,
  };
}
