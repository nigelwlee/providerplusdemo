"use client";

import { Fragment, useMemo } from "react";
import glossaryData from "@/data/glossary.json";

interface GlossaryEntry {
  term: string;
  definition: string;
}

const glossary = glossaryData as GlossaryEntry[];

// Excluded from auto-highlighting: these appear in nearly every sentence of a report
// and would make the dotted underline a distraction rather than a small touch.
const HIGHLIGHT_BLOCKLIST = new Set(["provider", "participant", "registered provider"]);
const highlightable = glossary.filter((g) => !HIGHLIGHT_BLOCKLIST.has(g.term.toLowerCase()));

// Longest terms first so "Registration Group 0138" matches before "Registration group".
const sortedTerms = [...highlightable].sort((a, b) => b.term.length - a.term.length);
const escaped = sortedTerms.map((g) => g.term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
const patternSource = escaped.length > 0 ? `\\b(${escaped.join("|")})\\b` : null;
const definitionByLowerTerm = new Map(glossary.map((g) => [g.term.toLowerCase(), g.definition]));

/** Renders text with recognised NDIS glossary terms wrapped in a hover tooltip. */
export function GlossaryText({ text }: { text: string }) {
  const parts = useMemo(() => {
    if (!patternSource) return [text];
    const pattern = new RegExp(patternSource, "gi");
    const result: Array<string | { term: string; definition: string }> = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      if (match.index > lastIndex) {
        result.push(text.slice(lastIndex, match.index));
      }
      const definition = definitionByLowerTerm.get(match[0].toLowerCase());
      if (definition) {
        result.push({ term: match[0], definition });
      } else {
        result.push(match[0]);
      }
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) {
      result.push(text.slice(lastIndex));
    }
    return result;
  }, [text]);

  return (
    <>
      {parts.map((part, i) =>
        typeof part === "string" ? (
          <Fragment key={i}>{part}</Fragment>
        ) : (
          <span key={i} className="glossary-term" tabIndex={0}>
            {part.term}
            <span className="glossary-tooltip">{part.definition}</span>
          </span>
        )
      )}
    </>
  );
}
