export function ProgressStep({
  stages,
  activeIndex,
}: {
  stages: string[];
  activeIndex: number;
}) {
  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-xl flex-col items-center justify-center gap-10 px-6 py-12">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-3xl text-pp-text-primary">Analysing your document</h1>
        <p className="text-sm text-pp-text-primary/60">
          Comparing the document against the relevant NDIS Practice Standards.
        </p>
      </div>

      <ol className="flex w-full flex-col gap-4">
        {stages.map((stage, i) => {
          const isDone = i < activeIndex;
          const isActive = i === activeIndex;
          return (
            <li key={stage} className="flex items-center gap-3">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors ${
                  isDone
                    ? "border-pp-blue bg-pp-blue text-white"
                    : isActive
                      ? "border-pp-blue text-pp-blue"
                      : "border-pp-beige-darkest text-pp-text-primary/30"
                }`}
              >
                {isDone ? (
                  <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none">
                    <path
                      d="M3 8.5L6.5 12L13 4.5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : isActive ? (
                  <span className="h-2 w-2 animate-pulse rounded-full bg-pp-blue" />
                ) : (
                  i + 1
                )}
              </span>
              <span
                className={`text-sm transition-colors ${
                  isDone
                    ? "text-pp-text-primary/50 line-through decoration-pp-text-primary/20"
                    : isActive
                      ? "font-medium text-pp-text-primary"
                      : "text-pp-text-primary/40"
                }`}
              >
                {stage}
              </span>
            </li>
          );
        })}
      </ol>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-pp-beige-darkest">
        <div
          className="h-full rounded-full bg-pp-blue transition-all duration-700 ease-out"
          style={{ width: `${Math.min(100, ((activeIndex + 0.5) / stages.length) * 100)}%` }}
        />
      </div>
    </div>
  );
}
