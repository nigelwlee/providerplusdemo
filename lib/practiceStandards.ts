import practiceStandardsRaw from "@/data/practice-standards.json";
import glossaryRaw from "@/data/glossary.json";
import type {
  GlossaryEntry,
  PracticeModule,
  PracticeStandard,
  PracticeStandardsData,
} from "./types";

export const practiceStandards = practiceStandardsRaw as PracticeStandardsData;
export const glossary = glossaryRaw as GlossaryEntry[];

export interface ModuleOption {
  moduleId: string;
  moduleName: string;
  shortName: string;
  appliesTo: string;
  registrationGroup?: string;
  defaultChecked: boolean;
  hasDetailedStandards: boolean;
}

/** Modules checked by default match the demo scenario: SIL provider, Core + Module 5A. */
const DEFAULT_CHECKED_MODULES = new Set(["core", "5a"]);

export function getModuleOptions(): ModuleOption[] {
  return practiceStandards.modules.map((m) => ({
    moduleId: m.moduleId,
    moduleName: m.moduleName,
    shortName: m.shortName,
    appliesTo: m.appliesTo,
    registrationGroup: m.registrationGroup,
    defaultChecked: DEFAULT_CHECKED_MODULES.has(m.moduleId),
    hasDetailedStandards: !m.structureOnly,
  }));
}

export function getModulesById(ids: string[]): PracticeModule[] {
  const idSet = new Set(ids);
  return practiceStandards.modules.filter((m) => idSet.has(m.moduleId));
}

/** Flatten every standard (with detailed quality indicators) across the given modules. */
export function flattenStandards(
  modules: PracticeModule[]
): Array<PracticeStandard & { division: string; moduleName: string }> {
  const out: Array<PracticeStandard & { division: string; moduleName: string }> = [];
  for (const mod of modules) {
    if (!mod.divisions) continue;
    for (const div of mod.divisions) {
      for (const std of div.standards) {
        out.push({ ...std, division: div.divisionName, moduleName: mod.moduleName });
      }
    }
  }
  return out;
}

export function getGlossaryMap(): Map<string, string> {
  const map = new Map<string, string>();
  for (const entry of glossary) {
    map.set(entry.term.toLowerCase(), entry.definition);
  }
  return map;
}
