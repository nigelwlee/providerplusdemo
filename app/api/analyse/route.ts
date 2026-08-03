import { AnalysisError, redactSecrets, runAnalysis } from "@/lib/analyse";
import type { AnalyseRequestBody, AuditPathway } from "@/lib/types";

export const runtime = "nodejs";
// The true ceiling on Vercel with Fluid compute (default on) is 300s on every
// plan tier. In practice the batched analysis finishes in well under a
// minute; this is a runaway guard, not an operating budget.
export const maxDuration = 300;

function isValidPathway(value: unknown): value is AuditPathway {
  return value === "verification" || value === "certification";
}

/**
 * Streams newline-delimited JSON progress events while the analysis runs,
 * ending with either `{"type":"done","report":...}` or
 * `{"type":"error","message":...,"status":...}`. Streaming (rather than one
 * big JSON response at the end) is what lets the client show real per-batch
 * progress instead of a fake timer, and it also means the client sees
 * something long before any single request could time out.
 */
export async function POST(request: Request) {
  let body: Partial<AnalyseRequestBody>;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Request body must be valid JSON." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const documentText = typeof body.documentText === "string" ? body.documentText : "";
  const selectedModules = Array.isArray(body.selectedModules) ? body.selectedModules : [];
  const pathway = isValidPathway(body.pathway) ? body.pathway : "certification";
  // TEMPORARY diagnostic aid: only triggers on an explicit internal header,
  // never sent by the app's own client, so end users never see raw error
  // detail. Remove once the current production failure is root-caused.
  const wantsDebugDetail = request.headers.get("x-debug-detail") === "1";

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`));
      };

      try {
        const report = await runAnalysis({ documentText, selectedModules, pathway }, (event) =>
          send({ type: "progress", ...event })
        );
        send({ type: "done", report });
      } catch (error) {
        if (error instanceof AnalysisError) {
          send({
            type: "error",
            message: error.message,
            status: 400,
            ...(wantsDebugDetail ? { debugDetail: error.debugDetail } : {}),
          });
        } else {
          console.error("Analysis failed:", error);
          const message =
            error instanceof Error && error.message.includes("OPENROUTER_API_KEY")
              ? error.message
              : "The analysis failed unexpectedly. Please try again in a moment.";
          send({
            type: "error",
            message,
            status: 502,
            ...(wantsDebugDetail && error instanceof Error
              ? { debugDetail: { name: error.name, message: redactSecrets(error.message) } }
              : {}),
          });
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
