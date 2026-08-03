"use client";

import { useRef, useState } from "react";
import { ModuleSelector } from "./ModuleSelector";
import type { ModuleOption } from "@/lib/practiceStandards";
import type { AuditPathway } from "@/lib/types";

type InputTab = "upload" | "paste";

interface LoadedDocument {
  text: string;
  sourceLabel: string;
  pageCount?: number;
  pageTruncated: boolean;
}

export function InputStep({
  moduleOptions,
  errorMessage,
  onAnalyse,
}: {
  moduleOptions: ModuleOption[];
  errorMessage: string | null;
  onAnalyse: (params: {
    documentText: string;
    selectedModules: string[];
    pathway: AuditPathway;
  }) => void;
}) {
  const [tab, setTab] = useState<InputTab>("upload");
  const [doc, setDoc] = useState<LoadedDocument | null>(null);
  const [pastedText, setPastedText] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [selectedModules, setSelectedModules] = useState<Set<string>>(
    new Set(moduleOptions.filter((m) => m.defaultChecked).map((m) => m.moduleId))
  );
  const [pathway, setPathway] = useState<AuditPathway>("certification");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setParseError(null);
    setIsParsing(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/parse", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to read that file.");
      }
      setDoc({
        text: data.text,
        sourceLabel: file.name,
        pageCount: data.pageCount,
        pageTruncated: data.truncated,
      });
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Failed to read that file.");
      setDoc(null);
    } finally {
      setIsParsing(false);
    }
  }

  async function handleSample() {
    setParseError(null);
    setIsParsing(true);
    try {
      const res = await fetch("/sample-policy.txt");
      const text = await res.text();
      setTab("paste");
      setPastedText(text);
      setDoc(null);
    } catch {
      setParseError("Couldn't load the sample document.");
    } finally {
      setIsParsing(false);
    }
  }

  const documentText = tab === "upload" ? doc?.text ?? "" : pastedText;
  const canAnalyse = documentText.trim().length > 0 && selectedModules.size > 0 && !isParsing;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-12">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="rounded-full bg-pp-blue/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-pp-blue">
          Provider+ Proof of Concept
        </span>
        <h1 className="text-4xl text-pp-text-primary sm:text-5xl">Audit-Ready Gap Checker</h1>
        <p className="max-w-xl text-base text-pp-text-primary/70">
          Upload a policy document. Get an audit-style gap analysis against the NDIS Practice
          Standards in under a minute.
        </p>
      </div>

      <div className="rounded-2xl border border-pp-beige-darkest bg-pp-bg-white p-6 shadow-[0_4px_8px_rgba(14,36,57,0.08)] sm:p-8">
        <div className="mb-5 flex gap-1 rounded-xl bg-pp-bg-secondary p-1 text-sm font-medium">
          <button
            type="button"
            onClick={() => setTab("upload")}
            className={`flex-1 rounded-lg py-2 transition-colors ${
              tab === "upload" ? "bg-pp-bg-white text-pp-text-primary shadow-sm" : "text-pp-text-primary/55"
            }`}
          >
            Upload document
          </button>
          <button
            type="button"
            onClick={() => setTab("paste")}
            className={`flex-1 rounded-lg py-2 transition-colors ${
              tab === "paste" ? "bg-pp-bg-white text-pp-text-primary shadow-sm" : "text-pp-text-primary/55"
            }`}
          >
            Paste text
          </button>
        </div>

        {tab === "upload" ? (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (file) handleFile(file);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
              isDragging ? "border-pp-blue bg-pp-bg-light/40" : "border-pp-beige-darkest bg-pp-bg-secondary"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.txt"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
            {isParsing ? (
              <p className="text-sm text-pp-text-primary/70">Reading document…</p>
            ) : doc ? (
              <>
                <p className="text-sm font-semibold text-pp-text-primary">{doc.sourceLabel}</p>
                <p className="text-xs text-pp-text-primary/60">
                  {doc.pageCount ? `${doc.pageCount} pages parsed` : "Loaded"}
                  {doc.pageTruncated ? " — truncated to first 50 pages" : ""}
                </p>
                <p className="text-xs text-pp-blue underline">Click or drop to replace</p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-pp-text-primary">
                  Drag and drop a policy document, or click to browse
                </p>
                <p className="text-xs text-pp-text-primary/55">PDF or .docx, up to 50 pages</p>
              </>
            )}
          </div>
        ) : (
          <textarea
            value={pastedText}
            onChange={(e) => {
              setPastedText(e.target.value);
              setDoc(null);
            }}
            placeholder="Paste the text of a policy or procedure document here…"
            className="h-48 w-full resize-y rounded-xl border border-pp-beige-darkest bg-pp-bg-secondary p-4 text-sm text-pp-text-primary placeholder:text-pp-text-primary/40 focus:border-pp-blue focus:outline-none"
          />
        )}

        {parseError && (
          <p className="mt-3 rounded-lg bg-pp-error-bg px-3 py-2 text-sm text-pp-error">{parseError}</p>
        )}

        <button
          type="button"
          onClick={handleSample}
          disabled={isParsing}
          className="mt-4 w-full rounded-xl border border-pp-blue-press bg-pp-bg-alternate px-4 py-2.5 text-sm font-semibold text-pp-text-alternate transition-colors hover:bg-pp-navy-hover disabled:opacity-60"
        >
          Try with sample document — Harbour Care Services (SIL)
        </button>
      </div>

      <div className="rounded-2xl border border-pp-beige-darkest bg-pp-bg-white p-6 shadow-[0_4px_8px_rgba(14,36,57,0.08)] sm:p-8">
        <h2 className="mb-1 text-lg text-pp-text-primary">Registration modules</h2>
        <p className="mb-4 text-sm text-pp-text-primary/60">
          Select the Practice Standards modules that apply to this provider&rsquo;s registration.
        </p>
        <ModuleSelector options={moduleOptions} selected={selectedModules} onChange={setSelectedModules} />

        <div className="mt-6 flex flex-col gap-2 sm:max-w-xs">
          <label className="text-sm font-medium text-pp-text-primary">Audit pathway</label>
          <select
            value={pathway}
            onChange={(e) => setPathway(e.target.value as AuditPathway)}
            className="rounded-xl border border-pp-beige-darkest bg-pp-bg-secondary px-3 py-2.5 text-sm text-pp-text-primary focus:border-pp-blue focus:outline-none"
          >
            <option value="certification">Certification audit</option>
            <option value="verification">Verification audit</option>
          </select>
        </div>
      </div>

      {errorMessage && (
        <p className="rounded-xl bg-pp-error-bg px-4 py-3 text-sm text-pp-error">{errorMessage}</p>
      )}

      <button
        type="button"
        disabled={!canAnalyse}
        onClick={() =>
          onAnalyse({
            documentText,
            selectedModules: Array.from(selectedModules),
            pathway,
          })
        }
        className="w-full rounded-xl border border-pp-blue-press bg-pp-blue px-6 py-3.5 text-base font-semibold text-white shadow-[0_4px_8px_rgba(14,36,57,0.16)] transition-colors hover:bg-pp-blue-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        Analyse document
      </button>
    </div>
  );
}
