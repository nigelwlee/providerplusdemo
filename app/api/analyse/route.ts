import { NextResponse } from "next/server";
import { AnalysisError, runAnalysis } from "@/lib/analyse";
import type { AnalyseRequestBody, AuditPathway } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

function isValidPathway(value: unknown): value is AuditPathway {
  return value === "verification" || value === "certification";
}

export async function POST(request: Request) {
  let body: Partial<AnalyseRequestBody>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  const documentText = typeof body.documentText === "string" ? body.documentText : "";
  const selectedModules = Array.isArray(body.selectedModules) ? body.selectedModules : [];
  const pathway = isValidPathway(body.pathway) ? body.pathway : "certification";

  try {
    const report = await runAnalysis({ documentText, selectedModules, pathway });
    return NextResponse.json(report);
  } catch (error) {
    if (error instanceof AnalysisError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Analysis failed:", error);
    const message =
      error instanceof Error && error.message.includes("OPENROUTER_API_KEY")
        ? error.message
        : "The analysis failed unexpectedly. Please try again in a moment.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
