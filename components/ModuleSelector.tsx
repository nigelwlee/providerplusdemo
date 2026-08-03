"use client";

import type { ModuleOption } from "@/lib/practiceStandards";

export function ModuleSelector({
  options,
  selected,
  onChange,
}: {
  options: ModuleOption[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  function toggle(moduleId: string) {
    const next = new Set(selected);
    if (next.has(moduleId)) {
      next.delete(moduleId);
    } else {
      next.add(moduleId);
    }
    onChange(next);
  }

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {options.map((opt) => {
        const checked = selected.has(opt.moduleId);
        return (
          <label
            key={opt.moduleId}
            className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 transition-colors ${
              checked
                ? "border-pp-blue bg-pp-bg-light/40"
                : "border-pp-beige-darkest bg-pp-bg-white hover:border-pp-blue/50"
            }`}
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={() => toggle(opt.moduleId)}
              className="mt-0.5 h-4 w-4 accent-pp-blue"
            />
            <span className="flex flex-col">
              <span className="flex items-center gap-2 text-sm font-semibold text-pp-text-primary">
                {opt.shortName}
                {opt.registrationGroup && (
                  <span className="rounded-full bg-pp-orange-bg/40 px-2 py-0.5 text-[11px] font-medium text-pp-orange-text">
                    Group {opt.registrationGroup}
                  </span>
                )}
                {!opt.hasDetailedStandards && (
                  <span className="text-[11px] font-medium text-pp-text-primary/45">
                    reference only
                  </span>
                )}
              </span>
              <span className="text-xs leading-snug text-pp-text-primary/65">{opt.appliesTo}</span>
            </span>
          </label>
        );
      })}
    </div>
  );
}
