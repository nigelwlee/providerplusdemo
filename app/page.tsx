"use client";

import { useState } from "react";
import { InputStep } from "@/components/InputStep";
import { ProgressStep, type ClientProgress } from "@/components/ProgressStep";
import { ReportView } from "@/components/ReportView";
import { getModuleOptions } from "@/lib/practiceStandards";
import type { AnalysisReport, AuditPathway } from "@/lib/types";

type Step = "input" | "analysing" | "report";

const moduleOptions = getModuleOptions();

export default function Home() {
  const [step, setStep] = useState<Step>("input");
  const [progress, setProgress] = useState<ClientProgress>({ stage: "starting" });
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleAnalyse(params: {
    documentText: string;
    selectedModules: string[];
    pathway: AuditPathway;
  }) {
    setErrorMessage(null);
    setProgress({ stage: "starting" });
    setStep("analysing");

    try {
      const res = await fetch("/api/analyse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });

      if (!res.body) {
        throw new Error("The analysis failed unexpectedly. Please try again in a moment.");
      }
      if (!res.ok) {
        // The route always responds 200 and streams errors as events; a
        // non-200 here means something failed before our handler even ran
        // (e.g. a platform-level timeout or error page).
        throw new Error(
          res.status === 504
            ? "The analysis timed out. Please try again — if this keeps happening, try a shorter document."
            : "The analysis failed unexpectedly. Please try again in a moment."
        );
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finalReport: AnalysisReport | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line);

          if (event.type === "progress") {
            setProgress(event as ClientProgress);
          } else if (event.type === "done") {
            finalReport = event.report as AnalysisReport;
          } else if (event.type === "error") {
            throw new Error(event.message || "The analysis failed unexpectedly.");
          }
        }
      }

      if (!finalReport) {
        throw new Error("The analysis ended without producing a report. Please try again.");
      }

      setReport(finalReport);
      setStep("report");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "The analysis failed unexpectedly.");
      setStep("input");
    }
  }

  function handleStartOver() {
    setReport(null);
    setErrorMessage(null);
    setStep("input");
  }

  return (
    <main className="flex min-h-screen flex-1 flex-col bg-pp-bg-primary">
      {step === "input" && (
        <InputStep moduleOptions={moduleOptions} errorMessage={errorMessage} onAnalyse={handleAnalyse} />
      )}
      {step === "analysing" && <ProgressStep progress={progress} />}
      {step === "report" && report && <ReportView report={report} onStartOver={handleStartOver} />}
    </main>
  );
}
