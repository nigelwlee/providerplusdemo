export type AuditPathway = "verification" | "certification";

export interface QualityIndicator {
  standardId: string;
}

export interface PracticeStandard {
  standardId: string;
  standardName: string;
  summary: string;
  qualityIndicators: string[];
}

export interface PracticeDivision {
  divisionId: string;
  divisionName: string;
  standards: PracticeStandard[];
}

export interface PracticeModule {
  moduleId: string;
  moduleName: string;
  shortName: string;
  appliesTo: string;
  registrationGroup?: string;
  formerRegistrationGroup?: string;
  note?: string;
  structureOnly?: boolean;
  divisions?: PracticeDivision[];
  topLevelStandards?: string[];
}

export interface PracticeStandardsData {
  disclaimer: string;
  modules: PracticeModule[];
}

export interface GlossaryEntry {
  term: string;
  definition: string;
}

export type StandardStatus = "met" | "partial" | "gap" | "not_addressed";
export type ConfidenceLevel = "high" | "medium" | "low";

export interface EvidenceQuote {
  quote: string;
  locationHint: string;
}

export interface StandardFinding {
  standardId: string;
  standardName: string;
  division: string;
  status: StandardStatus;
  confidence: ConfidenceLevel;
  evidence: EvidenceQuote[];
  findings: string;
  suggestedFix: string;
}

export type OverallReadiness = "audit-ready" | "minor gaps" | "significant gaps";

export interface AnalysisSummary {
  overallReadiness: OverallReadiness;
  score: number;
  topThreeRisks: string[];
  executiveSummary: string;
}

export interface AnalysisReport {
  summary: AnalysisSummary;
  standards: StandardFinding[];
  modulesAnalysed: string[];
  pathway: AuditPathway;
  generatedAt: string;
  /** True when the source document exceeded the length threshold and was condensed before analysis. */
  documentCondensed: boolean;
  disclaimer: string;
}

export interface AnalyseRequestBody {
  documentText: string;
  selectedModules: string[];
  pathway: AuditPathway;
}

/** A small group of standards (one slice of one division) assessed together in a single LLM call. */
export interface AnalysisBatch {
  batchId: string;
  moduleId: string;
  moduleName: string;
  registrationGroup?: string;
  divisionName: string;
  standards: PracticeStandard[];
}

/** Progress events streamed to the client while an analysis runs. */
export type AnalysisProgressEvent =
  | { stage: "condensing" }
  | { stage: "batches"; completed: number; total: number }
  | { stage: "synthesis" };

