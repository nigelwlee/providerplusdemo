import { callClaude, extractJson } from "./llm";
import { buildBatchAnalysisPrompt, buildCondensePrompt, buildSynthesisPrompt } from "./prompt";
import { getModulesById, practiceStandards } from "./practiceStandards";
import { LONG_DOCUMENT_THRESHOLD } from "./parseDocument";
import type {
  AnalyseRequestBody,
  AnalysisBatch,
  AnalysisProgressEvent,
  AnalysisReport,
  AnalysisSummary,
  AuditPathway,
  ConfidenceLevel,
  OverallReadiness,
  PracticeModule,
  StandardFinding,
  StandardStatus,
} from "./types";

export class AnalysisError extends Error {}

const CHUNK_SIZE = 40_000;

/** How many standards each parallel batch call assesses at once. Smaller = faster/more parallel, but more total prompt tokens (the full document is sent once per batch) and more calls that could each need a retry. Tune via env after measuring actual tokens/sec with LLM_DEBUG=1. */
const MAX_STANDARDS_PER_BATCH = Number(process.env.ANALYSIS_BATCH_SIZE) || 3;

const VALID_STATUSES = new Set<StandardStatus>(["met", "partial", "gap", "not_addressed"]);
const VALID_CONFIDENCE = new Set<ConfidenceLevel>(["high", "medium", "low"]);
const VALID_READINESS = new Set<OverallReadiness>(["audit-ready", "minor gaps", "significant gaps"]);

/** Deterministic score weighting so the score dial is reproducible run-to-run and can never disagree with the readiness verdict (both are derived here, not left to the model to keep in sync across a partial view of the results). */
const STATUS_WEIGHT: Record<StandardStatus, number> = { met: 1, partial: 0.5, gap: 0.15, not_addressed: 0 };

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

function parseStandardsResponse(raw: string, expectedIds: Set<string>): StandardFinding[] {
  const jsonText = extractJson(raw);
  const parsed = JSON.parse(jsonText);
  if (typeof parsed !== "object" || parsed === null || !Array.isArray(parsed.standards)) {
    throw new Error("Response JSON is missing a standards array.");
  }
  const standards: StandardFinding[] = parsed.standards.map(validateStandard);
  const returnedIds = new Set(standards.map((s) => s.standardId));
  const missingIds = [...expectedIds].filter((id) => !returnedIds.has(id));
  if (missingIds.length > 0) {
    throw new Error(`Response is missing standards: ${missingIds.join(", ")}`);
  }
  return standards.filter((s) => expectedIds.has(s.standardId));
}

function parseSummaryResponse(raw: string): AnalysisSummary {
  return validateSummary(JSON.parse(extractJson(raw)));
}

/**
 * Retries once on ANY failure — a network/API-level error from callClaude
 * itself (rate limit, transient 5xx, timeout) just as much as a parse/
 * validation failure. With 12 concurrent requests per analysis and the SDK's
 * own retries disabled (see lib/llm.ts), a single transient hiccup on any one
 * of them must not be allowed to fail the whole thing outright — Promise.all
 * fails fast on the first rejection, so this is the only safety net.
 */
async function callWithOneRetry<T>(params: {
  system: string;
  user: string;
  maxTokens: number;
  jsonMode?: boolean;
  parse: (raw: string) => T;
  debugLabel: string;
}): Promise<T> {
  const { system, user, maxTokens, jsonMode, parse, debugLabel } = params;

  async function attempt(promptUser: string): Promise<T> {
    const raw = await callClaude({ system, user: promptUser, maxTokens, jsonMode });
    return parse(raw);
  }

  try {
    return await attempt(user);
  } catch (err) {
    // Always log (not gated behind LLM_DEBUG) — this is a failure path, not
    // verbose success-path noise, and it's the only place the real
    // underlying error (network/API vs. parse/validation) is visible before
    // it gets replaced by the generic AnalysisError message below. Without
    // this, a production failure is undiagnosable from Vercel's logs.
    console.error(`[analyse] ${debugLabel} first attempt failed:`, describeError(err));
    try {
      return await attempt(
        `${user}\n\nYour previous response was not valid JSON matching the required schema, or was missing required entries. Return ONLY the JSON object — no markdown code fences, no commentary before or after.`
      );
    } catch (err2) {
      console.error(`[analyse] ${debugLabel} retry attempt failed:`, describeError(err2));
      throw new AnalysisError(
        "The analysis engine returned an unexpected or incomplete response. Please try again — if this keeps happening, try a shorter document."
      );
    }
  }
}

/** Surfaces enough detail to tell an API-level failure (status/code from the OpenAI SDK) apart from a parse/validation failure, without dumping a full stack trace into the logs on every retry. */
function describeError(err: unknown): unknown {
  if (err instanceof Error) {
    const withStatus = err as Error & { status?: number; code?: string };
    return {
      name: err.name,
      message: err.message,
      status: withStatus.status,
      code: withStatus.code,
    };
  }
  return err;
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

/** Splits each division's standards into near-equal chunks of at most maxPerBatch, in dataset order (so Promise.all's result order reproduces today's report ordering when flattened). */
function buildBatches(modules: PracticeModule[], maxPerBatch: number): AnalysisBatch[] {
  const batches: AnalysisBatch[] = [];
  for (const mod of modules) {
    if (!mod.divisions) continue;
    for (const div of mod.divisions) {
      const standards = div.standards;
      const total = standards.length;
      const numChunks = Math.max(1, Math.ceil(total / maxPerBatch));
      const baseSize = Math.floor(total / numChunks);
      const remainder = total % numChunks;
      let offset = 0;
      for (let i = 0; i < numChunks; i++) {
        const size = baseSize + (i < remainder ? 1 : 0);
        batches.push({
          batchId: `${mod.moduleId}-${div.divisionId}-${i + 1}`,
          moduleId: mod.moduleId,
          moduleName: mod.moduleName,
          registrationGroup: mod.registrationGroup,
          divisionName: div.divisionName,
          standards: standards.slice(offset, offset + size),
        });
        offset += size;
      }
    }
  }
  return batches;
}

/** Generous headroom over the ~290 tokens/standard observed in practice — truncation costs a whole retry, over-provisioning costs nothing. */
function batchMaxTokens(batch: AnalysisBatch): number {
  return Math.min(8000, 900 * batch.standards.length + 600);
}

async function runBatch(
  batch: AnalysisBatch,
  documentText: string,
  pathway: AuditPathway
): Promise<StandardFinding[]> {
  const expectedIds = new Set(batch.standards.map((s) => s.standardId));
  const { system, user } = buildBatchAnalysisPrompt({ documentText, batch, pathway });

  const standards = await callWithOneRetry({
    system,
    user,
    maxTokens: batchMaxTokens(batch),
    jsonMode: true,
    parse: (raw) => parseStandardsResponse(raw, expectedIds),
    debugLabel: `batch ${batch.batchId}`,
  });

  // Overwrite with canonical dataset values rather than trusting the model's
  // echo — free consistency, and it stops a paraphrased division name from
  // silently splitting a section into two headings in the report UI.
  const canonicalById = new Map(batch.standards.map((s) => [s.standardId, s]));
  return standards.map((s) => {
    const canonical = canonicalById.get(s.standardId);
    return canonical
      ? { ...s, division: batch.divisionName, standardName: canonical.standardName }
      : s;
  });
}

function computeScore(standards: StandardFinding[]): number {
  if (standards.length === 0) return 0;
  const total = standards.reduce((sum, s) => sum + STATUS_WEIGHT[s.status], 0);
  return Math.round((total / standards.length) * 100);
}

function readinessFromScore(score: number): OverallReadiness {
  if (score >= 85) return "audit-ready";
  if (score >= 65) return "minor gaps";
  return "significant gaps";
}

export async function runAnalysis(
  body: AnalyseRequestBody,
  onProgress?: (event: AnalysisProgressEvent) => void
): Promise<AnalysisReport> {
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
    onProgress?.({ stage: "condensing" });
    workingText = await condenseDocument(workingText);
    wasCondensed = true;
  }

  const batches = buildBatches(detailedModules, MAX_STANDARDS_PER_BATCH);
  if (process.env.LLM_DEBUG) {
    console.error(
      `[analyse debug] running ${batches.length} batches:`,
      batches.map((b) => `${b.batchId}(${b.standards.length})`).join(", ")
    );
  }

  let completed = 0;
  onProgress?.({ stage: "batches", completed: 0, total: batches.length });
  const batchResults = await Promise.all(
    batches.map(async (batch) => {
      const result = await runBatch(batch, workingText, pathway);
      completed += 1;
      onProgress?.({ stage: "batches", completed, total: batches.length });
      return result;
    })
  );
  const merged = batchResults.flat();

  onProgress?.({ stage: "synthesis" });
  const computedScore = computeScore(merged);
  const computedReadiness = readinessFromScore(computedScore);
  const modulesAnalysed = detailedModules.map((m) => m.moduleName);

  const { system, user } = buildSynthesisPrompt({
    standards: merged,
    pathway,
    modulesAnalysed,
    computedScore,
    computedReadiness,
  });

  const summary = await callWithOneRetry({
    system,
    user,
    maxTokens: 1024,
    jsonMode: true,
    parse: parseSummaryResponse,
    debugLabel: "synthesis",
  });
  // Belt and braces: the deterministic values are the source of truth even if
  // the model didn't echo them back exactly as instructed.
  summary.score = computedScore;
  summary.overallReadiness = computedReadiness;

  return {
    summary,
    standards: merged,
    modulesAnalysed,
    pathway,
    generatedAt: new Date().toISOString(),
    documentCondensed: wasCondensed,
    disclaimer: practiceStandards.disclaimer,
  };
}
