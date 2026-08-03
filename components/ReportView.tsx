"use client";

import { useMemo, useState } from "react";
import { ScoreDial } from "./ScoreDial";
import { StatusPill } from "./StatusPill";
import { GlossaryText } from "./GlossaryText";
import { generateReportPdf } from "@/lib/pdfReport";
import type { AnalysisReport, StandardFinding, StandardStatus } from "@/lib/types";

type Filter = "all" | "gap" | "partial";

function groupByDivision(standards: StandardFinding[]): Array<[string, StandardFinding[]]> {
  const order: string[] = [];
  const map = new Map<string, StandardFinding[]>();
  for (const s of standards) {
    const key = s.division || "Other";
    if (!map.has(key)) {
      map.set(key, []);
      order.push(key);
    }
    map.get(key)!.push(s);
  }
  return order.map((key) => [key, map.get(key)!]);
}

function countByStatus(standards: StandardFinding[]) {
  return standards.reduce(
    (acc, s) => {
      acc[s.status] += 1;
      return acc;
    },
    { met: 0, partial: 0, gap: 0, not_addressed: 0 } as Record<StandardStatus, number>
  );
}

export function ReportView({ report, onStartOver }: { report: AnalysisReport; onStartOver: () => void }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  const counts = useMemo(() => countByStatus(report.standards), [report.standards]);

  const filtered = useMemo(() => {
    if (filter === "all") return report.standards;
    return report.standards.filter((s) => s.status === filter);
  }, [report.standards, filter]);

  const divisions = useMemo(() => groupByDivision(filtered), [filtered]);

  function toggle(id: string) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-10">
      <div className="no-print flex items-center justify-between">
        <button
          type="button"
          onClick={onStartOver}
          className="text-sm font-medium text-pp-blue hover:underline"
        >
          ← Start new analysis
        </button>
        <button
          type="button"
          onClick={() => generateReportPdf(report)}
          className="rounded-xl border border-pp-blue-press bg-pp-blue px-4 py-2 text-sm font-semibold text-white shadow-[0_4px_8px_rgba(14,36,57,0.16)] transition-colors hover:bg-pp-blue-hover"
        >
          Download report as PDF
        </button>
      </div>

      {/* Header band */}
      <div className="flex flex-col items-center gap-6 rounded-2xl border border-pp-beige-darkest bg-pp-bg-white p-6 shadow-[0_4px_8px_rgba(14,36,57,0.08)] sm:flex-row sm:items-start sm:p-8">
        <ScoreDial score={report.summary.score} readiness={report.summary.overallReadiness} />
        <div className="flex-1">
          <h1 className="text-2xl text-pp-text-primary">Audit-Ready Gap Analysis</h1>
          <p className="mb-4 text-xs text-pp-text-primary/55">
            Modules assessed: {report.modulesAnalysed.join(", ")} ·{" "}
            {report.pathway === "certification" ? "Certification audit" : "Verification audit"} pathway
            {report.documentCondensed && " · long document condensed before analysis"}
          </p>
          <p className="text-sm leading-relaxed text-pp-text-primary/80">
            <GlossaryText text={report.summary.executiveSummary} />
          </p>
        </div>
      </div>

      {/* Top 3 risks */}
      <div>
        <h2 className="mb-3 text-lg text-pp-text-primary">Top risks</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {report.summary.topThreeRisks.map((risk, i) => (
            <div
              key={i}
              className="rounded-xl border border-pp-error/20 bg-pp-error-bg p-4 text-sm leading-snug text-pp-text-primary"
            >
              <span className="mb-1 block text-xs font-semibold text-pp-error">Risk {i + 1}</span>
              <GlossaryText text={risk} />
            </div>
          ))}
        </div>
      </div>

      {/* Counts + filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-medium text-pp-text-primary/70">
          <span className="text-pp-success">{counts.met} met</span>
          {" · "}
          <span className="text-pp-orange-text">{counts.partial} partial</span>
          {" · "}
          <span className="text-pp-error">{counts.gap} gaps</span>
          {" · "}
          <span className="text-pp-text-primary/50">{counts.not_addressed} not addressed</span>
        </p>
        <div className="no-print flex gap-2">
          {(["all", "gap", "partial"] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                filter === f
                  ? "bg-pp-blue text-white"
                  : "bg-pp-bg-white text-pp-text-primary/60 hover:bg-pp-bg-light/40"
              }`}
            >
              {f === "all" ? "All" : f === "gap" ? "Gaps only" : "Partial only"}
            </button>
          ))}
        </div>
      </div>

      {/* Standards accordion, grouped by division */}
      <div className="flex flex-col gap-8">
        {divisions.map(([division, standards]) => (
          <div key={division}>
            <h3 className="mb-3 text-base font-semibold text-pp-text-primary">{division}</h3>
            <div className="flex flex-col gap-2">
              {standards.map((s) => {
                const isOpen = openIds.has(s.standardId);
                return (
                  <div
                    key={s.standardId}
                    className="overflow-hidden rounded-xl border border-pp-beige-darkest bg-pp-bg-white"
                  >
                    <button
                      type="button"
                      onClick={() => toggle(s.standardId)}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                    >
                      <span className="text-sm font-medium text-pp-text-primary">{s.standardName}</span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="hidden text-xs text-pp-text-primary/40 sm:inline">
                          {s.confidence} confidence
                        </span>
                        <StatusPill status={s.status} />
                        <svg
                          viewBox="0 0 16 16"
                          className={`h-3.5 w-3.5 text-pp-text-primary/40 transition-transform ${isOpen ? "rotate-180" : ""}`}
                          fill="none"
                        >
                          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                    </button>

                    <div
                      className={`grid transition-all duration-300 ease-out ${
                        isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                      }`}
                    >
                      <div className="overflow-hidden">
                        <div className="flex flex-col gap-3 border-t border-pp-beige-darkest px-4 py-4">
                          <p className="text-sm leading-relaxed text-pp-text-primary/85">
                            <GlossaryText text={s.findings} />
                          </p>

                          {s.evidence.length > 0 && (
                            <div className="flex flex-col gap-2">
                              {s.evidence.map((e, i) => (
                                <blockquote
                                  key={i}
                                  className="border-l-2 border-pp-blue/40 bg-pp-bg-secondary px-3 py-2 text-xs italic text-pp-text-primary/70"
                                >
                                  “{e.quote}”
                                  <span className="mt-1 block not-italic text-[11px] text-pp-text-primary/45">
                                    {e.locationHint}
                                  </span>
                                </blockquote>
                              ))}
                            </div>
                          )}

                          {s.status !== "met" && s.suggestedFix && (
                            <div className="rounded-lg bg-pp-orange-bg/20 px-3 py-2.5">
                              <span className="mb-1 block text-xs font-semibold text-pp-orange-text">
                                Recommended action
                              </span>
                              <p className="text-sm leading-relaxed text-pp-text-primary/85">
                                <GlossaryText text={s.suggestedFix} />
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="rounded-xl border border-pp-beige-darkest bg-pp-bg-white px-4 py-8 text-center text-sm text-pp-text-primary/50">
            No standards match this filter.
          </p>
        )}
      </div>

      <footer className="border-t border-pp-beige-darkest pt-6 text-xs leading-relaxed text-pp-text-primary/50">
        Demonstration only. Not compliance, legal or audit advice. {report.disclaimer}
      </footer>
    </div>
  );
}
