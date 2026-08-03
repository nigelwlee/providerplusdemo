"use client";

import { useEffect, useRef, useState } from "react";
import { InputStep } from "@/components/InputStep";
import { ProgressStep } from "@/components/ProgressStep";
import { ReportView } from "@/components/ReportView";
import { getModuleOptions } from "@/lib/practiceStandards";
import type { AnalysisReport, AuditPathway } from "@/lib/types";

type Step = "input" | "analysing" | "report";

const moduleOptions = getModuleOptions();

function buildStages(selectedModules: string[]): string[] {
  const stages = ["Reading document…"];
  if (selectedModules.includes("core")) {
    stages.push("Mapping against Core Module…");
  }
  if (selectedModules.includes("5a")) {
    stages.push("Checking Module 5A (SIL) quality indicators…");
  }
  const otherCount = selectedModules.filter((m) => m !== "core" && m !== "5a").length;
  if (otherCount > 0) {
    stages.push("Cross-checking supplementary modules…");
  }
  stages.push("Compiling report…");
  return stages;
}

export default function Home() {
  const [step, setStep] = useState<Step>("input");
  const [stages, setStages] = useState<string[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  async function handleAnalyse(params: {
    documentText: string;
    selectedModules: string[];
    pathway: AuditPathway;
  }) {
    setErrorMessage(null);
    const stageList = buildStages(params.selectedModules);
    setStages(stageList);
    setActiveIndex(0);
    setStep("analysing");

    let i = 0;
    timerRef.current = setInterval(() => {
      i += 1;
      // Hold on the second-to-last stage until the real request resolves.
      setActiveIndex(Math.min(i, stageList.length - 2));
    }, 1600);

    try {
      const res = await fetch("/api/analyse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "The analysis failed unexpectedly.");
      }

      if (timerRef.current) clearInterval(timerRef.current);
      setActiveIndex(stageList.length - 1);

      setTimeout(() => {
        setReport(data as AnalysisReport);
        setStep("report");
      }, 500);
    } catch (err) {
      if (timerRef.current) clearInterval(timerRef.current);
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
      {step === "analysing" && <ProgressStep stages={stages} activeIndex={activeIndex} />}
      {step === "report" && report && <ReportView report={report} onStartOver={handleStartOver} />}
    </main>
  );
}
