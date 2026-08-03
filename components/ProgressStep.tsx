import type { AnalysisProgressEvent } from "@/lib/types";

export type ClientProgress = { stage: "starting" } | AnalysisProgressEvent;

function progressPercent(progress: ClientProgress): number {
  switch (progress.stage) {
    case "starting":
      return 3;
    case "condensing":
      return 8;
    case "batches": {
      const { completed, total } = progress;
      const fraction = total > 0 ? completed / total : 0;
      return 10 + fraction * 80;
    }
    case "synthesis":
      return 95;
  }
}

function progressLabel(progress: ClientProgress): string {
  switch (progress.stage) {
    case "starting":
      return "Reading document…";
    case "condensing":
      return "Document is long — condensing before analysis…";
    case "batches":
      return progress.total > 0
        ? `Analysing against the Practice Standards — ${progress.completed} of ${progress.total} sections complete…`
        : "Analysing against the Practice Standards…";
    case "synthesis":
      return "Compiling your report…";
  }
}

export function ProgressStep({ progress }: { progress: ClientProgress }) {
  const percent = Math.min(99, progressPercent(progress));

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-xl flex-col items-center justify-center gap-10 px-6 py-12">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-3xl text-pp-text-primary">Analysing your document</h1>
        <p className="text-sm text-pp-text-primary/60">{progressLabel(progress)}</p>
      </div>

      <div className="flex w-full flex-col gap-2">
        <div className="h-2 w-full overflow-hidden rounded-full bg-pp-beige-darkest">
          <div
            className="h-full rounded-full bg-pp-blue transition-all duration-500 ease-out"
            style={{ width: `${percent}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-xs text-pp-text-primary/50">
          <span>
            {progress.stage === "batches" && progress.total > 0
              ? `${progress.completed} / ${progress.total} sections`
              : "Working…"}
          </span>
          <span>{Math.round(percent)}%</span>
        </div>
      </div>
    </div>
  );
}
